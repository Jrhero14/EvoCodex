"""Database controller — code_embeddings table browsing endpoints."""

from fastapi import APIRouter, Depends, HTTPException

from backend.api import dependencies as deps
from backend.services import database_service

router = APIRouter(tags=["Database"])


@router.get("/database/code_embedded")
async def get_database_code_embedded(
    token: dict = Depends(deps.verify_token),
    limit: int = 100,
    offset: int = 0,
    project_name: str | None = None,
    branch: str | None = None,
):
    try:
        data, total_count = await database_service.get_code_embeddings(
            deps.db_pool, limit, offset, project_name, branch
        )
        return {"status": "success", "data": data, "total": total_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/database/code_embedded/{row_id}")
async def get_database_code_embedded_by_id(
    row_id: str, token: dict = Depends(deps.verify_token)
):
    try:
        data = await database_service.get_code_embedding_by_id(
            deps.db_pool, row_id
        )
        if data is None:
            raise HTTPException(status_code=404, detail="Row not found")
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
