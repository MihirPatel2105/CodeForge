"""Writing graph state back to the `runs` collection.

LangGraph's checkpointer is what makes a run *resumable*; this is what makes it
*readable* — the REST API and dashboard query `runs`, not the checkpoint collection.
Both are written at every node transition (FR-27).
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models import Run


def serialise(state: dict[str, Any]) -> dict[str, Any]:
    """Turn RunState into something Mongo accepts.

    Pydantic objects become plain documents; datetimes are kept as-is because Mongo
    stores them natively.
    """
    out: dict[str, Any] = {}
    for key, value in state.items():
        if isinstance(value, BaseModel):
            out[key] = value.model_dump(mode="json")
        elif isinstance(value, list) and value and isinstance(value[0], BaseModel):
            out[key] = [v.model_dump(mode="json") for v in value]
        elif isinstance(value, datetime):
            out[key] = value
        else:
            out[key] = value
    return out


async def save_state(state: dict[str, Any]) -> None:
    """Persist the current state onto the run document. Best-effort: a failure here must
    not abort a run that is otherwise progressing."""
    run_id = state.get("run_id")
    if not run_id:
        return

    run = await Run.get(run_id)
    if run is None:
        return

    run.state = serialise(state)
    run.status = state.get("status", run.status)
    run.iterations = state.get("loop_count", run.iterations)
    run.updated_at = datetime.now()
    await run.save()
