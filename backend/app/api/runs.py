"""Run CRUD.

`POST /runs` records a run and returns immediately (FR-7). Executing the graph is Phase 4;
until then a created run stays `queued`.
"""

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, get_owned
from app.graph.state import new_run_state
from app.models import Project, Run
from app.schemas.agents import GeneratedFile
from app.schemas.api import (
    FileTreeResponse,
    RunCreate,
    RunCreateResponse,
    RunResponse,
    RunSummary,
)

router = APIRouter(tags=["runs"])


def _to_response(run: Run) -> RunResponse:
    return RunResponse(
        id=str(run.id),
        project_id=run.project_id,
        prompt=run.prompt,
        status=run.status,
        state=run.state,
        metrics=run.metrics,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _to_summary(run: Run) -> RunSummary:
    return RunSummary(
        id=str(run.id),
        project_id=run.project_id,
        prompt=run.prompt,
        status=run.status,
        iterations=run.iterations,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


@router.post("/runs", response_model=RunCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_run(payload: RunCreate, user: CurrentUser) -> RunCreateResponse:
    # Ownership of the project is what authorises the run.
    await get_owned(Project, payload.project_id, str(user.id), "Project")

    run = Run(
        project_id=payload.project_id,
        user_id=str(user.id),
        prompt=payload.prompt,
        status="queued",
    )
    await run.insert()

    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=payload.project_id,
        user_id=str(user.id),
        thread_id=run_id,  # one checkpointer thread per run
        user_prompt=payload.prompt,
        rag_enabled=payload.rag_enabled,
    )
    run.state = {k: v for k, v in state.items() if k not in {"started_at", "finished_at"}}
    run.state["started_at"] = state["started_at"].isoformat()
    await run.save()

    return RunCreateResponse(run_id=run_id, status=run.status)


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, user: CurrentUser) -> RunResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    return _to_response(run)


@router.get("/runs/{run_id}/files", response_model=FileTreeResponse)
async def get_run_files(run_id: str, user: CurrentUser) -> FileTreeResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    raw = run.state.get("files") or []
    return FileTreeResponse(run_id=str(run.id), files=[GeneratedFile(**f) for f in raw])


@router.get("/projects/{project_id}/runs", response_model=list[RunSummary])
async def list_project_runs(project_id: str, user: CurrentUser) -> list[RunSummary]:
    await get_owned(Project, project_id, str(user.id), "Project")
    runs = await Run.find(Run.project_id == project_id).sort(-Run.created_at).to_list()
    return [_to_summary(r) for r in runs]
