"""Indexing service — git clone, CocoIndex update, and history tracking."""

import asyncio
import datetime
import os
import pathlib
import shutil
import subprocess

import asyncpg
import git

from backend.core.config import GITLAB_PAT
from backend.dtos.index_dto import RepoPayload
from backend.services.ws_broadcaster import job_broadcaster

# ── Paths ───────────────────────────────────────────────────────────────────

REPOS_DIR = pathlib.Path("/tmp/cocoindex_repos")
REPOS_DIR.mkdir(parents=True, exist_ok=True)

JOBS_DIR = pathlib.Path("/tmp/cocoindex_jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.parent

# Path to the cocoindex binary
COCOINDEX_CMD = shutil.which("cocoindex")
if not COCOINDEX_CMD:
    VENV_BIN = PROJECT_ROOT / ".venv" / "bin"
    COCOINDEX_CMD = str(VENV_BIN / "cocoindex")
    if not (VENV_BIN / "cocoindex").exists():
        raise RuntimeError("cocoindex command not found in PATH or .venv!")


# ── Sync Clone & Index ─────────────────────────────────────────────────────

def _sync_clone_and_index(
    job_id: int,
    payload: RepoPayload, 
    included_patterns: str | None = None,
    excluded_patterns: str | None = None
) -> tuple[str, str | None, str | None, str]:
    """
    Synchronous function that clones/pulls the repo and runs CocoIndex update.

    Returns (status, commit_hash, error_message, log_output).
    """
    branch_dir = payload.branch.replace("/", "_")
    repo_path = REPOS_DIR / payload.project_name / branch_dir
    commit_hash = None
    full_log_lines = []
    
    log_file_path = JOBS_DIR / f"{job_id}.log"
    with open(log_file_path, "w", encoding="utf-8") as log_file:
        def log_write(msg: str, section: bool = False, raw: bool = False):
            if section:
                formatted = f"\n{'='*70}\n[+] {msg.upper()}\n{'='*70}\n"
            elif raw:
                formatted = msg
            else:
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                formatted = f"[{timestamp}] {msg}"
                
            print(formatted, end="" if formatted.endswith("\n") else "\n")
            log_file.write(formatted if formatted.endswith("\n") else formatted + "\n")
            log_file.flush()
            full_log_lines.append(formatted if formatted.endswith("\n") else formatted + "\n")

        log_write(f"STARTING INDEXING JOB #{job_id} FOR PROJECT: {payload.project_name}", section=True)
        log_write(f"Target Branch: {payload.branch}")
        log_write(f"Repository URL: {payload.repo_url}")
        log_write(f"Local Storage Path: {repo_path}")

        # 1. Clone or Pull the repository
        log_write("PHASE 1: GIT SYNCHRONIZATION", section=True)
        try:
            auth_url = payload.repo_url
            if GITLAB_PAT and auth_url.startswith("https://"):
                auth_url = auth_url.replace("https://", f"https://oauth2:{GITLAB_PAT}@")

            if repo_path.exists():
                log_write(f"Found existing repository at {repo_path}")
                log_write(f"Executing: git pull origin {payload.branch}...")
                repo = git.Repo(repo_path)
                repo.remotes.origin.set_url(auth_url)
                pull_info = repo.remotes.origin.pull()
                for info in pull_info:
                    log_write(f"Git Pull: {info.commit} - {info.flags}")
            else:
                log_write(f"Repository not found locally. Executing: git clone {payload.repo_url}...")
                repo = git.Repo.clone_from(auth_url, repo_path, branch=payload.branch)
                log_write("Clone completed successfully.")

            commit_hash = repo.head.commit.hexsha
            commit_msg = repo.head.commit.message.strip().split('\n')[0]
            log_write(f"Current HEAD commit: {commit_hash[:8]} - {commit_msg}")
        except Exception as e:
            error_msg = f"Git operation failed: {str(e)}"
            log_write(f"ERROR: {error_msg}")
            return "FAILED", None, error_msg, "".join(full_log_lines)

        # 2. Run CocoIndex update via subprocess
        log_write("PHASE 2: COCOINDEX EMBEDDING & INDEXING", section=True)
        log_write(f"CocoIndex Binary: {COCOINDEX_CMD}")
        log_write(f"Database Path: {PROJECT_ROOT / '.cocoindex.db'}")
        
        env = os.environ.copy()
        env["COCOINDEX_SOURCE_PATH"] = str(repo_path)
        env["COCOINDEX_PROJECT_NAME"] = payload.project_name
        env["COCOINDEX_BRANCH_NAME"] = payload.branch
        env["COCOINDEX_DB"] = str(PROJECT_ROOT / ".cocoindex.db")
        
        if included_patterns:
            log_write(f"Included Patterns: {included_patterns}")
            env["COCOINDEX_INCLUDED_PATTERNS"] = included_patterns
        else:
            log_write("Included Patterns: [NONE / ALL]")
            
        if excluded_patterns:
            log_write(f"Excluded Patterns: {excluded_patterns}")
            env["COCOINDEX_EXCLUDED_PATTERNS"] = excluded_patterns
        else:
            log_write("Excluded Patterns: [NONE]")

        log_write(f"Executing command: cocoindex update backend.core.indexer")
        log_write("-" * 70)
        
        try:
            process = subprocess.Popen(
                [COCOINDEX_CMD, "update", "backend.core.indexer"],
                cwd=str(PROJECT_ROOT),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            
            output_lines = []
            for line in process.stdout:
                log_write(line, raw=True)
                output_lines.append(line)
                
            process.wait()
            
            log_write("-" * 70)
            log_write(f"CocoIndex process exited with code: {process.returncode}")
            
            if process.returncode != 0:
                error_msg = f"Indexing failed with exit code {process.returncode}."
                log_write(f"PHASE 2 FAILED: {error_msg}", section=True)
                return "FAILED", commit_hash, error_msg, "".join(full_log_lines)
                
            log_write("PHASE 2 COMPLETE", section=True)
            
            # Phase 3: Database Persistence
            log_write("PHASE 3: SAVING TO DATABASE", section=True)
            log_write("Persisting indexing results to PostgreSQL...")
            return "SUCCESS", commit_hash, None, "".join(full_log_lines)
            
        except Exception as e:
            error_msg = f"Failed to execute cocoindex: {str(e)}"
            log_write(f"PHASE 2 ERROR: {error_msg}", section=True)
            return "FAILED", commit_hash, error_msg, "".join(full_log_lines)


async def create_indexing_job(
    payload: RepoPayload, db_pool: asyncpg.Pool
) -> int:
    """Create an IN_PROGRESS job and return its ID."""
    async with db_pool.acquire() as conn:
        job_id = await conn.fetchval(
            """
            INSERT INTO indexing_history
                (project_name, branch, status)
            VALUES ($1, $2, 'IN_PROGRESS')
            RETURNING id
            """,
            payload.project_name, payload.branch
        )
    return job_id


async def _broadcast_job_event(event_type: str, job_id: int, payload: RepoPayload, status: str = "IN_PROGRESS"):
    """Broadcast job event via WebSocket."""
    try:
        await job_broadcaster.broadcast({
            "type": event_type,
            "job": {
                "id": job_id,
                "project_name": payload.project_name,
                "branch": payload.branch,
                "status": status,
            }
        })
    except Exception:
        pass  # Never let broadcast failure affect the indexing pipeline


async def run_indexing_job(
    job_id: int, payload: RepoPayload, db_pool: asyncpg.Pool
) -> None:
    """Run clone + index in a thread pool and save history to PostgreSQL."""
    
    included_patterns = None
    excluded_patterns = None

    try:
        async with db_pool.acquire() as conn:
            # Fetch project specific patterns
            row = await conn.fetchrow(
                "SELECT included_patterns, excluded_patterns FROM projects WHERE repository_url = $1 AND current_branch = $2",
                payload.repo_url,
                payload.branch,
            )
            if row:
                included_patterns = row["included_patterns"]
                excluded_patterns = row["excluded_patterns"]
    except Exception as db_err:
        print(f"Failed to fetch project patterns: {db_err}")

    # Broadcast job-started immediately BEFORE the blocking work begins
    await _broadcast_job_event("job_started", job_id, payload, "IN_PROGRESS")

    status, commit_hash, error_message, log_output = await asyncio.to_thread(
        _sync_clone_and_index, job_id, payload, included_patterns, excluded_patterns
    )

    # Append Phase 3 completion to the log
    log_file_path = JOBS_DIR / f"{job_id}.log"
    phase3_lines = []
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if status == "SUCCESS":
        phase3_lines.append(f"[{timestamp}] Database update completed successfully.\n")
        phase3_lines.append(f"\n{'='*70}\n[+] PHASE 3 COMPLETE\n{'='*70}\n\n")
        phase3_lines.append(f"\n{'='*70}\n[+] ALL PHASES COMPLETED SUCCESSFULLY\n{'='*70}\n\n")
    else:
        phase3_lines.append(f"[{timestamp}] Job finished with status: {status}\n")

    # Append phase 3 lines to log_output before saving
    log_output += "".join(phase3_lines)

    try:
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE indexing_history
                SET status = $1, commit_hash = $2, error_message = $3, log_output = $4
                WHERE id = $5
                """,
                status,
                commit_hash,
                error_message,
                log_output,
                job_id,
            )
            
        # Also append to the live log file before deleting
        if log_file_path.exists():
            with open(log_file_path, "a", encoding="utf-8") as f:
                f.writelines(phase3_lines)
            log_file_path.unlink()
            
    except Exception as db_err:
        print(f"Failed to update indexing history in DB: {db_err}")

    # Broadcast job completion to all WebSocket clients
    await _broadcast_job_event("job_completed", job_id, payload, status)
