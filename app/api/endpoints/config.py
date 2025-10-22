from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.order import EmailConfig, PrinterConfig
from app.schemas.user import UserEmailConfigUpdate, UserEmailConfigResponse, UserEmailConfig
from app.models.order import EmailConfig as EmailConfigModel
from app.models.order import PrinterConfig as PrinterConfigModel
from pydantic import BaseModel
from app.core.config import settings
from app.api.endpoints.auth import get_current_user
from app.models.user import User
import imaplib

router = APIRouter()


class EmailValidationRequest(BaseModel):
    email_address: str
    email_app_password: str
    imap_server: str = "imap.gmail.com"

class EmailValidationResponse(BaseModel):
    valid: bool
    message: str

@router.get("/email", response_model=UserEmailConfigResponse)
def get_email_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user's email configuration"""
    return UserEmailConfigResponse(
        email_address=current_user.email_address,
        imap_server=current_user.imap_server,
        allowed_senders=current_user.allowed_senders,
        max_age_days=current_user.max_age_days,
        sleep_time=current_user.sleep_time
    )

@router.put("/email")
def update_email_config(config: UserEmailConfigUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update current user's email configuration"""
    from app.services.scheduler import email_scheduler
    
    old_sleep_time = current_user.sleep_time
    
    # Update user's email configuration
    current_user.email_address = config.email_address
    current_user.email_app_password = config.email_app_password
    current_user.imap_server = config.imap_server
    current_user.allowed_senders = config.allowed_senders
    current_user.max_age_days = config.max_age_days
    current_user.sleep_time = config.sleep_time
    
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
        mail.login(validation.email_address, validation.email_app_password)
        
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
                "message": "Invalid email or App Password. Please check your credentials and ensure you're using a Gmail App Password (not your regular Gmail password)."
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