"""GitLab API client — centralizes all interactions with the GitLab REST API."""

import datetime
import urllib.parse

import httpx

from backend.core.config import GITLAB_PAT


async def fetch_project_info(repo_url: str, branch: str) -> dict:
    """
    Fetch project metadata and latest commit from GitLab API.

    Returns a dict with keys:
        project_id, project_name, path, namespace, path_with_namespace,
        gitlab_url, default_branch, last_activity_at, commit_sha
    """
    parsed_url = urllib.parse.urlparse(repo_url)
    host = parsed_url.netloc
    path = parsed_url.path.strip("/")
    if path.endswith(".git"):
        path = path[:-4]

    encoded_path = urllib.parse.quote(path, safe="")
    api_url = f"https://{host}/api/v4/projects/{encoded_path}"

    headers = {}
    if GITLAB_PAT:
        headers["PRIVATE-TOKEN"] = GITLAB_PAT

    async with httpx.AsyncClient() as client:
        # Fetch project metadata
        res = await client.get(api_url, headers=headers)
        if res.status_code != 200:
            raise Exception(
                f"GitLab API error: {res.status_code} - {res.text}"
            )

        project_data = res.json()

        # Parse last_activity_at
        last_activity_at_str = project_data.get("last_activity_at")
        last_activity_at = None
        if last_activity_at_str:
            last_activity_at = datetime.datetime.fromisoformat(
                last_activity_at_str.replace("Z", "+00:00")
            ).replace(tzinfo=None)

        # Fetch latest commit for the branch
        commit_api_url = (
            f"https://{host}/api/v4/projects/{encoded_path}"
            f"/repository/commits/{branch}"
        )
        commit_res = await client.get(commit_api_url, headers=headers)
        commit_sha = ""
        if commit_res.status_code == 200:
            commit_sha = commit_res.json().get("id", "")

    return {
        "project_id": str(project_data.get("id")),
        "project_name": project_data.get("name"),
        "path": path,
        "namespace": project_data.get("namespace", {}).get("full_path", ""),
        "path_with_namespace": project_data.get("path_with_namespace"),
        "gitlab_url": project_data.get("web_url"),
        "default_branch": project_data.get("default_branch", "main"),
        "last_activity_at": last_activity_at,
        "commit_sha": commit_sha,
    }


async def fetch_project_tree(repo_url: str, branch: str = "") -> list[dict]:
    """
    Fetch the file tree for a project from GitLab.
    Limits to 1000 items to avoid timeouts on huge repos during preview.
    """
    parsed_url = urllib.parse.urlparse(repo_url)
    host = parsed_url.netloc
    path = parsed_url.path.strip("/")
    if path.endswith(".git"):
        path = path[:-4]

    encoded_path = urllib.parse.quote(path, safe="")
    
    # We will use the GraphQL API or REST API. REST API for repository tree:
    # GET /projects/:id/repository/tree?recursive=true&per_page=100
    
    headers = {}
    if GITLAB_PAT:
        headers["PRIVATE-TOKEN"] = GITLAB_PAT
        
    async with httpx.AsyncClient() as client:
        # We need the default branch if branch is empty
        if not branch:
            info = await fetch_project_info(repo_url, branch)
            branch = info["default_branch"]
            
        tree_api_url = f"https://{host}/api/v4/projects/{encoded_path}/repository/tree"
        params = {
            "recursive": "true",
            "per_page": 100, # fetch up to 100 per page
            "ref": branch
        }
        
        # We will fetch up to 5 pages (500 items max) to keep preview fast
        all_items = []
        page = 1
        
        while page <= 5:
            params["page"] = page
            res = await client.get(tree_api_url, headers=headers, params=params)
            
            if res.status_code != 200:
                raise Exception(f"GitLab API error fetching tree: {res.status_code} - {res.text}")
                
            items = res.json()
            if not items:
                break
                
            all_items.extend(items)
            
            # Check if there's a next page
            next_page = res.headers.get("X-Next-Page")
            if not next_page:
                break
            page += 1
            
            
        return all_items


async def fetch_project_branches(repo_url: str) -> list[str]:
    """Fetch a list of branch names for the project."""
    parsed_url = urllib.parse.urlparse(repo_url)
    host = parsed_url.netloc
    path = parsed_url.path.strip("/")
    if path.endswith(".git"):
        path = path[:-4]

    encoded_path = urllib.parse.quote(path, safe="")
    api_url = f"https://{host}/api/v4/projects/{encoded_path}/repository/branches"

    headers = {}
    if GITLAB_PAT:
        headers["PRIVATE-TOKEN"] = GITLAB_PAT

    async with httpx.AsyncClient() as client:
        res = await client.get(api_url, headers=headers)
        if res.status_code != 200:
            raise Exception(f"GitLab API error fetching branches: {res.status_code} - {res.text}")

        branches = res.json()
        return [b["name"] for b in branches]
