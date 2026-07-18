"""Role DTOs — response schemas for the roles API."""

from pydantic import BaseModel
from datetime import datetime


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime
