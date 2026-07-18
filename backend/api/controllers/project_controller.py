"""Project controller — CRUD endpoints for managing projects."""

from fastapi import APIRouter, Depends, HTTPException

from backend.api import dependencies as deps
from backend.dtos.project_dto import AddProjectRequest
from backend.services import project_service
from backend.clients.gitlab_client import fetch_project_tree, fetch_project_branches

router = APIRouter(tags=["Projects"])


@router.get("/projects")
async def get_projects(page: int = 1, limit: int = 10, search: str = "", token: dict = Depends(deps.verify_token)):
    try:
        data = await project_service.get_paginated_projects(deps.db_pool, page, limit, search)
        return {"status": "success", "data": data["data"], "pagination": {"total_rows": data["total_rows"], "total_pages": data["total_pages"], "current_page": data["current_page"]}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects")
async def add_project(req: AddProjectRequest, token: dict = Depends(deps.verify_token)):
    try:
        return await project_service.add_project(
            deps.db_pool, req.repository_url, req.branch, req.included_patterns, req.excluded_patterns
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, token: dict = Depends(deps.verify_token)):
    try:
        return await project_service.delete_project(deps.db_pool, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/tree")
async def get_project_tree(
    repo_url: str, 
    branch: str = "", 
    token: dict = Depends(deps.verify_token)
):
    try:
        data = await fetch_project_tree(repo_url, branch)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/branches")
async def get_project_branches(
    repo_url: str,
    token: dict = Depends(deps.verify_token)
):
    try:
        data = await fetch_project_branches(repo_url)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
