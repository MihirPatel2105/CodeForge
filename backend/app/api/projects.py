"""Project CRUD. Every query is scoped to the authenticated user (NFR-3)."""

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, get_owned
from app.models import Project
from app.schemas.api import ProjectCreate, ProjectResponse

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
