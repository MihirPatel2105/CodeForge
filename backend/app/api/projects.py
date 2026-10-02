"""Project CRUD. Every query is scoped to the authenticated user (NFR-3)."""

import logging
import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import UsageLimitError
from app.db import aggregate_rows
from app.db.artifacts import delete_run_artifacts
from app.graph import executor
from app.models import Deployment, Project, Run
from app.sandbox.deployment import destroy_deployment
from app.schemas.api import (
    ProjectCreate,
    ProjectDeleteResponse,
    ProjectOverviewItem,
    ProjectOverviewPage,
    ProjectResponse,
    ProjectRunStats,
    ProjectUpdate,
    RunSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        archived=project.archived,
        created_at=project.created_at,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, user: CurrentUser) -> ProjectResponse:
    if user.project_limit is not None:
        count = await Project.find(Project.user_id == str(user.id)).count()
        if count >= user.project_limit:
            raise UsageLimitError(f"Project limit reached ({user.project_limit}).")
    project = Project(user_id=str(user.id), name=payload.name, description=payload.description)
    await project.insert()
    return _to_response(project)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(user: CurrentUser) -> list[ProjectResponse]:
    projects = await Project.find(Project.user_id == str(user.id)).to_list()
    return [_to_response(p) for p in projects]


@router.get("/overview", response_model=ProjectOverviewPage)
async def project_overview(
    user: CurrentUser,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    q: str = Query(default="", max_length=120),
    archived: bool = False,
) -> ProjectOverviewPage:
    """Bound the list response and aggregate card metrics on the server."""
    owner = str(user.id)
    query: dict = {"user_id": owner, "archived": True if archived else {"$ne": True}}
    if q.strip():
        term = re.escape(q.strip())
        query["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
        ]
    total_projects = await Project.find(Project.user_id == owner).count()
    matching_projects = await Project.find(query).count()
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise HTTPException(status_code=422, detail="Invalid project cursor")
        query["_id"] = {"$lt": ObjectId(cursor)}
    page = await Project.find(query).sort("-_id").limit(limit + 1).to_list()
    projects = page[:limit]
    next_cursor = str(projects[-1].id) if len(page) > limit else None

    owner_totals = await aggregate_rows(
        "runs",
        [
            {"$match": {"user_id": owner}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "succeeded": {"$sum": {"$cond": [{"$eq": ["$status", "succeeded"]}, 1, 0]}},
                }
            },
        ],
        1,
    )
    totals = owner_totals[0] if owner_totals else {"total": 0, "succeeded": 0}

    by_project: dict[str, dict] = {}
    if projects:
        run_view = {
            "id": {"$toString": "$_id"},
            "project_id": "$project_id",
            "prompt": "$prompt",
            "parent_run_id": "$parent_run_id",
            "change_request": "$change_request",
            "status": "$status",
            "iterations": "$iterations",
            "created_at": "$created_at",
            "updated_at": "$updated_at",
        }
        grouped = await aggregate_rows(
            "runs",
            [
                {
                    "$match": {
                        "user_id": owner,
                        "project_id": {"$in": [str(p.id) for p in projects]},
                    }
                },
                {
                    "$group": {
                        "_id": "$project_id",
                        "total": {"$sum": 1},
                        "succeeded": {"$sum": {"$cond": [{"$eq": ["$status", "succeeded"]}, 1, 0]}},
                        "failed": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$in": [
                                            "$status",
                                            [
                                                "failed_max_loops",
                                                "failed_sandbox",
                                                "failed_llm",
                                            ],
                                        ]
                                    },
                                    1,
                                    0,
                                ]
                            }
                        },
                        "active": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$in": [
                                            "$status",
                                            ["queued", "running", "awaiting_approval"],
                                        ]
                                    },
                                    1,
                                    0,
                                ]
                            }
                        },
                        "avg_loops": {
                            "$avg": {
                                "$cond": [
                                    {
                                        "$in": [
                                            "$status",
                                            ["queued", "running", "awaiting_approval"],
                                        ]
                                    },
                                    None,
                                    "$iterations",
                                ]
                            }
                        },
                        "recent": {
                            "$topN": {
                                "n": 14,
                                "sortBy": {"created_at": -1, "_id": -1},
                                "output": run_view,
                            }
                        },
                    }
                },
            ],
        )
        by_project = {row["_id"]: row for row in grouped}

    items = []
    for project in projects:
        row = by_project.get(str(project.id))
        recent = [RunSummary.model_validate(run) for run in row["recent"]] if row else []
        stats = ProjectRunStats(
            total=row["total"] if row else 0,
            succeeded=row["succeeded"] if row else 0,
            failed=row["failed"] if row else 0,
            active=row["active"] if row else 0,
            avg_loops=row["avg_loops"] if row else None,
            last=recent[0] if recent else None,
        )
        items.append(
            ProjectOverviewItem(
                **_to_response(project).model_dump(), stats=stats, recent_runs=recent
            )
        )
    return ProjectOverviewPage(
        items=items,
        next_cursor=next_cursor,
        total_projects=total_projects,
        matching_projects=matching_projects,
        total_runs=totals["total"],
        total_succeeded=totals["succeeded"],
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: CurrentUser) -> ProjectResponse:
    project = await get_owned(Project, project_id, str(user.id), "Project")
    return _to_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, payload: ProjectUpdate, user: CurrentUser
) -> ProjectResponse:
    project = await get_owned(Project, project_id, str(user.id), "Project")
    await project.set(payload.model_dump())
    return _to_response(project)


@router.delete("/{project_id}", response_model=ProjectDeleteResponse)
async def delete_project(project_id: str, user: CurrentUser) -> ProjectDeleteResponse:
    """Remove a project and everything it owns. There is no undo.

    The cascade mirrors account deletion, because the same three things need removing
    and GridFS is the one everybody forgets: artifacts live in their own pair of
    collections, so deleting a run does not take its stored file trees with it. Without
    this they would survive as orphans keyed by a run id that no longer resolves.

    Order matters. Children go first, so a failure partway leaves the project still
    present to find the leftovers by; deleting the project first would strand its runs
    with no owner to search on.
    """
    project = await get_owned(Project, project_id, str(user.id), "Project")

    runs = await Run.find(Run.project_id == project_id, Run.user_id == str(user.id)).to_list()
    run_ids = [str(run.id) for run in runs]

    # Stop anything still executing before its documents disappear, or the graph would
    # carry on writing state for a run that no longer exists.
    for run_id in run_ids:
        executor.cancel(run_id)

    deployments = await Deployment.find(
        Deployment.project_id == project_id, Deployment.user_id == str(user.id)
    ).to_list()
    for deployment in deployments:
        await destroy_deployment(str(deployment.id))
        await deployment.delete()

    artifacts_deleted = await delete_run_artifacts(run_ids)
    runs_deleted = (
        await Run.find(Run.project_id == project_id, Run.user_id == str(user.id)).delete()
    ).deleted_count
    await project.delete()

    logger.info(
        "Project %s deleted: %d runs, %d artifacts", project_id, runs_deleted, artifacts_deleted
    )
    return ProjectDeleteResponse(runs_deleted=runs_deleted, artifacts_deleted=artifacts_deleted)
