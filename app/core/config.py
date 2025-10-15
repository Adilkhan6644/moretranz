from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from dotenv import load_dotenv
from pydantic import field_validator

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Moretranz Order Processor API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI: str = os.getenv("DATABASE_URL")

    # Email Configuration (Optional)
    EMAIL_ADDRESS: Optional[str] = os.getenv("EMAIL_ADDRESS")
    EMAIL_PASSWORD: Optional[str] = os.getenv("EMAIL_PASSWORD")
    IMAP_SERVER: str = os.getenv("IMAP_SERVER", "imap.gmail.com")
    ALLOWED_SENDERS: str = os.getenv("ALLOWED_SENDERS", "")
    EMAIL_PROCESSING_ENABLED: bool = os.getenv("EMAIL_PROCESSING_ENABLED", "false").lower() == "true"
    
    @property
    def allowed_senders_list(self) -> List[str]:
        """Convert ALLOWED_SENDERS string to list"""
        if not self.ALLOWED_SENDERS:
            return []
        return [s.strip() for s in self.ALLOWED_SENDERS.split(",") if s.strip()]
    MAX_EMAIL_AGE_DAYS: int = 10
    
    # File Storage Configuration
    # Use environment variables for production flexibility
    ATTACHMENTS_FOLDER: str = os.getenv("ATTACHMENTS_FOLDER", "/data/attachments")
    LOGS_FOLDER: str = os.getenv("LOGS_FOLDER", "/data/logs")
    PROCESSED_EMAILS_FILE: str = os.getenv("PROCESSED_EMAILS_FILE", "/data/logs/processed_emails.txt")
    
    # File storage settings
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))  # 50MB max file size
    ALLOWED_FILE_TYPES: str = os.getenv("ALLOWED_FILE_TYPES", "pdf,png,jpg,jpeg,gif,bmp,txt,html")
    
    @property
    def allowed_file_types_list(self) -> List[str]:
        """Convert ALLOWED_FILE_TYPES string to list"""
        return [ext.strip().lower() for ext in self.ALLOWED_FILE_TYPES.split(",") if ext.strip()]
    
    # Processing Configuration
    SLEEP_TIME: int = 5
    BODY_PRINTER: str = "BodyPrinter"
    ATTACHMENT_PRINTER: str = "AttachmentPrinter"

    # Auth / JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-prod")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7 days
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    class Config:
        case_sensitive = True

settings = Settings()