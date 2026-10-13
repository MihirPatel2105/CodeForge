"""Owner-only manual recovery; atomic claims prevent duplicate executions."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request

from app.core.abuse_limits import check_run_submission_limit
from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import ConflictError
from app.core.usage_limits import confirm_run_admission, release_count, reserve_run
from app.db import get_database
from app.graph import executor
from app.graph.build import compile_graph, thread_config
from app.graph.persistence import serialise
from app.graph.recovery import MAX_STAGE_RETRIES, retry_stage, retry_update
from app.models import Run
from app.schemas.api import RunCreateResponse, RunRetryInfo

router = APIRouter(tags=["runs"])


async def _plan(run: Run) -> tuple[Any, dict, dict, str] | None:
    run_id = str(run.id)
    if executor.is_running(run_id) or not run.state.get("finished_at"):
        return None
    if run.status != "failed_llm" or retry_stage(run.state) is None:
        return None
    graph = compile_graph(with_approvals=True)
    config = thread_config(run_id)
    snapshot = await graph.aget_state(config)
    values = snapshot.values
    stage = retry_stage(values)
    allowed_pending = {"pm": ("architect",), "architect": ("coder_gate",)}
    if (snapshot.next and snapshot.next != allowed_pending.get(stage)) or any(
        values.get(key) != expected
        for key, expected in (
            ("run_id", run_id),
            ("user_id", run.user_id),
            ("project_id", run.project_id),
        )
    ):
        return None
    if stage != retry_stage(run.state) or values.get("stage_retries", 0) != run.state.get(
        "stage_retries", 0
    ):
        return None
    return graph, config, values, stage


@router.get("/runs/{run_id}/retry", response_model=RunRetryInfo)
async def retry_info(run_id: str, user: CurrentUser) -> RunRetryInfo:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    plan = await _plan(run)
    return (
        RunRetryInfo(stage=plan[3], remaining=MAX_STAGE_RETRIES - plan[2].get("stage_retries", 0))
        if plan
        else RunRetryInfo()
    )


@router.post("/runs/{run_id}/retry", response_model=RunCreateResponse, status_code=202)
async def retry_failed_run(run_id: str, user: CurrentUser, request: Request) -> RunCreateResponse:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    plan = await _plan(run)
    if plan is None:
        raise ConflictError("This run cannot resume from a failed stage. You can start a new run.")
    await check_run_submission_limit(request, str(user.id))
    graph, config, values, stage = plan
    update = retry_update(values, stage, values.get("stage_retries", 0) + 1)
    claimed_at = datetime.now(UTC)
    collection = Run.get_pymongo_collection()
    claim = await collection.update_one(
        {"_id": run.id, "status": "failed_llm", "updated_at": run.updated_at},
        {
            "$set": {
                "status": "running",
                "updated_at": claimed_at,
                "metrics": None,
                "state": serialise({**values, **update}),
            }
        },
    )
    if claim.modified_count != 1:
        raise ConflictError("A retry is already being processed. Refresh the run.")
    reservation = None
    try:
        reservation = await reserve_run(run, user)
        await confirm_run_admission(run_id)
        if not await collection.find_one(
            {"_id": run.id, "status": "running", "updated_at": claimed_at}
        ):
            raise ConflictError("This retry was stopped before execution began.")
        await executor.retry_run(run_id, graph, config, stage, update["stage_retries"], update)
    except BaseException:
        if not executor.is_running(run_id):
            await collection.update_one(
                {"_id": run.id, "status": "running", "updated_at": claimed_at},
                {
                    "$set": {
                        "status": run.status,
                        "state": run.state,
                        "metrics": run.metrics.model_dump() if run.metrics else None,
                        "updated_at": run.updated_at,
                    }
                },
            )
            if reservation:
                await release_count(reservation)
            await get_database().run_admissions.delete_one({"_id": run_id})
        raise
    return RunCreateResponse(run_id=run_id, status="running")
