import os
import subprocess
import asyncio
from app.models.order import Attachment
from app.core.config import settings

class PrinterService:
    def __init__(self):
        # Detect OS and set appropriate paths
        if os.name == 'posix':  # Linux/Mac (Docker)
            self.sumatra_path = None  # Not available in Linux
            self.wkhtmltopdf_path = "wkhtmltopdf"
            self.is_docker = True
        else:  # Windows
            self.sumatra_path = "lib/sumatrapdf.exe"
            self.wkhtmltopdf_path = "lib/wkhtmltox/bin/wkhtmltopdf.exe"
            self.is_docker = False

    async def print_file(self, attachment: Attachment) -> bool:
        try:
            file_path = attachment.file_path
            file_type = attachment.file_type.lower()
            
            if file_type in ['pdf', 'png', 'jpg', 'jpeg']:
                # In Docker, simulate printing (no printer access)
                if self.is_docker:
                    print(f"🖨️ PRINT SIMULATION: Sending {file_path} to printer")
                    print(f"   📄 File: {attachment.file_name}")
                    print(f"   🏷️ Type: {file_type.upper()}")
                    print(f"   📏 Size: {os.path.getsize(file_path) if os.path.exists(file_path) else 'Unknown'} bytes")
                    print(f"   🖨️ Printer: {'Attachment Printer' if self.is_label_file(file_path) else 'Body Printer'}")
                    print(f"   ✅ Print job simulated successfully!")
                    return True  # Return True to not block processing
                
                printer_name = (settings.ATTACHMENT_PRINTER 
                              if self.is_label_file(file_path) 
                              else settings.BODY_PRINTER)
                
                return await self.print_with_sumatra(file_path, printer_name)
            
            return False
        except Exception as e:
            print(f"Print error: {str(e)}")
            return False

    def is_label_file(self, file_path: str) -> bool:
        # Implement logic to determine if file is a shipping label
        # This could be based on file name, size, or content
        return "label" in file_path.lower()

    async def print_with_sumatra(self, file_path: str, printer_name: str) -> bool:
        try:
            command = [
                self.sumatra_path,
                "-print-to", printer_name,
                "-print-settings", "noscale",
                file_path
            ]
            
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            return process.returncode == 0
        except Exception as e:
            print(f"SumatraPDF error: {str(e)}")
            return False

    async def convert_html_to_pdf(self, html_path: str, pdf_path: str) -> bool:
        try:
            command = [
                self.wkhtmltopdf_path,
                '--page-size', 'Letter',
                '--enable-smart-shrinking',
                '--no-outline',
                '--print-media-type',
                html_path,
                pdf_path
            ]
            
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            return process.returncode == 0
        except Exception as e:
            print(f"wkhtmltopdf error: {str(e)}")
            return False
