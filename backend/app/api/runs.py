"""Run CRUD.

`POST /runs` records a run and returns immediately (FR-7). Executing the graph is Phase 4;
until then a created run stays `queued`.
"""

import re
from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import ConflictError, NotFoundError, UsageLimitError
from app.db import aggregate_rows
from app.db.artifacts import list_artifacts, read_artifact, unzip_tree
from app.events import events
from app.graph import executor
from app.graph.metrics import score_run
from app.graph.state import new_run_state
from app.models import Project, Run
from app.schemas.agents import GeneratedFile
from app.schemas.api import (
    ApprovalRequest,
    ApprovalResponse,
    FileHistoryResponse,
    FileHistoryVersion,
    FileTreeResponse,
    ProjectRunPage,
    ProjectRunStats,
    RevisionRequest,
    RunCreate,
    RunCreateResponse,
    RunResponse,
    RunSummary,
)
from app.schemas.artifacts import ArtifactListResponse, artifact_download_filename

router = APIRouter(tags=["runs"])


def _record_terminal_metrics(run: Run, status: str) -> None:
    """Immediate user exits bypass the graph's terminal node."""
    state = {**(run.state or {}), "status": status, "finished_at": datetime.now(UTC).isoformat()}
    run.state = state
    run.metrics = score_run(state, status=status)


def _to_response(run: Run) -> RunResponse:
    return RunResponse(
        id=str(run.id),
        project_id=run.project_id,
        prompt=run.prompt,
        parent_run_id=run.parent_run_id,
        change_request=run.change_request,
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
        parent_run_id=run.parent_run_id,
        change_request=run.change_request,
        status=run.status,
        iterations=run.iterations,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


@router.post("/runs", response_model=RunCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_run(payload: RunCreate, user: CurrentUser) -> RunCreateResponse:
    # Ownership of the project is what authorises the run.
    await get_owned(Project, payload.project_id, str(user.id), "Project")

    if user.monthly_run_limit is not None:
        now = datetime.now(UTC)
        month_start = datetime(now.year, now.month, 1, tzinfo=UTC)
        count = await Run.find(
            {"user_id": str(user.id), "created_at": {"$gte": month_start}}
        ).count()
        if count >= user.monthly_run_limit:
            raise UsageLimitError(f"Monthly run limit reached ({user.monthly_run_limit}).")

    parent = None
    if payload.parent_run_id:
        parent = await get_owned(Run, payload.parent_run_id, str(user.id), "Run")
        if parent.project_id != payload.project_id:
            raise ConflictError("The source run belongs to a different project.")
        if parent.status != "succeeded" or not parent.metrics or not parent.metrics.tests_passed:
            raise ConflictError("Choose a run that passed its tests before improving it.")
    prompt = payload.prompt.strip()
    if not prompt or len(prompt) > 12000:
        raise HTTPException(status_code=422, detail="Describe the API in 1 to 12000 characters")
    run = Run(
        parent_run_id=payload.parent_run_id,
        change_request=prompt if parent else None,
        project_id=payload.project_id,
        user_id=str(user.id),
        prompt=prompt,
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
    if parent:
        run.state["revision_context"] = {
            "requirements": parent.state.get("requirements"),
            "design": parent.state.get("design"),
            "files": parent.state.get("files") or [],
            "change_request": prompt,
        }
    await run.save()

    # Returns immediately; the pipeline continues in the background and the client
    # attaches to GET /runs/{id}/stream to watch it (FR-7).
    await executor.start_run(run)

    return RunCreateResponse(run_id=run_id, status="running")


@router.get("/runs/attention", response_model=list[RunSummary])
async def attention_runs(user: CurrentUser) -> list[RunSummary]:
    owner = str(user.id)
    pending = (
        await Run.find({"user_id": owner, "status": "awaiting_approval"})
        .sort("-updated_at")
        .limit(30)
        .to_list()
    )
    completed = (
        await Run.find({"user_id": owner, "status": {"$in": list(_TERMINAL_STATUSES)}})
        .sort("-updated_at")
        .limit(20)
        .to_list()
    )
    return [
        _to_summary(run) for run in [*pending, *completed] if not executor.is_running(str(run.id))
    ]


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, user: CurrentUser) -> RunResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    return _to_response(run)


@router.get("/runs/{run_id}/files", response_model=FileTreeResponse)
async def get_run_files(run_id: str, user: CurrentUser) -> FileTreeResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    # Both halves of what the run produced. `test_files` was previously omitted, which
    # broke the dashboard's code viewer in a non-obvious way: the file rail is built
    # from SSE `file.written` events (which do include the test suite) and auto-selects
    # the most recent file, so it landed on `test_main.py` — whose content this endpoint
    # never returned. The panel then fell through to its "No files yet" empty state
    # while sitting next to a rail listing five files.
    raw = (run.state.get("files") or []) + (run.state.get("test_files") or [])
    return FileTreeResponse(run_id=str(run.id), files=[GeneratedFile(**f) for f in raw])


@router.get("/runs/{run_id}/file-history", response_model=FileHistoryResponse)
async def get_run_file_history(run_id: str, user: CurrentUser) -> FileHistoryResponse:
    """Return saved per-iteration trees after checking run ownership."""
    run = await get_owned(Run, run_id, str(user.id), "Run")
    listing = await list_artifacts(str(run.id))
    versions = []
    for artifact in listing.artifacts:
        if artifact.kind == "file_tree":
            payload = await read_artifact(artifact.file_id)
            versions.append(
                FileHistoryVersion(iteration=artifact.iteration, files=unzip_tree(payload))
            )
    return FileHistoryResponse(run_id=str(run.id), versions=versions)


@router.get("/projects/{project_id}/runs", response_model=list[RunSummary])
async def list_project_runs(project_id: str, user: CurrentUser) -> list[RunSummary]:
    await get_owned(Project, project_id, str(user.id), "Project")
    runs = (
        await Run.find(Run.project_id == project_id, Run.user_id == str(user.id))
        .sort(-Run.created_at)
        .to_list()
    )
    return [_to_summary(r) for r in runs]


@router.get("/projects/{project_id}/runs/page", response_model=ProjectRunPage)
async def project_run_page(
    project_id: str,
    user: CurrentUser,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    q: str = Query(default="", max_length=200),
    outcome: str = Query(default="", max_length=40),
) -> ProjectRunPage:
    await get_owned(Project, project_id, str(user.id), "Project")
    owner = str(user.id)
    match = {"project_id": project_id, "user_id": owner}
    query = dict(match)
    if q.strip():
        query["prompt"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    if outcome:
        query["status"] = outcome
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise HTTPException(status_code=422, detail="Invalid run cursor")
        query["_id"] = {"$lt": ObjectId(cursor)}
    page = await Run.find(query).sort("-_id").limit(limit + 1).to_list()
    items = [_to_summary(run) for run in page[:limit]]
    rows = await aggregate_rows(
        "runs",
        [
            {"$match": match},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "succeeded": {"$sum": {"$cond": [{"$eq": ["$status", "succeeded"]}, 1, 0]}},
                    "failed": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$in": [
                                        "$status",
                                        ["failed_max_loops", "failed_sandbox", "failed_llm"],
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
                                {"$in": ["$status", ["queued", "running", "awaiting_approval"]]},
                                None,
                                "$iterations",
                            ]
                        }
                    },
                }
            },
        ],
        1,
    )
    row = rows[0] if rows else {}
    return ProjectRunPage(
        items=items,
        next_cursor=items[-1].id if len(page) > limit else None,
        stats=ProjectRunStats(
            total=row.get("total", 0),
            succeeded=row.get("succeeded", 0),
            failed=row.get("failed", 0),
            avg_loops=row.get("avg_loops"),
            last=items[0] if items else None,
        ),
    )


@router.get("/runs/{run_id}/artifacts", response_model=ArtifactListResponse)
async def get_run_artifacts(run_id: str, user: CurrentUser) -> ArtifactListResponse:
    """List stored artifacts for a run: the generated tree, sandbox log and test report,
    one set per loop iteration."""
    run = await get_owned(Run, run_id, str(user.id), "Run")
    project = await get_owned(Project, run.project_id, str(user.id), "Project")
    listing = await list_artifacts(str(run.id))
    for artifact in listing.artifacts:
        artifact.filename = artifact_download_filename(
            project.name, artifact.kind, artifact.iteration
        )
    return listing


@router.get("/runs/{run_id}/artifacts/{file_id}")
async def download_run_artifact(run_id: str, file_id: str, user: CurrentUser) -> Response:
    """Download one artifact.

    Ownership is checked against the run, not the file: a GridFS id must not be a way to
    reach another user's output.
    """
    run = await get_owned(Run, run_id, str(user.id), "Run")
    project = await get_owned(Project, run.project_id, str(user.id), "Project")

    listing = await list_artifacts(str(run.id))
    match = next((a for a in listing.artifacts if a.file_id == file_id), None)
    if match is None:
        raise NotFoundError("Artifact not found")

    payload = await read_artifact(file_id)
    if match.kind == "file_tree":
        from app.db.download_package import add_run_guide

        payload = add_run_guide(payload)
    return Response(
        content=payload,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                'attachment; filename="'
                f'{artifact_download_filename(project.name, match.kind, match.iteration)}"'
            )
        },
    )


async def _claim_checkpoint(run: Run, phase: str, expected_revision: int | None = None) -> None:
    revisions = sum(item["phase"] == phase for item in run.state.get("checkpoint_revisions", []))
    if expected_revision is not None and revisions != expected_revision:
        raise ConflictError("This plan has changed. Review the latest checkpoint first.")
    checkpoint = next(
        (event for event in reversed(run.events) if event.get("event") == "approval.required"), None
    )
    expected = (run.state or {}).get("awaiting_approval")
    if checkpoint:
        expected = checkpoint.get("data", {}).get("phase", expected)
    if run.status != "awaiting_approval" or phase != expected:
        raise ConflictError("This checkpoint is no longer awaiting that decision. Refresh the run.")
    result = await Run.get_pymongo_collection().update_one(
        {"_id": run.id, "status": "awaiting_approval", "updated_at": run.updated_at},
        {"$set": {"status": "running", "updated_at": datetime.now(UTC)}},
    )
    if result.modified_count != 1:
        raise ConflictError("A decision is already being processed.")


@router.post("/runs/{run_id}/revise", response_model=RunCreateResponse)
async def revise_run(run_id: str, payload: RevisionRequest, user: CurrentUser) -> RunCreateResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    history = (run.state or {}).get("checkpoint_revisions") or []
    if sum(item["phase"] == payload.phase for item in history) >= 3:
        raise ConflictError("This checkpoint has reached its three-revision limit.")
    await _claim_checkpoint(run, payload.phase, payload.expected_revision)
    await executor.revise_run(run_id, payload.phase, payload.note)
    return RunCreateResponse(run_id=run_id, status="running")


@router.post("/runs/{run_id}/approve", response_model=ApprovalResponse)
async def approve_run(run_id: str, payload: ApprovalRequest, user: CurrentUser) -> ApprovalResponse:
    """Resolve a human checkpoint: resume the pipeline, or end the run.

    The graph is paused at an `interrupt_before`; resuming means invoking the same
    thread again, which continues from the checkpoint rather than restarting.
    """
    run = await get_owned(Run, run_id, str(user.id), "Run")

    if payload.phase == "final":
        if run.status not in _TERMINAL_STATUSES or executor.is_running(run_id):
            raise ConflictError("Final review is available after the run finishes.")
        record = {
            "approved": payload.approved,
            "note": payload.note,
            "at": datetime.now(UTC).isoformat(),
        }
        await run.set({"state.approvals.final": record})
        return ApprovalResponse(
            run_id=run_id, phase="final", approved=payload.approved, status=run.status
        )
    await _claim_checkpoint(run, payload.phase, payload.expected_revision)

    # `run` is a snapshot read before any of the emits below, each of which persists via
    # an atomic `$push` (bus.py). `run.save()` further down writes this whole in-memory
    # document back, so it MUST come first — saving it after an emit would silently
    # overwrite that emit's push with the pre-emit snapshot, dropping the event from the
    # durable log even though its id was already consumed (a real bug this order fixes:
    # `approval.resolved` was vanishing from replay while still delivering live).
    approvals = dict((run.state or {}).get("approvals") or {})
    approvals[payload.phase] = {
        "approved": payload.approved,
        "note": payload.note,
        "at": datetime.now(UTC).isoformat(),
    }
    run.state = {**(run.state or {}), "approvals": approvals}

    if not payload.approved:
        run.status = "rejected"
        _record_terminal_metrics(run, "rejected")
        run.updated_at = datetime.now()
        await run.save()
        await events.approval_resolved(str(run.id), payload.phase, payload.approved, payload.note)
        await events.run_failed(str(run.id), "rejected", payload.note or "rejected by the user")
        return ApprovalResponse(
            run_id=str(run.id), phase=payload.phase, approved=False, status="rejected"
        )

    run.status = "running"
    run.updated_at = datetime.now()
    await run.save()
    await events.approval_resolved(str(run.id), payload.phase, payload.approved, payload.note)
    await executor.resume_run(str(run.id))

    return ApprovalResponse(
        run_id=str(run.id), phase=payload.phase, approved=True, status="running"
    )


_TERMINAL_STATUSES = {
    "succeeded",
    "failed_max_loops",
    "failed_sandbox",
    "failed_llm",
    "rejected",
    "cancelled",
}


@router.post("/runs/{run_id}/cancel", response_model=RunCreateResponse)
async def cancel_run(run_id: str, user: CurrentUser) -> RunCreateResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")

    # `run.status` alone cannot decide whether there is anything left to cancel. A node
    # whose model chain is exhausted records `failed_llm` and the graph *keeps going* —
    # `after_reviewer` deliberately sends a failed review on to the Tester — so a run
    # that is still executing can carry a terminal-looking status for minutes. Trusting
    # it made Cancel a no-op that still answered 200: confirmed live 2026-08-19, where
    # the graph ran on through a sandbox execution and a whole loop iteration after the
    # user pressed Cancel. A live task is the authoritative "still running" signal.
    had_active_task = executor.cancel(str(run.id))
    if not had_active_task and run.status in _TERMINAL_STATUSES:
        return RunCreateResponse(run_id=str(run.id), status=run.status)

    run.status = "cancelled"
    _record_terminal_metrics(run, "cancelled")
    run.updated_at = datetime.now()
    await run.save()

    # A run mid-node has an asyncio task; cancelling it raises CancelledError inside
    # `_execute`, whose own handler emits `run.failed` once that unwinds. A run paused
    # at an approval checkpoint has no task at all by then — LangGraph's `ainvoke`
    # already returned when it hit the interrupt — so nothing else will ever emit the
    # event that tells a connected client this happened. Emit it here for that case
    # only, or a live SSE view sits on "awaiting approval" forever even though the
    # database already says cancelled.
    if not had_active_task:
        await events.run_failed(str(run.id), "cancelled", "cancelled by the user")

    return RunCreateResponse(run_id=str(run.id), status="cancelled")
