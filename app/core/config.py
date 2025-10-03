from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from dotenv import load_dotenv

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
    ALLOWED_SENDERS: List[str] = os.getenv("ALLOWED_SENDERS", "").split(",") if os.getenv("ALLOWED_SENDERS") else []
    EMAIL_PROCESSING_ENABLED: bool = os.getenv("EMAIL_PROCESSING_ENABLED", "false").lower() == "true"
    MAX_EMAIL_AGE_DAYS: int = 10
    
    # File Storage
    ATTACHMENTS_FOLDER: str = "attachments"
    PROCESSED_EMAILS_FILE: str = "logs/processed_emails.txt"
    
    # Processing Configuration
    SLEEP_TIME: int = 5
    BODY_PRINTER: str = "BodyPrinter"
    ATTACHMENT_PRINTER: str = "AttachmentPrinter"

    class Config:
        case_sensitive = True

settings = Settings()