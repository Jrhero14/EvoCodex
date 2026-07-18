"""User controller — CRUD endpoints for user management (admin only)."""

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from backend.api import dependencies as deps
from backend.api.dependencies import require_role
from backend.dtos.user_dto import UserCreateRequest, UserUpdateRequest, UserResponse
from backend.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse], dependencies=[Depends(require_role("admin"))])
async def get_users():
    try:
        users = await user_service.get_users(deps.db_pool)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=UserResponse, dependencies=[Depends(require_role("admin"))])
async def create_user(req: UserCreateRequest):
    try:
        user = await user_service.create_user(req, deps.db_pool)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role("admin"))])
async def update_user(user_id: int, req: UserUpdateRequest):
    try:
        user = await user_service.update_user(user_id, req, deps.db_pool)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}", dependencies=[Depends(require_role("admin"))])
async def delete_user(user_id: int):
    try:
        success = await user_service.delete_user(user_id, deps.db_pool)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        return {"detail": "User deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
