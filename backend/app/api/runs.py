"""Run CRUD.

`POST /runs` records a run and returns immediately (FR-7). Executing the graph is Phase 4;
until then a created run stays `queued`.
"""

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Response, status

from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import NotFoundError
from app.db.artifacts import list_artifacts, read_artifact
from app.events import events
from app.graph import executor
from app.graph.state import new_run_state
from app.models import Project, Run
from app.schemas.agents import GeneratedFile
from app.schemas.api import (
    ApprovalRequest,
    ApprovalResponse,
    FileTreeResponse,
    RunCreate,
    RunCreateResponse,
    RunResponse,
    RunSummary,
)
from app.schemas.artifacts import ArtifactListResponse

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
    run.state["rag_enabled"] = payload.rag_enabled
    await run.save()

    # Returns immediately; the pipeline continues in the background and the client
    # attaches to GET /runs/{id}/stream to watch it (FR-7).
    await executor.start_run(run)

    return RunCreateResponse(run_id=run_id, status="running")


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


@router.get("/runs/{run_id}/artifacts", response_model=ArtifactListResponse)
async def get_run_artifacts(run_id: str, user: CurrentUser) -> ArtifactListResponse:
    """List stored artifacts for a run: the generated tree, sandbox log and test report,
    one set per loop iteration."""
    run = await get_owned(Run, run_id, str(user.id), "Run")
    return await list_artifacts(str(run.id))


@router.get("/runs/{run_id}/artifacts/{file_id}")
async def download_run_artifact(run_id: str, file_id: str, user: CurrentUser) -> Response:
    """Download one artifact.

    Ownership is checked against the run, not the file: a GridFS id must not be a way to
    reach another user's output.
    """
    run = await get_owned(Run, run_id, str(user.id), "Run")

    listing = await list_artifacts(str(run.id))
    match = next((a for a in listing.artifacts if a.file_id == file_id), None)
    if match is None:
        raise NotFoundError("Artifact not found")

    payload = await read_artifact(file_id)
    return Response(
        content=payload,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{Path(match.filename).name}"'},
    )


@router.post("/runs/{run_id}/approve", response_model=ApprovalResponse)
async def approve_run(run_id: str, payload: ApprovalRequest, user: CurrentUser) -> ApprovalResponse:
    """Resolve a human checkpoint: resume the pipeline, or end the run.

    The graph is paused at an `interrupt_before`; resuming means invoking the same
    thread again, which continues from the checkpoint rather than restarting.
    """
    run = await get_owned(Run, run_id, str(user.id), "Run")

    await events.approval_resolved(str(run.id), payload.phase, payload.approved, payload.note)

    approvals = dict((run.state or {}).get("approvals") or {})
    approvals[payload.phase] = {
        "approved": payload.approved,
        "note": payload.note,
        "at": datetime.now().isoformat(),
    }
    run.state = {**(run.state or {}), "approvals": approvals}

    if not payload.approved:
        run.status = "rejected"
        run.updated_at = datetime.now()
        await run.save()
        await events.run_failed(str(run.id), "rejected", payload.note or "rejected by the user")
        return ApprovalResponse(
            run_id=str(run.id), phase=payload.phase, approved=False, status="rejected"
        )

    run.status = "running"
    run.updated_at = datetime.now()
    await run.save()
    await executor.resume_run(str(run.id))

    return ApprovalResponse(
        run_id=str(run.id), phase=payload.phase, approved=True, status="running"
    )


@router.post("/runs/{run_id}/cancel", response_model=RunCreateResponse)
async def cancel_run(run_id: str, user: CurrentUser) -> RunCreateResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    executor.cancel(str(run.id))
    run.status = "cancelled"
    run.updated_at = datetime.now()
    await run.save()
    return RunCreateResponse(run_id=str(run.id), status="cancelled")
