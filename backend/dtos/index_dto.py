"""Indexing-related request/response models."""

from pydantic import BaseModel


class RepoPayload(BaseModel):
    repo_url: str
    project_name: str
    branch: str = "main"


class IndexRepoPayload(BaseModel):
    repo_url: str
    branch: str
    force: bool = False
