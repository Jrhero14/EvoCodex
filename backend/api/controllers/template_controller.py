"""API Endpoints for Project Templates."""

from fastapi import APIRouter, Depends, HTTPException

from backend.api import dependencies as deps
from backend.dtos.template_dto import TemplateCreate, TemplateUpdate, TemplateResponse
from backend.services import template_service

router = APIRouter(tags=["Templates"])


@router.get("/templates", response_model=list[TemplateResponse])
async def get_templates(token: dict = Depends(deps.verify_token)):
    try:
        return await template_service.get_all_templates(deps.db_pool)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates", response_model=TemplateResponse)
async def create_template(data: TemplateCreate, token: dict = Depends(deps.verify_token)):
    try:
        return await template_service.create_template(deps.db_pool, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, data: TemplateUpdate, token: dict = Depends(deps.verify_token)):
    try:
        return await template_service.update_template(deps.db_pool, template_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, token: dict = Depends(deps.verify_token)):
    try:
        await template_service.delete_template(deps.db_pool, template_id)
        return {"status": "success", "message": "Template deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
