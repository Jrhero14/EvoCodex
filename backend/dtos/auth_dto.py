"""Authentication-related request/response models."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
