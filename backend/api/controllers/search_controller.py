"""Search controller — vector similarity search endpoint."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from backend.api import dependencies as deps
from backend.dtos.index_dto import RepoPayload
from backend.services import search_service, index_service

router = APIRouter(tags=["Search"])


@router.get("/search")
async def search_code(
    query: str,
    background_tasks: BackgroundTasks,
    token: dict = Depends(deps.verify_token),
    project_name: str | None = None,
    branch: str | None = None,
    repo_url: str | None = None,
    top_k: int = 10,
    search_mode: str = "hybrid",
):
    try:
        results = await search_service.search_code(
            deps.db_pool, deps.embedder, query, project_name, branch, top_k, search_mode
        )

        status = "success"
        # Auto-fallback: trigger indexing if results are empty and repo info provided
        if not results and repo_url and project_name and branch:
            payload = RepoPayload(
                repo_url=repo_url, project_name=project_name, branch=branch
            )
            background_tasks.add_task(
                index_service.clone_and_index_task, payload, deps.db_pool
            )
            status = "indexing_started"

        return {
            "status": status,
            "query": query,
            "search_mode": search_mode,
            "project_name": project_name,
            "branch": branch,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agent-search")
async def agent_search_code(
    query: str,
    repo_url: str,
    branch: str = "main",
    top_k: int = 5,
    search_mode: str = "hybrid",
    api_key_valid: bool = Depends(deps.verify_agent_api_key),
):
    """
    Special endpoint for AI Agents.
    Protected by X-API-Key header.
    Does NOT auto-trigger background indexing to prevent infinite loops from agents.
    Returns highly structured data ready for LLM consumption.
    """
    try:
        # Resolve project_name from repo_url by querying the database
        async with deps.db_pool.acquire() as conn:
            project_row = await conn.fetchrow(
                "SELECT project_name FROM projects WHERE repository_url = $1 AND current_branch = $2",
                repo_url, branch
            )
            
        if not project_row:
            raise HTTPException(status_code=404, detail=f"Project not found for repo {repo_url} on branch {branch}. Make sure it is registered and indexed first.")
            
        project_name = project_row["project_name"]

        results = await search_service.search_code(
            deps.db_pool, deps.embedder, query, project_name, branch, top_k, search_mode
        )

        return {
            "status": "success",
            "query": query,
            "project_name": project_name,
            "branch": branch,
            "results": results,
            "total_results": len(results)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
