"""Settings management endpoints — admin only."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api import dependencies as deps
from backend.api.dependencies import require_role
from backend.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


class UpdateSettingRequest(BaseModel):
    value: str

@router.get("/public")
async def get_public_settings():
    """Fetch public settings (no auth required)."""
    val = settings_service.get_config("ENABLE_OAUTH", "true")
    return {"ENABLE_OAUTH": val.lower() == "true"}


@router.get("")
async def get_all_settings(_=Depends(require_role("admin"))):
    """Fetch all application settings (sensitive values masked)."""
    settings = await settings_service.get_all_settings(deps.db_pool)
    for s in settings:
        if s["is_sensitive"] and s["value"]:
            val = s["value"]
            if len(val) <= 8:
                s["masked_value"] = "\u2022" * 8
            else:
                s["masked_value"] = val[:4] + "\u2022" * 4 + val[-4:]
        else:
            s["masked_value"] = s["value"]
        if s.get("updated_at"):
            s["updated_at"] = s["updated_at"].isoformat()
    return settings


@router.put("/{key}")
async def update_setting(key: str, body: UpdateSettingRequest, _=Depends(require_role("admin"))):
    """Update a single application setting."""
    try:
        result = await settings_service.update_setting(deps.db_pool, key, body.value)
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{key}/regenerate")
async def regenerate_setting(key: str, _=Depends(require_role("admin"))):
    """Regenerate a secret key for a regenerable setting."""
    try:
        result = await settings_service.regenerate_secret(deps.db_pool, key)
        if result.get("updated_at"):
            result["updated_at"] = result["updated_at"].isoformat()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
