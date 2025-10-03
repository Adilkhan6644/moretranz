from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.order import EmailConfig, PrinterConfig
from app.models.order import EmailConfig as EmailConfigModel
from app.models.order import PrinterConfig as PrinterConfigModel
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()

class EmailConfigUpdate(BaseModel):
    email_address: str
    email_password: str
    imap_server: str = "imap.gmail.com"
    allowed_senders: str
    max_age_days: int = 10
    sleep_time: int = 5

class EmailConfigResponse(BaseModel):
    email_address: str
    imap_server: str
    allowed_senders: str
    max_age_days: int
    sleep_time: int

@router.get("/email", response_model=EmailConfigResponse)
def get_email_config(db: Session = Depends(get_db)):
    """Get current email configuration"""
    config = db.query(EmailConfigModel).first()
    if not config:
        return {
            "email_address": "",
            "imap_server": "imap.gmail.com",
            "allowed_senders": "",
            "max_age_days": 10,
            "sleep_time": 5
        }
    return {
        "email_address": config.email_address,
        "imap_server": config.imap_server,
        "allowed_senders": config.allowed_senders,
        "max_age_days": config.max_age_days,
        "sleep_time": config.sleep_time
    }

@router.put("/email")
def update_email_config(config: EmailConfigUpdate, db: Session = Depends(get_db)):
    """Update email configuration"""
    db_config = db.query(EmailConfigModel).first()
    if not db_config:
        # Create new config if none exists
        db_config = EmailConfigModel(
            email_address=config.email_address,
            email_password=config.email_password,
            imap_server=config.imap_server,
            allowed_senders=config.allowed_senders,
            max_age_days=config.max_age_days,
            sleep_time=config.sleep_time
        )
        db.add(db_config)
    else:
        # Update existing config
        db_config.email_address = config.email_address
        db_config.email_password = config.email_password
        db_config.imap_server = config.imap_server
        db_config.allowed_senders = config.allowed_senders
        db_config.max_age_days = config.max_age_days
        db_config.sleep_time = config.sleep_time
    
    db.commit()
    return {"status": "Email configuration updated successfully"}

@router.get("/printers", response_model=List[PrinterConfig])
def get_printer_configs(db: Session = Depends(get_db)):
    return db.query(PrinterConfigModel).all()

@router.put("/printers/{printer_id}", response_model=PrinterConfig)
def update_printer_config(
    printer_id: int,
    config: PrinterConfig,
    db: Session = Depends(get_db)
):
    db_config = db.query(PrinterConfigModel).filter(PrinterConfigModel.id == printer_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Printer configuration not found")
    
    for key, value in config.dict().items():
        setattr(db_config, key, value)
    
    db.commit()
    db.refresh(db_config)
    return db_config