from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from app.db.session import get_db
from app.schemas.order import Order, OrderCreate
from app.services.email_processor import EmailProcessor
from app.models.order import Order as OrderModel, Attachment, PrintJob, ProcessingLog
from app.websocket_manager import manager

router = APIRouter()

@router.get("/", response_model=List[Order])
def get_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all processed orders"""
    orders = db.query(OrderModel).order_by(OrderModel.processed_time.desc()).offset(skip).limit(limit).all()
    return orders

@router.get("/latest", response_model=Order)
def get_latest_order(db: Session = Depends(get_db)):
    """Get the most recently processed order"""
    order = db.query(OrderModel).order_by(OrderModel.processed_time.desc()).first()
    if not order:
        raise HTTPException(status_code=404, detail="No orders found")
    return order

@router.get("/processing-status")
async def get_processing_status():
    """Get the current status of email processing"""
    global email_processor
    if email_processor and email_processor.is_running:
        print(f"🔍 Status check: Email processor is running (is_running={email_processor.is_running})")
        return {"status": "running", "is_processing": True}
    print(f"🔍 Status check: Email processor is stopped (email_processor={email_processor is not None}, is_running={email_processor.is_running if email_processor else 'N/A'})")
    return {"status": "stopped", "is_processing": False}

@router.get("/{order_id}", response_model=Order)
def get_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific order by ID"""
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db)
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
def get_attachment_info(attachment_id: int, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
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
        file_name = attachment.file_name
    
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

email_processor = None

@router.post("/start-processing")
async def start_processing(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start the email processing service"""
    global email_processor
    if email_processor and email_processor.is_running:
        print("🚫 Start processing: Already running")
        return {"status": "Email processing is already running"}
    
    print("🚀 Starting email processing service...")
    email_processor = EmailProcessor(db)
    email_processor.is_running = True
    print(f"✅ Email processor created with is_running={email_processor.is_running}")
    background_tasks.add_task(email_processor.start_processing)
    print("📋 Background task added")
    
    # Broadcast status update via WebSocket
    background_tasks.add_task(broadcast_status_update, {"status": "running", "is_processing": True})
    
    return {"status": "Email processing started"}

@router.post("/stop-processing")
async def stop_processing():
    """Stop the email processing service"""
    global email_processor
    if email_processor:
        email_processor.stop_processing()
        # Broadcast status update via WebSocket
        await broadcast_status_update({"status": "stopped", "is_processing": False})
        return {"status": "Email processing stopped"}
    return {"status": "No email processor running"}

async def broadcast_status_update(status_data: dict):
    """Broadcast status update to all connected WebSocket clients"""
    try:
        await manager.broadcast_status_update(status_data)
        print(f"📡 Broadcasted status update: {status_data}")
    except Exception as e:
        print(f"❌ Failed to broadcast status update: {str(e)}")
    