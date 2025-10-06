import imaplib
import email
from email.header import decode_header
import os
import re
from datetime import datetime
import ssl
from typing import Optional, Tuple, List, Dict
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import subprocess
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from PIL import Image
from bs4 import BeautifulSoup
import requests
from urllib.parse import urlparse, unquote

from app.core.config import settings
from app.models.order import Order, Attachment, ProcessingLog, PrintJob, EmailConfig as EmailConfigModel
from app.services.printer_service import PrinterService
from app.websocket_manager import manager

# Order type mapping - maps human-readable names to internal format
ORDER_TYPE_MAPPING = {
    "DTF": "dtf_textile",
    "ProColor": "dtf_procolor",
    "Glitter": "dtf_glitter",
    "UV DTF": "dtf_uv",
    "Sublimation": "dtf_sublimation",
    "Glow in the Dark": "dtf_glow",
    "Gold Foil": "dtf_gold_foil",
    "Reflective": "dtf_reflective",
    "Pearl": "dtf_pearl",
    "Iridescent": "dtf_iridescent",
    "Spangle": "spangle",
    "Thermochromic": "dtf_thermochromic"
}

# Reverse mapping for lookups
INTERNAL_TO_DISPLAY = {v: k for k, v in ORDER_TYPE_MAPPING.items()}

def get_email_body(msg):
    """Extract plain text body from email."""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition"))
            if ctype == "text/plain" and "attachment" not in disp:
                return part.get_payload(decode=True).decode(errors="ignore")
    else:
        return msg.get_payload(decode=True).decode(errors="ignore")
    return ""

def get_email_html_body(msg):
    """Extract HTML body from email."""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition"))
            if ctype == "text/html" and "attachment" not in disp:
                try:
                    return part.get_payload(decode=True).decode(errors="ignore")
                except:
                    return None
    else:
        if msg.get_content_type() == "text/html":
            try:
                return msg.get_payload(decode=True).decode(errors="ignore")
            except:
                return None
    return None

def decode_email_subject(subject):
    """Decode email subject with proper charset handling."""
    if not subject:
        return "(No Subject)"
    try:
        decoded_parts = decode_header(subject)
        subject_str = ""
        for part, enc in decoded_parts:
            if isinstance(part, bytes):
                subject_str += part.decode(enc or "utf-8", errors="ignore")
            else:
                subject_str += str(part)
        return subject_str
    except:
        return str(subject)

def parse_date(date_str: str) -> datetime:
    """Parse date strings from emails into datetime.
    Accepts common variants like:
    - "Thursday, October 02, 2025"
    - "Thursday, October 2, 2025"
    - "Thursday, October 02 2025"
    Falls back to current UTC time if parsing fails.
    """
    if not date_str:
        return datetime.utcnow()

    # Normalize whitespace and strip any text after the year
    cleaned = re.sub(r"\s+", " ", date_str).strip()
    # Keep only up to the first 4-digit year
    m = re.search(r"^(.*?\b\d{4})\b", cleaned)
    if m:
        cleaned = m.group(1)

    # Try multiple expected formats
    formats = [
        "%A, %B %d, %Y",
        "%A, %B %d %Y",
        "%A, %b %d, %Y",
        "%A, %b %d %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except Exception:
            continue
    return datetime.utcnow()

def parse_print_length(text: str) -> float:
    """Extract print length from text like: Total Print Length: 98.74 inches"""
    match = re.search(r"Total Print Length:\s*([\d.]+)\s*inches", text)
    return float(match.group(1)) if match else 0.0

def parse_order_types(text: str) -> List[str]:
    """Extract order types from text like: Order Type: Sublimation + DTF + ProColor + Glitter"""
    match = re.search(r"Order Type:\s*(.+?)(?:\n|$)", text)
    if match:
        order_type_text = match.group(1)
        order_types = [t.strip() for t in order_type_text.split("+")]
        return order_types
    else:
        # Try alternative patterns
        alt_patterns = [
            r"Order Types?:\s*(.+?)(?:\n|$)",
            r"Type:\s*(.+?)(?:\n|$)",
            r"Order:\s*(.+?)(?:\n|$)"
        ]
        for pattern in alt_patterns:
            alt_match = re.search(pattern, text)
            if alt_match:
                order_type_text = alt_match.group(1)
                order_types = [t.strip() for t in order_type_text.split("+")]
                return order_types
    return []

def parse_address(text: str) -> Tuple[str, str]:
    """Extract name and address from delivery address section"""
    # Clean the text by removing markdown formatting and special characters
    cleaned_text = re.sub(r'\*([^*]+)\*', r'\1', text)  # Remove asterisks around text
    cleaned_text = re.sub(r'<[^>]+>', '', cleaned_text)  # Remove HTML tags
    cleaned_text = re.sub(r'https?://[^\s]+', '', cleaned_text)  # Remove URLs
    
    lines = [line.strip() for line in cleaned_text.strip().split("\n") if line.strip()]
    
    if len(lines) >= 2:
        # First non-empty line is usually the name
        customer_name = lines[0]
        # Rest is the address
        delivery_address = "\n".join(lines[1:])
        return customer_name, delivery_address
    elif len(lines) == 1:
        # If only one line, treat it as customer name
        return lines[0], ""
    return "", ""

def count_gang_sheets(text: str, job_type: str) -> int:
    """Count number of gang sheets for a specific job type"""
    pattern = rf"{job_type} Gang Sheet #\d+"
    return len(re.findall(pattern, text))

def sanitize_folder_name(name: str) -> str:
    """Sanitize folder name by removing invalid characters"""
    # Remove or replace invalid characters for Windows filesystem
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, '_', name)
    # Remove extra spaces and limit length
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized[:50]  # Limit to 50 characters

def extract_download_urls_from_html(html_content: str) -> List[Dict[str, str]]:
    """Extract download URLs from HTML email body with their context"""
    if not html_content:
        return []
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        download_links = []
        
        # Find all links with "Download" text
        for link in soup.find_all('a', href=True):
            link_text = link.get_text(strip=True)
            if 'download' in link_text.lower():
                url = link['href']
                
                # Try to determine the order type and context
                # Look at parent elements for context
                context = ""
                parent = link.parent
                for _ in range(5):  # Check up to 5 parent levels
                    if parent:
                        parent_text = parent.get_text(strip=True)
                        context = parent_text
                        parent = parent.parent
                    else:
                        break
                
                download_links.append({
                    'url': url,
                    'link_text': link_text,
                    'context': context
                })
        
        return download_links
    except Exception as e:
        print(f"❌ Error extracting URLs from HTML: {str(e)}")
        return []

def detect_order_type_from_context(context: str, link_text: str) -> Optional[Tuple[str, int]]:
    """Detect order type and sheet number from context
    Returns: (order_type, sheet_number) or None
    """
    # Combine context and link text for analysis
    full_text = f"{context} {link_text}"
    
    # Try to find gang sheet number
    sheet_number = 1
    sheet_match = re.search(r'Gang Sheet #?(\d+)', full_text, re.IGNORECASE)
    if sheet_match:
        sheet_number = int(sheet_match.group(1))
    
    # Check for each order type
    for order_type in ORDER_TYPE_MAPPING.keys():
        # Case-insensitive search for order type
        if re.search(r'\b' + re.escape(order_type) + r'\b', full_text, re.IGNORECASE):
            return (order_type, sheet_number)
    
    # Check for variations
    if 'UV DTF' in full_text or 'UV-DTF' in full_text or 'UVDTF' in full_text:
        return ('UV DTF', sheet_number)
    if 'Glow' in full_text:
        return ('Glow in the Dark', sheet_number)
    if 'Gold' in full_text and 'Foil' in full_text:
        return ('Gold Foil', sheet_number)
        
    return None

async def download_file_from_url(url: str, save_path: str, timeout: int = 60) -> bool:
    """Download file from URL and save to specified path
    
    Args:
        url: URL to download from
        save_path: Local path to save the file
        timeout: Request timeout in seconds
        
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"📥 Downloading from URL: {url}")
        
        # Make the request with a user agent to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=timeout, stream=True)
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Save the file
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        file_size = os.path.getsize(save_path)
        print(f"✅ Downloaded successfully: {save_path} ({file_size} bytes)")
        return True
        
    except requests.exceptions.Timeout:
        print(f"❌ Download timed out after {timeout} seconds: {url}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to download from URL: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during download: {str(e)}")
        return False

def get_filename_from_url(url: str, default_name: str = "download") -> str:
    """Extract filename from URL or use default"""
    try:
        # Parse the URL
        parsed = urlparse(url)
        path = unquote(parsed.path)
        
        # Get the last part of the path
        filename = os.path.basename(path)
        
        # If no filename or no extension, use default
        if not filename or '.' not in filename:
            # Try to detect file type from URL or use default
            return f"{default_name}.png"  # Default to PNG for images
        
        return filename
    except:
        return f"{default_name}.png"

def convert_image_to_4x6_pdf(img_path: str, output_pdf: str, top_margin_inch: float = -0.5) -> bool:
    """Convert image to 4x6 inch PDF label"""
    try:
        # Open image to get dimensions
        with Image.open(img_path) as img:
            img_width, img_height = img.size
            
        # Calculate dimensions for 4x6 inch label
        width_inch = 4.0
        height_inch = 6.0
        
        # Create PDF canvas
        c = canvas.Canvas(output_pdf, pagesize=(width_inch * inch, height_inch * inch))
        
        # Calculate scaling to fit image in 4x6 format
        scale_x = (width_inch * inch) / img_width
        scale_y = (height_inch * inch) / img_height
        scale = min(scale_x, scale_y)
        
        # Calculate position to center image
        scaled_width = img_width * scale
        scaled_height = img_height * scale
        x = (width_inch * inch - scaled_width) / 2
        y = (height_inch * inch - scaled_height) / 2 + top_margin_inch * inch
        
        # Draw image
        c.drawImage(img_path, x, y, width=scaled_width, height=scaled_height)
        c.save()
        
        print(f"✅ Label PDF created successfully: {output_pdf}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to convert image to PDF: {str(e)}")
        return False

def convert_html_to_letter_pdf(html_content: str, output_pdf: str) -> bool:
    """Convert HTML content to letter-size PDF"""
    try:
        # Letter size dimensions
        width_inch = 8.5
        height_inch = 11.0
        
        # Create PDF canvas
        c = canvas.Canvas(output_pdf, pagesize=(width_inch * inch, height_inch * inch))
        
        # Add text content (simplified - in real implementation you'd parse HTML)
        text_lines = html_content.split('\n')
        y_position = height_inch * inch - 50
        
        for line in text_lines[:50]:  # Limit to first 50 lines
            if y_position < 50:  # Stop if we reach bottom margin
                break
            c.drawString(50, y_position, line[:80])  # Limit line length
            y_position -= 20
            
        c.save()
        
        print(f"✅ Email body PDF created successfully: {output_pdf}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to convert HTML to PDF: {str(e)}")
        return False

def convert_html_to_pdf(html_file_path: str, pdf_file_path: str) -> bool:
    """Convert HTML file to PDF using wkhtmltopdf"""
    try:
        # Detect if running in Docker (Linux) or Windows
        if os.name == 'posix':  # Linux/Mac (Docker)
            wkhtmltopdf_path = "wkhtmltopdf"  # Use system wkhtmltopdf
        else:  # Windows
            wkhtmltopdf_path = "lib/wkhtmltox/bin/wkhtmltopdf.exe"
        
        # Check if the executable exists (for Windows)
        if os.name != 'posix' and not os.path.exists(wkhtmltopdf_path):
            print(f"❌ wkhtmltopdf executable not found at {wkhtmltopdf_path}")
            return False
        
        # Build command
        cmd = [
            wkhtmltopdf_path,
            "--page-size", "Letter",
            "--margin-top", "0.75in",
            "--margin-right", "0.75in", 
            "--margin-bottom", "0.75in",
            "--margin-left", "0.75in",
            "--encoding", "UTF-8",
            "--no-outline",
            "--enable-local-file-access",
            html_file_path,
            pdf_file_path
        ]
        
        print("Executing wkhtmltopdf command:")
        print(" ".join(cmd))
        
        # Execute command
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print(f"✅ Converted HTML to PDF: {html_file_path} -> {pdf_file_path}")
            return True
        else:
            print(f"❌ Failed to convert HTML to PDF. Error code: {result.returncode}")
            print(f"Error output: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ PDF conversion timed out")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during PDF conversion: {str(e)}")
        return False

class EmailProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.mail = None
        self.printer_service = PrinterService()
        self.is_running = False

    def log_to_db(self, action: str, status: str, error_message: Optional[str] = None, order_id: Optional[int] = None):
        """Log actions to database"""
        log = ProcessingLog(
            order_id=order_id,
            action=action,
            status=status,
            error_message=error_message
        )
        self.db.add(log)
        try:
            self.db.commit()
            print(f"📝 Logged: {action} - {status}")
        except Exception as e:
            print(f"❌ Failed to log: {str(e)}")
            self.db.rollback()

    def parse_order_details(self, body: str) -> Dict:
        """Parse order details from email body"""
        # Extract PO Number
        # Handle variations:
        # - Collapsed lines: "PO Number: 22121Order Type: ..." → stop before "Order Type:"
        # - Alphanumeric POs: "1R (Replacement)" → keep "1R"
        # - Long numeric POs
        po_match = re.search(r"PO Number:\s*([^\r\n]+?)\s*(?=(?:\r?\n|Order Type:))", body, re.IGNORECASE)
        raw_po = po_match.group(1).strip() if po_match else None
        if raw_po:
            # Remove any parenthetical notes, e.g., "1R (Replacement)" → "1R"
            raw_po = re.sub(r"\(.*?\)", "", raw_po).strip()
            # If the collapsed text still ends with the word 'Order', drop it
            raw_po = re.sub(r"\s*Order$", "", raw_po, flags=re.IGNORECASE).strip()
            # Finally, allow alphanumeric and dashes/underscores only
            po_clean_match = re.match(r"([A-Za-z0-9_-]+)", raw_po)
            po_number = po_clean_match.group(1) if po_clean_match else raw_po
        else:
            po_number = None

        # Extract order types
        order_types = parse_order_types(body)
        
        # Extract quality check requirement
        requires_qc = "Yes" in re.search(r"Requires Quality Check:\s*(Yes|No)", body).group(1) if re.search(r"Requires Quality Check:", body) else False
        
        # Extract delivery address
        address_section = re.search(r"Delivery address:(.*?)(?=\n\n|\Z)", body, re.DOTALL)
        customer_name, delivery_address = parse_address(address_section.group(1)) if address_section else ("", "")
        
        # Extract shipping date
        date_match = re.search(r"Committed Shipping Date:\s*(.+?)(?:\n|$)", body)
        shipping_date = parse_date(date_match.group(1)) if date_match else datetime.utcnow()

        # Extract print jobs
        print_jobs = []
        # Support all order types from the mapping
        for job_type in ORDER_TYPE_MAPPING.keys():
            if job_type in order_types:
                # Find section for this job type
                section_match = re.search(rf"{job_type}.*?(?=\n\n|\Z)", body, re.DOTALL)
                if section_match:
                    section = section_match.group(0)
                    print_jobs.append({
                        "job_type": job_type,
                        "total_print_length": parse_print_length(section),
                        "gang_sheets": count_gang_sheets(section, job_type)
                    })

        order_type_string = " + ".join(order_types) if order_types else "Unknown"
        
        return {
            "po_number": po_number,
            "order_type": order_type_string,
            "requires_quality_check": requires_qc,
            "customer_name": customer_name,
            "delivery_address": delivery_address,
            "committed_shipping_date": shipping_date,
            "print_jobs": print_jobs
        }

    async def monitor_emails(self):
        # Get email config from database
        email_config = self.db.query(EmailConfigModel).first()
        if not email_config:
            print("❌ No email configuration found in database")
            return
            
        EMAIL = email_config.email_address
        PASSWORD = email_config.email_password
        ALLOWED_SENDER = email_config.allowed_senders.split(',')[0] if email_config.allowed_senders else None
        POLL_INTERVAL = email_config.sleep_time

        try:
            print(f"\n🔄 EmailProcessor.monitor_emails() started with is_running={self.is_running}")
            print("\n📧 Connecting to Gmail...")
            print(f"Checking inbox of: {EMAIL}")
            print(f"Looking for emails from: {ALLOWED_SENDER}")
            
            self.mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, 
                                        ssl_context=ssl.create_default_context())
            self.mail.login(EMAIL, PASSWORD)
            print("✅ Login successful!")
            self.log_to_db("Email Connection", "success")

            while self.is_running:
                try:
                    # Re-select inbox each time to refresh connection
                    self.mail.select("inbox")
                    print("\n🔍 Checking for unread emails...")

                    # Search for unread emails
                    status, messages = self.mail.search(None, 'UNSEEN')
                    if status != 'OK':
                        print("⚠️ Failed to search emails, reconnecting...")
                        # Reconnect and try again
                        self.mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, 
                                                    ssl_context=ssl.create_default_context())
                        self.mail.login(EMAIL, PASSWORD)
                        self.mail.select("inbox")
                        status, messages = self.mail.search(None, 'UNSEEN')
                    
                    email_ids = messages[0].split()

                    if email_ids:
                        print(f"📩 Found {len(email_ids)} unread emails")
                        for e_id in email_ids:
                            try:
                                status, msg_data = self.mail.fetch(e_id, '(RFC822)')
                                if status != 'OK':
                                    print(f"⚠️ Failed to fetch email {e_id}, skipping...")
                                    continue
                                    
                                email_body = msg_data[0][1]
                                email_message = email.message_from_bytes(email_body)
                            except Exception as e:
                                print(f"❌ Error fetching email {e_id}: {str(e)}")
                                continue

                        sender = email_message['from']
                        recipient = email_message['to']
                        subject = decode_email_subject(email_message['subject'])

                        print(f"\n📨 Email Details:")
                        print(f"From: {sender}")
                        print(f"To: {recipient}")
                        print(f"Subject: {subject}")

                        if ALLOWED_SENDER in sender:
                            print("✅ Sender is in allowed list!")
                            body = get_email_body(email_message)
                            print("\n📝 Email Body:")
                            print(body if body else "(No plain text body found)")

                            try:
                                # Parse order details
                                order_details = self.parse_order_details(body)
                                print("\n📦 Order Details:")
                                print(f"PO Number: {order_details['po_number']}")
                                print(f"Order Type: {order_details['order_type']}")
                                print(f"Customer: {order_details['customer_name']}")

                                # Check if order with this PO number already exists
                                existing_order = self.db.query(Order).filter(Order.po_number == order_details['po_number']).first()
                                
                                if existing_order:
                                    print(f"⚠️ Order with PO number {order_details['po_number']} already exists (ID: {existing_order.id}). Skipping duplicate.")
                                    continue

                                # Create folder
                                sanitized_customer_name = sanitize_folder_name(order_details['customer_name'])
                                folder_path = os.path.join(settings.ATTACHMENTS_FOLDER, f"{order_details['po_number']}_{sanitized_customer_name}")
                                os.makedirs(folder_path, exist_ok=True)
                                print(f"📁 Created folder: {folder_path}")

                                # Save order to database
                                order = Order(
                                    po_number=order_details['po_number'],
                                    order_type=order_details['order_type'],
                                    requires_quality_check=order_details['requires_quality_check'],
                                    customer_name=order_details['customer_name'],
                                    delivery_address=order_details['delivery_address'],
                                    committed_shipping_date=order_details['committed_shipping_date'],
                                    email_id=e_id.decode(),
                                    status="processing",
                                    folder_path=folder_path
                                )
                                print("💾 Saving order to database...")
                                try:
                                    self.db.add(order)
                                    self.db.commit()
                                    print("✅ Order saved successfully")
                                except IntegrityError as e:
                                    self.db.rollback()
                                    print(f"⚠️ Order with PO number {order_details['po_number']} already exists (database constraint). Skipping duplicate.")
                                    continue
                                
                                # Broadcast new order via WebSocket
                                await self.broadcast_new_order(order)

                                # Save print jobs
                                for job in order_details['print_jobs']:
                                    print_job = PrintJob(
                                        order_id=order.id,
                                        job_type=job['job_type'],
                                        total_print_length=job['total_print_length'],
                                        gang_sheets=job['gang_sheets'],
                                        status="pending"
                                    )
                                    self.db.add(print_job)
                                print("💾 Saving print jobs...")
                                self.db.commit()
                                print("✅ Print jobs saved successfully")

                                # Process attachments
                                await self.process_attachments(email_message, order)
                                
                                # Process download URLs from email body
                                await self.process_download_urls(email_message, order)
                                
                                # Create email body PDF
                                await self.create_email_body_pdf(email_message, order, body)
                                
                                # Update order status
                                order.status = "completed"
                                self.db.commit()
                                print(f"✅ Order {order_details['po_number']} processed successfully")
                                
                                # Broadcast order completion via WebSocket
                                await self.broadcast_order_update(order)

                            except Exception as e:
                                print(f"❌ Error processing order: {str(e)}")
                                self.log_to_db("Order Processing", "failed", str(e))
                                continue

                        else:
                            print(f"❌ Sender not allowed! Expected: {ALLOWED_SENDER}, Got: {sender}")
                    else:
                        print("📭 No unread emails found")

                    print(f"\n⏳ Waiting {POLL_INTERVAL} seconds before next check...")
                    await asyncio.sleep(POLL_INTERVAL)

                except imaplib.IMAP4.error as e:
                    print(f"⚠️ IMAP error: {str(e)}, reconnecting...")
                    try:
                        self.mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, 
                                                    ssl_context=ssl.create_default_context())
                        self.mail.login(EMAIL, PASSWORD)
                    except Exception as e:
                        print(f"❌ Failed to reconnect: {str(e)}")
                        await asyncio.sleep(POLL_INTERVAL)
                except Exception as e:
                    print(f"❌ Unexpected error: {str(e)}")
                    await asyncio.sleep(POLL_INTERVAL)

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Error: {error_msg}")
            self.log_to_db("Email Processing", "failed", error_msg)
            if "Invalid credentials" in error_msg:
                print("\n⚠️ Check that you're using an App Password, not your regular Gmail password!")
        
    

    async def process_attachments(self, email_msg: email.message.Message, order: Order):
        for part in email_msg.walk():
            if part.get_content_disposition() == 'attachment':
                filename = part.get_filename()
                if filename:
                    original_file_path = os.path.join(order.folder_path, filename)
                    print(f"\n📎 Processing attachment: {filename}")
                    
                    # Save original file
                    with open(original_file_path, 'wb') as f:
                        f.write(part.get_payload(decode=True))
                    print(f"✅ Saved original file: {original_file_path}")

                    try:
                        # Determine sheet type and number from filename
                        sheet_type = None
                        sheet_number = None
                        # Check all supported order types
                        for job_type in ORDER_TYPE_MAPPING.keys():
                            if job_type in filename:
                                sheet_type = f"{job_type} Gang Sheet"
                                num_match = re.search(r"#(\d+)", filename)
                                sheet_number = int(num_match.group(1)) if num_match else 1
                                break

                        # Convert to PDF if it's an image
                        pdf_file_path = None
                        file_extension = filename.split('.')[-1].lower()
                        
                        if file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp']:
                            # Convert image to 4x6 PDF label
                            pdf_filename = f"{filename.rsplit('.', 1)[0]}_label.pdf"
                            pdf_file_path = os.path.join(order.folder_path, pdf_filename)
                            
                            print(f"🔄 Converting image to PDF: {pdf_file_path}")
                            if convert_image_to_4x6_pdf(original_file_path, pdf_file_path):
                                print(f"✅ PDF conversion successful")
                            else:
                                print(f"❌ PDF conversion failed, keeping original file")
                                pdf_file_path = original_file_path
                        elif file_extension == 'pdf':
                            # Already a PDF, use as-is
                            pdf_file_path = original_file_path
                            print(f"✅ File is already PDF format")
                        else:
                            # Unknown format, keep original
                            pdf_file_path = original_file_path
                            print(f"⚠️ Unknown file format, keeping original")

                        # Save attachment record
                        attachment = Attachment(
                            order_id=order.id,
                            file_name=filename,
                            file_path=original_file_path,  # Always store original file path
                            pdf_path=pdf_file_path if pdf_file_path and pdf_file_path.endswith('.pdf') else None,
                            file_type=file_extension,
                            print_status="pending",
                            sheet_type=sheet_type,
                            sheet_number=sheet_number
                        )
                        self.db.add(attachment)
                        self.db.commit()
                        print(f"✅ Attachment record saved to database")

                        # Print attachment
                        await self.printer_service.print_file(attachment)
                        
                    except Exception as e:
                        print(f"❌ Failed to process attachment: {str(e)}")
                        self.log_to_db("Attachment Processing", "failed", str(e), order.id)

    async def process_download_urls(self, email_msg: email.message.Message, order: Order):
        """Process download URLs from email body HTML"""
        try:
            # Extract HTML body
            html_body = get_email_html_body(email_msg)
            if not html_body:
                print("ℹ️ No HTML body found, skipping URL downloads")
                return
            
            # Extract download URLs
            download_links = extract_download_urls_from_html(html_body)
            
            if not download_links:
                print("ℹ️ No download links found in email")
                return
            
            print(f"\n🔗 Found {len(download_links)} download link(s) in email")
            
            # Process each download link
            for idx, link_info in enumerate(download_links, 1):
                url = link_info['url']
                link_text = link_info['link_text']
                context = link_info['context']
                
                print(f"\n📥 Processing download {idx}/{len(download_links)}")
                print(f"Link text: {link_text}")
                print(f"URL: {url}")
                
                # Detect order type and sheet number from context
                type_info = detect_order_type_from_context(context, link_text)
                
                if type_info:
                    order_type, sheet_number = type_info
                    print(f"Detected: {order_type} Gang Sheet #{sheet_number}")
                    
                    # Generate filename
                    internal_type = ORDER_TYPE_MAPPING.get(order_type, "unknown")
                    base_filename = get_filename_from_url(url, f"{internal_type}_sheet_{sheet_number}")
                    
                    # Ensure unique filename
                    file_path = os.path.join(order.folder_path, base_filename)
                    counter = 1
                    while os.path.exists(file_path):
                        name, ext = os.path.splitext(base_filename)
                        file_path = os.path.join(order.folder_path, f"{name}_{counter}{ext}")
                        counter += 1
                    
                    # Download the file
                    if await download_file_from_url(url, file_path):
                        # Determine file type
                        file_extension = base_filename.split('.')[-1].lower()
                        
                        # Convert to PDF if it's an image
                        pdf_file_path = None
                        if file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp']:
                            pdf_filename = f"{os.path.splitext(os.path.basename(file_path))[0]}_label.pdf"
                            pdf_file_path = os.path.join(order.folder_path, pdf_filename)
                            
                            print(f"🔄 Converting downloaded image to PDF: {pdf_file_path}")
                            if convert_image_to_4x6_pdf(file_path, pdf_file_path):
                                print(f"✅ PDF conversion successful")
                            else:
                                print(f"❌ PDF conversion failed, keeping original file")
                                pdf_file_path = file_path
                        elif file_extension == 'pdf':
                            pdf_file_path = file_path
                        else:
                            pdf_file_path = file_path
                        
                        # Save attachment record
                        attachment = Attachment(
                            order_id=order.id,
                            file_name=os.path.basename(file_path),
                            file_path=file_path,
                            pdf_path=pdf_file_path if pdf_file_path and pdf_file_path.endswith('.pdf') else None,
                            file_type=file_extension,
                            print_status="pending",
                            sheet_type=f"{order_type} Gang Sheet",
                            sheet_number=sheet_number
                        )
                        self.db.add(attachment)
                        self.db.commit()
                        print(f"✅ Download saved to database")
                        
                        # Print the downloaded file
                        await self.printer_service.print_file(attachment)
                    else:
                        print(f"❌ Failed to download file from URL")
                        self.log_to_db("URL Download", "failed", f"Failed to download: {url}", order.id)
                else:
                    print(f"⚠️ Could not detect order type from context, skipping download")
                    print(f"Context: {context[:200]}...")
                    
        except Exception as e:
            print(f"❌ Error processing download URLs: {str(e)}")
            self.log_to_db("URL Processing", "failed", str(e), order.id)

    async def create_email_body_pdf(self, email_msg: email.message.Message, order: Order, email_body: str):
        """Create PDF from email body content"""
        try:
            # Create HTML file from email body
            html_content = f"""
            <html>
            <head>
                <title>Order {order.po_number}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; }}
                    h1 {{ color: #333; }}
                    .order-info {{ background-color: #f5f5f5; padding: 15px; margin: 10px 0; }}
                    .print-job {{ border-left: 3px solid #007bff; padding-left: 10px; margin: 10px 0; }}
                </style>
            </head>
            <body>
                <h1>Order Details - {order.po_number}</h1>
                <div class="order-info">
                    <h3>Customer: {order.customer_name}</h3>
                    <p><strong>Order Type:</strong> {order.order_type}</p>
                    <p><strong>Delivery Address:</strong></p>
                    <pre>{order.delivery_address}</pre>
                    <p><strong>Shipping Date:</strong> {order.committed_shipping_date}</p>
                    <p><strong>Quality Check Required:</strong> {'Yes' if order.requires_quality_check else 'No'}</p>
                </div>
                
                <h2>Email Content</h2>
                <div class="print-job">
                    <pre>{email_body}</pre>
                </div>
                <p><em>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</em></p>
            </body>
            </html>
            
            """
            
            # Save HTML file
            html_filename = f"{order.po_number}_email_body.html"
            html_file_path = os.path.join(order.folder_path, html_filename)
            
            with open(html_file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"📄 Created HTML file: {html_file_path}")
            
            # Convert HTML to PDF
            pdf_filename = f"{order.po_number}_email_body.pdf"
            pdf_file_path = os.path.join(order.folder_path, pdf_filename)
            
            print(f"🔄 Converting email body to PDF: {pdf_file_path}")
            
            # Try wkhtmltopdf first, fallback to simple PDF
            if convert_html_to_pdf(html_file_path, pdf_file_path):
                print(f"✅ Email body PDF created successfully")
            else:
                # Fallback: create simple PDF with ReportLab
                print(f"⚠️ wkhtmltopdf failed, using ReportLab fallback")
                if convert_html_to_letter_pdf(email_body, pdf_file_path):
                    print(f"✅ Email body PDF created with ReportLab")
                else:
                    print(f"❌ Failed to create email body PDF")
                    return
            
            # Save email body attachment record
            email_attachment = Attachment(
                order_id=order.id,
                file_name=pdf_filename,
                file_path=pdf_file_path,
                file_type="pdf",
                print_status="pending",
                sheet_type="Email Body",
                sheet_number=1
            )
            self.db.add(email_attachment)
            self.db.commit()
            print(f"✅ Email body PDF record saved to database")
            
            # Print email body PDF
            await self.printer_service.print_file(email_attachment)
            
        except Exception as e:
            print(f"❌ Failed to create email body PDF: {str(e)}")
            self.log_to_db("Email Body PDF Creation", "failed", str(e), order.id)

    async def start_processing(self):
        print("🔄 EmailProcessor.start_processing() called")
        self.is_running = True
        print(f"✅ EmailProcessor.is_running set to {self.is_running}")
        await self.monitor_emails()

    def stop_processing(self):
        print("🛑 Stopping email processing service...")
        self.is_running = False

    async def broadcast_new_order(self, order: Order):
        """Broadcast a new order to all connected WebSocket clients"""
        try:
            order_data = {
                "id": order.id,
                "po_number": order.po_number,
                "order_type": order.order_type,
                "customer_name": order.customer_name,
                "delivery_address": order.delivery_address,
                "committed_shipping_date": order.committed_shipping_date.isoformat() if order.committed_shipping_date else None,
                "processed_time": order.processed_time.isoformat() if order.processed_time else None,
                "status": order.status,
                "folder_path": order.folder_path
            }
            await manager.broadcast_order_update(order_data)
            print(f"📡 Broadcasted new order: {order.po_number}")
        except Exception as e:
            print(f"❌ Failed to broadcast new order: {str(e)}")

    async def broadcast_order_update(self, order: Order):
        """Broadcast an order update to all connected WebSocket clients"""
        try:
            order_data = {
                "id": order.id,
                "po_number": order.po_number,
                "order_type": order.order_type,
                "customer_name": order.customer_name,
                "delivery_address": order.delivery_address,
                "committed_shipping_date": order.committed_shipping_date.isoformat() if order.committed_shipping_date else None,
                "processed_time": order.processed_time.isoformat() if order.processed_time else None,
                "status": order.status,
                "folder_path": order.folder_path
            }
            await manager.broadcast_order_update(order_data)
            print(f"📡 Broadcasted order update: {order.po_number} - {order.status}")
        except Exception as e:
            print(f"❌ Failed to broadcast order update: {str(e)}")