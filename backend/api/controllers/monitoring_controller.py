"""Monitoring controller — indexing history and database reset endpoints."""

from fastapi import APIRouter, Depends, HTTPException

from backend.api import dependencies as deps
from backend.services import monitoring_service

router = APIRouter(tags=["Monitoring"])


@router.get("/monitoring/history")
async def get_monitoring_history(token: dict = Depends(deps.verify_token)):
    try:
        history = await monitoring_service.get_indexing_history(deps.db_pool)
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitoring/webhooks")
async def get_webhook_logs(limit: int = 50, offset: int = 0, token: dict = Depends(deps.verify_token)):
    try:
        data = await monitoring_service.get_webhook_logs(deps.db_pool, limit, offset)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset")
async def reset_database(token: dict = Depends(deps.verify_token)):
    try:
        result = await monitoring_service.reset_database()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
