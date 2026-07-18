"""Template Data Transfer Objects."""

from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class TemplateCreate(BaseModel):
    name: str
    template_code: str
    included_patterns: str
    excluded_patterns: str


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    template_code: Optional[str] = None
    included_patterns: Optional[str] = None
    excluded_patterns: Optional[str] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    template_code: Optional[str] = None
    included_patterns: str
    excluded_patterns: str
    created_at: datetime
