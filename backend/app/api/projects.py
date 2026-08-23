"""Project CRUD. Every query is scoped to the authenticated user (NFR-3)."""

import logging

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, get_owned
from app.db.artifacts import delete_run_artifacts
from app.graph import executor
from app.models import Project, Run
from app.schemas.api import ProjectCreate, ProjectDeleteResponse, ProjectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        created_at=project.created_at,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, user: CurrentUser) -> ProjectResponse:
    project = Project(user_id=str(user.id), name=payload.name, description=payload.description)
    await project.insert()
    return _to_response(project)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(user: CurrentUser) -> list[ProjectResponse]:
    projects = await Project.find(Project.user_id == str(user.id)).to_list()
    return [_to_response(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: CurrentUser) -> ProjectResponse:
    project = await get_owned(Project, project_id, str(user.id), "Project")
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

    runs = await Run.find(Run.project_id == project_id).to_list()
    run_ids = [str(run.id) for run in runs]

    # Stop anything still executing before its documents disappear, or the graph would
    # carry on writing state for a run that no longer exists.
    for run_id in run_ids:
        executor.cancel(run_id)

    artifacts_deleted = await delete_run_artifacts(run_ids)
    runs_deleted = (await Run.find(Run.project_id == project_id).delete()).deleted_count
    await project.delete()

    logger.info(
        "Project %s deleted: %d runs, %d artifacts", project_id, runs_deleted, artifacts_deleted
    )
    return ProjectDeleteResponse(runs_deleted=runs_deleted, artifacts_deleted=artifacts_deleted)
