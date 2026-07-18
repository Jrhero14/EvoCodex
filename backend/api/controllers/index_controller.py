"""Index controller — repo indexing and GitLab webhook endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Header
from fastapi.responses import PlainTextResponse
import pathlib

from backend.api import dependencies as deps
from backend.clients.gitlab_client import fetch_project_info
from backend.dtos.index_dto import RepoPayload, IndexRepoPayload
from backend.services import index_service, project_service

router = APIRouter(tags=["Indexing"])


@router.post("/index_repo")
async def trigger_index(
    payload: IndexRepoPayload,
    background_tasks: BackgroundTasks,
    token: dict = Depends(deps.verify_token),
):
    db_pool = deps.db_pool

    # Check if already indexed (skip check when force=True)
    async with db_pool.acquire() as conn:
        record = await conn.fetchrow(
            "SELECT project_name FROM projects "
            "WHERE repository_url = $1 AND current_branch = $2",
            payload.repo_url,
            payload.branch,
        )
        if record and not payload.force:
            return {
                "message": f"Project {record['project_name']} with branch "
                f"{payload.branch} is already indexed."
            }

    # Fetch project data from GitLab
    try:
        gitlab_info = await fetch_project_info(payload.repo_url, payload.branch)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    project_name = gitlab_info["project_name"]

    # Upsert project metadata
    await project_service.upsert_project(
        db_pool, payload.repo_url, payload.branch, gitlab_info
    )

    # Run indexing
    task_payload = RepoPayload(
        repo_url=payload.repo_url,
        project_name=project_name,
        branch=payload.branch,
    )
    job_id = await index_service.create_indexing_job(task_payload, db_pool)
    background_tasks.add_task(index_service.run_indexing_job, job_id, task_payload, db_pool)

    return {
        "message": f"Indexing job for {project_name} started successfully.",
        "project_name": project_name,
        "repo_url": payload.repo_url,
        "job_id": job_id,
    }


@router.post("/gitlab_webhook")
async def gitlab_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_gitlab_token: str | None = Header(default=None),
):
    from backend.core.config import GITLAB_WEBHOOK_SECRET

    # Verify Secret Token
    if not GITLAB_WEBHOOK_SECRET or x_gitlab_token != GITLAB_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid X-Gitlab-Token")

    payload = await request.json()

    # We only care about push events
    if payload.get("object_kind") != "push":
        return {"message": "Ignored. Event is not a push."}

    try:
        project_name = payload["project"]["name"]
        repo_url = payload["project"].get("http_url_to_repo")
        # Fallback to web_url or git_http_url if http_url_to_repo is not present
        if not repo_url:
            repo_url = payload["project"].get("git_http_url")
        
        ref = payload.get("ref", "")
        branch = ref.replace("refs/heads/", "")
        
        # Check if project exists
        async with deps.db_pool.acquire() as conn:
            record = await conn.fetchrow(
                "SELECT id FROM projects WHERE repository_url = $1 AND current_branch = $2",
                repo_url, branch
            )
            
        if not record:
            # Auto-detect patterns and create project
            from backend.services.project_service import add_project, auto_detect_project_patterns
            included, excluded = await auto_detect_project_patterns(repo_url, branch)
            await add_project(deps.db_pool, repo_url, branch, included, excluded)

        repo_payload = RepoPayload(
            repo_url=repo_url,
            project_name=project_name,
            branch=branch,
        )

        job_id = await index_service.create_indexing_job(repo_payload, deps.db_pool)
        background_tasks.add_task(
            index_service.run_indexing_job, job_id, repo_payload, deps.db_pool
        )
        return {
            "message": f"GitLab push event received. "
            f"Indexing {project_name} (branch: {branch}) in background with job ID {job_id}."
        }
    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid GitLab payload structure. Missing: {str(e)}",
        )


@router.get("/projects/{project_name}/{branch}/jobs")
async def get_project_jobs(project_name: str, branch: str, token: dict = Depends(deps.verify_token)):
    async with deps.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, status, indexed_at, error_message FROM indexing_history WHERE project_name = $1 AND branch = $2 ORDER BY indexed_at DESC LIMIT 50",
            project_name, branch
        )
        
        formatted_rows = []
        for r in rows:
            formatted_rows.append({
                "id": r["id"],
                "status": r["status"],
                "indexed_at": (r["indexed_at"].isoformat() + "Z") if r["indexed_at"] else None,
                "error_message": r["error_message"]
            })
            
        return {"status": "success", "data": formatted_rows}


@router.get("/jobs/recent")
async def get_recent_jobs(token: dict = Depends(deps.verify_token)):
    async with deps.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, project_name, branch, status, indexed_at FROM indexing_history ORDER BY id DESC LIMIT 5"
        )
        
        formatted_rows = []
        for r in rows:
            formatted_rows.append({
                "id": r["id"],
                "project_name": r["project_name"],
                "branch": r["branch"],
                "status": r["status"],
                "indexed_at": (r["indexed_at"].isoformat() + "Z") if r["indexed_at"] else None
            })
            
        return {"status": "success", "data": formatted_rows}


@router.get("/jobs/{job_id}/logs")
async def get_job_logs(job_id: int, token: dict = Depends(deps.verify_token)):
    # First check db
    async with deps.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT status, log_output FROM indexing_history WHERE id = $1", job_id)
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # If finished, it has log_output
        if row["status"] != "IN_PROGRESS" and row["log_output"]:
            return PlainTextResponse(row["log_output"])
            
    # If in progress or missing log_output, check the file
    log_file_path = pathlib.Path("/tmp/cocoindex_jobs") / f"{job_id}.log"
    if log_file_path.exists():
        with open(log_file_path, "r", encoding="utf-8") as f:
            return PlainTextResponse(f.read())
            
    return PlainTextResponse("Waiting for logs...\n")
