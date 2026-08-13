from datetime import datetime
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.graph.state import RunMetrics, RunStatus


class Run(Document):
    project_id: str
    user_id: str
    prompt: str
    status: RunStatus = "queued"

    # RunState snapshot. Stored as a plain document rather than a typed model because
    # it is a TypedDict owned by the graph, and its shape evolves with the graph.
    state: dict[str, Any] = Field(default_factory=dict)

    # Denormalised from state["loop_count"] so run-history lists can show an iteration
    # count without loading every full state snapshot. Written on each node transition.
    iterations: int = 0

    metrics: RunMetrics | None = None

    # Every SSE event is appended here so a reloaded client can rebuild the timeline
    # (docs/STATE_AND_API.md §4).
    events: list[dict[str, Any]] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "runs"
        indexes = [
            IndexModel([("project_id", ASCENDING)]),
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]
