"""Project service — CRUD operations for the projects table."""

import asyncpg

from backend.clients.gitlab_client import fetch_project_info

import datetime

import math

async def get_paginated_projects(
    db_pool: asyncpg.Pool, page: int = 1, limit: int = 10, search: str = ""
) -> dict:
    """Return paginated projects with search functionality."""
    async with db_pool.acquire() as conn:
        offset = (page - 1) * limit
        
        search_query = f"%{search}%" if search else "%"
        
        # Count total rows
        count_query = """
            SELECT COUNT(*) FROM projects 
            WHERE project_name ILIKE $1 OR namespace ILIKE $1 OR current_branch ILIKE $1
        """
        total_rows = await conn.fetchval(count_query, search_query)
        total_pages = math.ceil(total_rows / limit) if limit > 0 else 1
        
        # Fetch data
        data_query = """
            SELECT * FROM projects 
            WHERE project_name ILIKE $1 OR namespace ILIKE $1 OR current_branch ILIKE $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """
        records = await conn.fetch(data_query, search_query, limit, offset)
        
        results = []
        for r in records:
            row = dict(r)
            # Append 'Z' to naive datetime fields so JS interprets them as UTC
            for key in ("created_at", "updated_at", "last_activity_at"):
                if key in row and isinstance(row[key], datetime.datetime):
                    row[key] = row[key].isoformat() + "Z"
            results.append(row)
            
        return {
            "data": results,
            "total_rows": total_rows,
            "total_pages": total_pages,
            "current_page": page
        }


async def upsert_project(
    db_pool: asyncpg.Pool,
    repo_url: str,
    branch: str,
    gitlab_info: dict,
    included_patterns: str | None = None,
    excluded_patterns: str | None = None,
) -> None:
    """Insert or update a project record using GitLab metadata."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO projects (
                project_id, project_name, path, namespace, path_with_namespace,
                gitlab_url, repository_url, default_branch, current_branch,
                last_activity_at, commit_sha, included_patterns, excluded_patterns
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamp, $11, COALESCE($12, '**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html'), COALESCE($13, '**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests'))
            ON CONFLICT (project_id, current_branch) DO UPDATE SET
                repository_url = EXCLUDED.repository_url,
                last_activity_at = EXCLUDED.last_activity_at,
                commit_sha = EXCLUDED.commit_sha,
                updated_at = CURRENT_TIMESTAMP,
                included_patterns = COALESCE($12, projects.included_patterns),
                excluded_patterns = COALESCE($13, projects.excluded_patterns)
            """,
            gitlab_info["project_id"],
            gitlab_info["project_name"],
            gitlab_info["path"],
            gitlab_info["namespace"],
            gitlab_info["path_with_namespace"],
            gitlab_info["gitlab_url"],
            repo_url,
            gitlab_info["default_branch"],
            branch,
            gitlab_info["last_activity_at"],
            gitlab_info["commit_sha"],
            included_patterns,
            excluded_patterns,
        )


async def auto_detect_project_patterns(repo_url: str, branch: str) -> tuple[str, str]:
    from backend.clients.gitlab_client import fetch_project_tree
    
    default_included = "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html,**/*.py,**/*.rs,**/*.toml,**/*.md,**/*.mdx"
    default_excluded = "**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests"
    
    try:
        tree = await fetch_project_tree(repo_url, branch)
        is_js = False
        is_dotnet = False
        
        for item in tree:
            if item.get("type") == "blob":
                name = item.get("name", "")
                if name == "package.json":
                    is_js = True
                if name.endswith(".csproj") or name.endswith(".sln"):
                    is_dotnet = True
                    
        if is_js and not is_dotnet:
            return (
                "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html",
                "**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests"
            )
        elif is_dotnet and not is_js:
            return (
                "**/*.cs,**/*.cshtml,**/*.json,**/*.xml",
                "**/.*,**/bin,**/obj,**/*.md,**/tests"
            )
        elif is_js and is_dotnet:
            return (
                "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.cs,**/*.cshtml",
                "**/.*,**/node_modules,**/bin,**/obj,**/*.md,**/tests"
            )
    except Exception as e:
        print(f"Failed to auto-detect patterns for {repo_url}: {e}")
        
    return default_included, default_excluded


async def add_project(
    db_pool: asyncpg.Pool, 
    repo_url: str, 
    branch: str | None,
    included_patterns: str | None = None,
    excluded_patterns: str | None = None,
) -> dict:
    """
    Add a new project by fetching its metadata from GitLab.

    Returns a success message dict.
    """
    gitlab_info = await fetch_project_info(repo_url, branch or "main")
    current_branch = branch or gitlab_info["default_branch"]
    await upsert_project(db_pool, repo_url, current_branch, gitlab_info, included_patterns, excluded_patterns)
    return {"status": "success", "message": "Project added successfully"}


async def delete_project(db_pool: asyncpg.Pool, project_id: int) -> dict:
    """Delete a project by its database ID, including embeddings and cache."""
    import pathlib
    import shutil
    from backend.core.config import TABLE_NAME
    
    async with db_pool.acquire() as conn:
        project = await conn.fetchrow("SELECT project_name, current_branch FROM projects WHERE id = $1", project_id)
        if not project:
            return {"status": "error", "message": "Project not found"}
        
        project_name = project["project_name"]
        branch = project["current_branch"]
        
        # 1. Delete from projects
        await conn.execute("DELETE FROM projects WHERE id = $1", project_id)
        
        # 2. Delete from history
        await conn.execute("DELETE FROM indexing_history WHERE project_name = $1 AND branch = $2", project_name, branch)
        
        # 3. Delete embeddings
        await conn.execute(f'DELETE FROM "{TABLE_NAME}" WHERE project_name = $1 AND branch = $2', project_name, branch)
        
    # 4. Delete CocoIndex state cache for THIS project only using `cocoindex clean`
    project_root = pathlib.Path(__file__).parent.parent.parent
    branch_dir = branch.replace("/", "_")
    repo_path = pathlib.Path("/tmp/cocoindex_repos") / project_name / branch_dir
    
    venv_bin = project_root / ".venv" / "bin"
    cocoindex_cmd = shutil.which("cocoindex") or str(venv_bin / "cocoindex")
    
    env = import_os().environ.copy()
    env["COCOINDEX_SOURCE_PATH"] = str(repo_path)
    env["COCOINDEX_PROJECT_NAME"] = project_name
    env["COCOINDEX_BRANCH_NAME"] = branch
    env["COCOINDEX_DB"] = str(project_root / ".cocoindex.db")
    
    try:
        import subprocess
        subprocess.run(
            [cocoindex_cmd, "clean", "backend.core.indexer"],
            cwd=str(project_root),
            env=env,
            check=False,
            capture_output=True
        )
    except Exception as e:
        print(f"Failed to clean cocoindex state for {project_name}/{branch}: {e}")
        
    # 5. Delete Git clone cache
    if repo_path.exists():
        shutil.rmtree(repo_path, ignore_errors=True)
        
    return {"status": "success", "message": "Project and its indexed data deleted successfully"}

def import_os():
    import os
    return os
