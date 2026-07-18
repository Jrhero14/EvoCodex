"""Project-related request/response models."""

from pydantic import BaseModel


class AddProjectRequest(BaseModel):
    repository_url: str
    branch: str | None = None
    included_patterns: str | None = None
    excluded_patterns: str | None = None
