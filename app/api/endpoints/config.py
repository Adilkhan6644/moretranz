from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.schemas.order import EmailConfig, PrinterConfig
from app.models.order import EmailConfig as EmailConfigModel
from app.models.order import PrinterConfig as PrinterConfigModel
from pydantic import BaseModel
from app.core.config import settings
from app.api.endpoints.auth import get_current_user
from app.models.user import User
import imaplib

router = APIRouter()

class EmailConfigUpdate(BaseModel):
    email_address: str
    email_password: str
    imap_server: str = "imap.gmail.com"
    allowed_senders: str
    max_age_days: int = 10
    sleep_time: int = 5
    auto_download_enabled: bool = False
    download_path: Optional[str] = None

class EmailConfigResponse(BaseModel):
    email_address: str
    imap_server: str
    allowed_senders: str
    max_age_days: int
    sleep_time: int
    auto_download_enabled: bool
    download_path: Optional[str]

class EmailValidationRequest(BaseModel):
    email_address: str
    email_password: str
    imap_server: str = "imap.gmail.com"

class EmailValidationResponse(BaseModel):
    valid: bool
    message: str

@router.get("/email", response_model=EmailConfigResponse)
def get_email_config(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Get current email configuration"""
    config = db.query(EmailConfigModel).first()
    if not config:
        return {
            "email_address": "",
            "imap_server": "imap.gmail.com",
            "allowed_senders": "",
            "max_age_days": 10,
            "sleep_time": 5,
            "auto_download_enabled": False,
            "download_path": None
        }
    return {
        "email_address": config.email_address,
        "imap_server": config.imap_server,
        "allowed_senders": config.allowed_senders,
        "max_age_days": config.max_age_days,
        "sleep_time": config.sleep_time,
        "auto_download_enabled": config.auto_download_enabled or False,
        "download_path": config.download_path
    }

@router.put("/email")
def update_email_config(config: EmailConfigUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Update email configuration"""
    from app.services.scheduler import email_scheduler
    
    db_config = db.query(EmailConfigModel).first()
    old_sleep_time = db_config.sleep_time if db_config else 5
    
    if not db_config:
        # Create new config if none exists
        db_config = EmailConfigModel(
            email_address=config.email_address,
            email_password=config.email_password,
            imap_server=config.imap_server,
            allowed_senders=config.allowed_senders,
            max_age_days=config.max_age_days,
            sleep_time=config.sleep_time,
            auto_download_enabled=config.auto_download_enabled,
            download_path=config.download_path
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
        db_config.auto_download_enabled = config.auto_download_enabled
        db_config.download_path = config.download_path
    
    db.commit()
    
    # Update scheduler interval if it changed and scheduler is running
    if email_scheduler.is_running and old_sleep_time != config.sleep_time:
        email_scheduler.update_interval(config.sleep_time)
    
    return {"status": "Email configuration updated successfully"}

@router.post("/email/validate", response_model=EmailValidationResponse)
def validate_email_credentials(validation: EmailValidationRequest, _: User = Depends(get_current_user)):
    """Validate email credentials before saving"""
    try:
        # Connect to IMAP server
        mail = imaplib.IMAP4_SSL(validation.imap_server)
        
        # Try to login with provided credentials
        mail.login(validation.email_address, validation.email_password)
        
        # Test accessing inbox
        mail.select('INBOX')
        
        # Close connection
        mail.close()
        mail.logout()
        
        return {
            "valid": True,
            "message": "Email credentials are valid"
        }
        
    except imaplib.IMAP4.error as e:
        error_msg = str(e).replace('b\'', '').replace('\'', '')
        if "AUTHENTICATIONFAILED" in error_msg:
            return {
                "valid": False,
                "message": "Invalid email or password. Please check your credentials and ensure you're using an App Password for Gmail."
            }
        else:
            return {
                "valid": False,
                "message": f"Email connection failed: {error_msg}"
            }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Unexpected error: {str(e)}"
        }

@router.get("/printers", response_model=List[PrinterConfig])
def get_printer_configs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PrinterConfigModel).all()

@router.put("/printers/{printer_id}", response_model=PrinterConfig)
def update_printer_config(
    printer_id: int,
    config: PrinterConfig,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    db_config = db.query(PrinterConfigModel).filter(PrinterConfigModel.id == printer_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Printer configuration not found")
    
    for key, value in config.dict().items():
        setattr(db_config, key, value)
    
    db.commit()
    db.refresh(db_config)
    return db_config