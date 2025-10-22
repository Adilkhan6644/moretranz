from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), unique=True, index=True, nullable=False)
    username = Column(String(150), nullable=True)  # Kept for backward compatibility
    full_name = Column(String(150), nullable=True)
    password_hash = Column(String(255), nullable=False)
    refresh_token = Column(String(500), nullable=True)  # For refresh token storage
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Email configuration fields for user isolation
    email_address = Column(String(255), nullable=True)  # User's email for processing (e.g., user@gmail.com)
    email_app_password = Column(String(255), nullable=True)  # User's Gmail App Password (NOT login password)
    imap_server = Column(String(255), nullable=True)  # IMAP server
    allowed_senders = Column(Text, nullable=True)  # Comma-separated list of allowed senders
    max_age_days = Column(Integer, nullable=True)  # Maximum age of emails to process
    sleep_time = Column(Integer, nullable=True)  # Sleep time between email checks

