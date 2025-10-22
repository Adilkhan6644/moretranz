from pydantic import BaseModel, EmailStr
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class UserEmailConfig(BaseModel):
    email_address: Optional[str] = None
    email_app_password: Optional[str] = None
    imap_server: str = "imap.gmail.com"
    allowed_senders: Optional[str] = None
    max_age_days: int = 10
    sleep_time: int = 5


class UserEmailConfigUpdate(BaseModel):
    email_address: str
    email_app_password: str
    imap_server: str = "imap.gmail.com"
    allowed_senders: str
    max_age_days: int = 10
    sleep_time: int = 5


class UserEmailConfigResponse(BaseModel):
    email_address: Optional[str] = None
    imap_server: Optional[str] = None
    allowed_senders: Optional[str] = None
    max_age_days: Optional[int] = None
    sleep_time: Optional[int] = None

    class Config:
        from_attributes = True


class UserWithEmailConfig(UserOut):
    email_config: UserEmailConfigResponse
