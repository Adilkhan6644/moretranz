from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, index=True)
    order_type = Column(String(255))  # Comma-separated list of types (DTF, Sublimation, ProColor, Glitter)
    requires_quality_check = Column(Boolean, default=False)
    customer_name = Column(String(255))
    delivery_address = Column(Text)
    committed_shipping_date = Column(DateTime)
    processed_time = Column(DateTime, default=datetime.utcnow)
    email_id = Column(String(255))
    status = Column(String(50))  # pending, processing, completed, failed
    folder_path = Column(String(255))
    
    # Relationships
    print_jobs = relationship("PrintJob", back_populates="order")
    attachments = relationship("Attachment", back_populates="order")
    processing_logs = relationship("ProcessingLog", back_populates="order")

class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    job_type = Column(String(50))  # DTF, Sublimation, ProColor, Glitter
    total_print_length = Column(Float)  # in inches
    gang_sheets = Column(Integer)  # number of gang sheets
    status = Column(String(50))  # pending, printing, completed, failed
    
    # Relationship
    order = relationship("Order", back_populates="print_jobs")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    file_name = Column(String(255))
    file_path = Column(String(255))  # Original file path
    pdf_path = Column(String(255))   # PDF version path
    file_type = Column(String(50))  # pdf, png, jpg, etc.
    print_status = Column(String(50))  # pending, printed, failed
    sheet_type = Column(String(50))  # DTF Gang Sheet, Sublimation Gang Sheet, etc.
    sheet_number = Column(Integer)  # Sheet number (1, 2, etc.)
    
    # Relationship
    order = relationship("Order", back_populates="attachments")

class ProcessingLog(Base):
    __tablename__ = "processing_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(String(100))
    status = Column(String(50))
    error_message = Column(Text, nullable=True)
    
    # Relationship
    order = relationship("Order", back_populates="processing_logs")

class EmailConfig(Base):
    __tablename__ = "email_config"

    id = Column(Integer, primary_key=True, index=True)
    email_address = Column(String(255))
    email_password = Column(String(255))
    imap_server = Column(String(255))
    allowed_senders = Column(Text)  # Stored as comma-separated string
    max_age_days = Column(Integer)
    sleep_time = Column(Integer)
    # Auto-download settings
    auto_download_enabled = Column(Boolean, default=False)
    download_path = Column(String(500), nullable=True)  # Path where files should be saved
    last_updated = Column(DateTime, default=datetime.utcnow)

class PrinterConfig(Base):
    __tablename__ = "printer_config"

    id = Column(Integer, primary_key=True, index=True)
    printer_name = Column(String(255))
    printer_type = Column(String(50))  # body or attachment
    is_active = Column(Integer, default=1)
    last_updated = Column(DateTime, default=datetime.utcnow)
    