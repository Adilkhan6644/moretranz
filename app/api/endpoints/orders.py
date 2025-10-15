from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from app.db.session import get_db
from app.schemas.order import Order, OrderCreate
from app.services.email_processor import EmailProcessor
from app.services.scheduler import email_scheduler
from app.models.order import Order as OrderModel, Attachment, PrintJob, ProcessingLog
from app.websocket_manager import manager
from app.api.endpoints.auth import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[Order])
def get_orders(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get all processed orders with optional PO number search"""
    query = db.query(OrderModel)
    
    # Add search filter if provided
    if search:
        query = query.filter(OrderModel.po_number.ilike(f"%{search}%"))
    
    orders = query.order_by(OrderModel.processed_time.desc()).offset(skip).limit(limit).all()
    return orders

@router.get("/latest", response_model=Order)
def get_latest_order(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Get the most recently processed order"""
    order = db.query(OrderModel).order_by(OrderModel.processed_time.desc()).first()
    if not order:
        raise HTTPException(status_code=404, detail="No orders found")
    return order

@router.get("/processing-status")
async def get_processing_status():
    """Get the current status of email processing"""
    status = email_scheduler.get_status()
    return {
        "status": "running" if status["is_running"] else "stopped",
        "is_processing": status["is_running"],
        "scheduler_running": status["scheduler_running"],
        "jobs": status["jobs"]
    }

@router.get("/{order_id}", response_model=Order)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Get a specific order by ID"""
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Delete a specific order by ID"""
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    try:
        # Delete associated records first (attachments, print jobs, processing logs)
        db.query(Attachment).filter(Attachment.order_id == order_id).delete()
        db.query(PrintJob).filter(PrintJob.order_id == order_id).delete()
        db.query(ProcessingLog).filter(ProcessingLog.order_id == order_id).delete()
        
        # Delete the order
        db.delete(order)
        db.commit()
        
        print(f"🗑️ Order {order.po_number} (ID: {order_id}) deleted successfully")
        return {"message": f"Order {order.po_number} deleted successfully"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error deleting order {order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting order: {str(e)}")

@router.get("/attachments/{attachment_id}")
def get_attachment_info(attachment_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Get attachment information"""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "file_type": attachment.file_type,
        "file_path": attachment.file_path,
        "sheet_type": attachment.sheet_type,
        "sheet_number": attachment.sheet_number,
        "print_status": attachment.print_status,
        "file_exists": os.path.exists(attachment.file_path) if attachment.file_path else False
    }

@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int, 
    format: str = "pdf",  # Default to PDF
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Download an attachment file. Use format=original to get original file."""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Determine which file to serve
    if format == "pdf" and attachment.pdf_path:
        file_path = attachment.pdf_path
        file_name = os.path.splitext(attachment.file_name)[0] + '.pdf'
    else:
        file_path = attachment.file_path
        # For original files, ensure we use the original filename with proper extension
        file_name = attachment.file_name
        # If the stored filename doesn't have an extension, add one based on file_type
        if not os.path.splitext(file_name)[1] and attachment.file_type:
            file_name = f"{os.path.splitext(file_name)[0]}.{attachment.file_type}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Get file extension for proper MIME type
    file_extension = os.path.splitext(file_path)[1].lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.txt': 'text/plain',
        '.html': 'text/html'
    }
    
    media_type = media_types.get(file_extension, 'application/octet-stream')
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=file_name,
        headers={"Content-Disposition": f"attachment; filename={file_name}"}
    )

@router.post("/start-processing")
async def start_processing(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Start the email processing service"""
    if email_scheduler.is_running:
        return {"status": "Email processing is already running"}
    
    # Get email config and validate credentials
    from app.models.order import EmailConfig as EmailConfigModel
    email_config = db.query(EmailConfigModel).first()
    
    if not email_config:
        raise HTTPException(
            status_code=400, 
            detail="Email configuration not found. Please configure email settings first."
        )
    
    if not email_config.email_address or not email_config.email_password:
        raise HTTPException(
            status_code=400,
            detail="Email credentials not configured. Please set up email address and password."
        )
    
    # Validate credentials before starting
    import imaplib
    try:
        mail = imaplib.IMAP4_SSL(email_config.imap_server)
        mail.login(email_config.email_address, email_config.email_password)
        mail.select('INBOX')
        mail.close()
        mail.logout()
    except imaplib.IMAP4.error as e:
        error_msg = str(e).replace('b\'', '').replace('\'', '')
        if "AUTHENTICATIONFAILED" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="Invalid email credentials. Please check your email settings and ensure you're using an App Password for Gmail."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Email connection failed: {error_msg}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to validate email credentials: {str(e)}"
        )
    
    sleep_time = email_config.sleep_time
    await email_scheduler.start_processing(sleep_time)
    return {"status": "Email processing started successfully"}

@router.post("/stop-processing")
async def stop_processing(_: User = Depends(get_current_user)):
    """Stop the email processing service"""
    if not email_scheduler.is_running:
        return {"status": "Email processing is not running"}
        
    await email_scheduler.stop_processing()
    return {"status": "Email processing stopped"}

@router.post("/{order_id}/print-attachments")
async def print_order_attachments(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Manually print all attachments for an order"""
    from app.services.printer_service import PrinterService
    
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    attachments = db.query(Attachment).filter(Attachment.order_id == order_id).all()
    if not attachments:
        return {"status": "No attachments found for this order"}
    
    printer_service = PrinterService()
    print_results = []
    
    for attachment in attachments:
        try:
            success = await printer_service.print_file(attachment)
            print_results.append({
                "attachment_id": attachment.id,
                "file_name": attachment.file_name,
                "print_status": "success" if success else "failed"
            })
        except Exception as e:
            print_results.append({
                "attachment_id": attachment.id,
                "file_name": attachment.file_name,
                "print_status": "error",
                "error": str(e)
            })
    
    return {
        "status": "Print job completed",
        "order_id": order_id,
        "po_number": order.po_number,
        "results": print_results
    }

@router.post("/attachments/{attachment_id}/print")
async def print_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Manually print a specific attachment"""
    from app.services.printer_service import PrinterService
    
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    printer_service = PrinterService()
    
    try:
        success = await printer_service.print_file(attachment)
        return {
            "status": "success" if success else "failed",
            "attachment_id": attachment_id,
            "file_name": attachment.file_name,
            "message": "Print job sent successfully" if success else "Print job failed"
        }
    except Exception as e:
        return {
            "status": "error",
            "attachment_id": attachment_id,
            "file_name": attachment.file_name,
            "error": str(e)
        }

async def broadcast_status_update(status_data: dict):
    """Broadcast status update to all connected WebSocket clients"""
    try:
        await manager.broadcast_status_update(status_data)
        print(f"📡 Broadcasted status update: {status_data}")
    except Exception as e:
        print(f"❌ Failed to broadcast status update: {str(e)}")
    