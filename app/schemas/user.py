from pydantic import BaseModel


class UserBase(BaseModel):
    username: str  # email
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True
