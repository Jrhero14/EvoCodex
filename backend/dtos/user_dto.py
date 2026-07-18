from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreateRequest(UserBase):
    password: str
    role_id: Optional[int] = None

class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    role_id: int | None = None
    role_name: str | None = None
    created_at: datetime
    is_sso: bool = False
