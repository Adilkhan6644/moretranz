from sqlalchemy import Column, Integer, String, Boolean, DateTime
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

