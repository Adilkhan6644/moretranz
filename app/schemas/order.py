from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class AttachmentBase(BaseModel):
    file_name: str
    file_type: str
    print_status: str

class AttachmentCreate(AttachmentBase):
    pass

class Attachment(AttachmentBase):
    id: int
    order_id: int
    file_path: str

    class Config:
        from_attributes = True

class ProcessingLogBase(BaseModel):
    action: str
    status: str
    error_message: Optional[str] = None

class ProcessingLogCreate(ProcessingLogBase):
    pass

class ProcessingLog(ProcessingLogBase):
    id: int
    order_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    po_number: Optional[str] = None
    order_type: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    committed_shipping_date: Optional[datetime] = None
    status: Optional[str] = None
    folder_path: Optional[str] = None

class OrderCreate(OrderBase):
    email_id: str

class Order(OrderBase):
    id: int
    processed_time: Optional[datetime] = None
    attachments: List[Attachment] = []
    processing_logs: List[ProcessingLog] = []

    class Config:
        from_attributes = True

class EmailConfigBase(BaseModel):
    email_address: str
    imap_server: str
    allowed_senders: str
    max_age_days: int
    sleep_time: int
    auto_download_enabled: bool = False
    download_path: Optional[str] = None

class EmailConfigCreate(EmailConfigBase):
    pass

class EmailConfig(EmailConfigBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True

class PrinterConfigBase(BaseModel):
    printer_name: str
    printer_type: str
    is_active: int

class PrinterConfigCreate(PrinterConfigBase):
    pass

class PrinterConfig(PrinterConfigBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True

class ProcessingStatus(BaseModel):
    status: str
    is_processing: bool
