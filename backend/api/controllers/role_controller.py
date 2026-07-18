"""Role controller — list roles endpoint."""

from fastapi import APIRouter, HTTPException
from typing import List

from backend.api import dependencies as deps
from backend.dtos.role_dto import RoleResponse
from backend.services import role_service

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=List[RoleResponse])
async def get_roles():
    """List all available roles."""
    try:
        roles = await role_service.get_roles(deps.db_pool)
        return roles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
