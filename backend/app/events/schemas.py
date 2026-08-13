"""SSE event contract — see `docs/STATE_AND_API.md` §4.

Every event the dashboard can receive is modelled here as a discriminated union on
`event`, so a payload cannot be constructed with the wrong shape for its name and the
frontend can generate matching types from one source.

Agents and the sandbox never build these directly; `events/bus.py` is the only writer.
"""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

EventName = Literal[
    "run.started",
    "agent.started",
    "agent.message",
    "agent.completed",
    "approval.required",
    "approval.resolved",
    "loop.iteration",
    "file.written",
    "sandbox.started",
    "sandbox.output",
    "tests.result",
    "run.completed",
    "run.failed",
]


class BaseEvent(BaseModel):
    event: EventName
    at: datetime = Field(default_factory=datetime.now)


class RunStarted(BaseEvent):
    event: Literal["run.started"] = "run.started"
    run_id: str
    prompt: str


class AgentStarted(BaseEvent):
    event: Literal["agent.started"] = "agent.started"
    agent: str
    iteration: int = 0


class AgentMessage(BaseEvent):
    """Human-readable progress line for the timeline, not model output."""

    event: Literal["agent.message"] = "agent.message"
    agent: str
    text: str


class AgentCompleted(BaseEvent):
    event: Literal["agent.completed"] = "agent.completed"
    agent: str
    output_summary: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int = 0


class ApprovalRequired(BaseEvent):
    event: Literal["approval.required"] = "approval.required"
    phase: str
    payload: dict[str, Any] = Field(default_factory=dict)


class ApprovalResolved(BaseEvent):
    event: Literal["approval.resolved"] = "approval.resolved"
    phase: str
    approved: bool
    note: str | None = None


class LoopIteration(BaseEvent):
    """Emitted on every return to the Coder. The dashboard renders this as a visible
    cycle rather than a silent retry (FR-45)."""

    event: Literal["loop.iteration"] = "loop.iteration"
    iteration: int
    trigger: Literal["reviewer", "tester"]
    blocking_findings: int = 0
    failed_tests: int = 0


class FileWritten(BaseEvent):
    event: Literal["file.written"] = "file.written"
    path: str
    bytes: int


class SandboxStarted(BaseEvent):
    event: Literal["sandbox.started"] = "sandbox.started"
    image: str


class SandboxOutput(BaseEvent):
    event: Literal["sandbox.output"] = "sandbox.output"
    stream: Literal["stdout", "stderr"]
    chunk: str


class TestsResult(BaseEvent):
    event: Literal["tests.result"] = "tests.result"
    passed: bool
    total: int = 0
    failed: int = 0


class RunCompleted(BaseEvent):
    event: Literal["run.completed"] = "run.completed"
    status: str
    iterations: int = 0
    duration_ms: int = 0


class RunFailed(BaseEvent):
    event: Literal["run.failed"] = "run.failed"
    status: str
    reason: str


AnyEvent = Annotated[
    RunStarted
    | AgentStarted
    | AgentMessage
    | AgentCompleted
    | ApprovalRequired
    | ApprovalResolved
    | LoopIteration
    | FileWritten
    | SandboxStarted
    | SandboxOutput
    | TestsResult
    | RunCompleted
    | RunFailed,
    Field(discriminator="event"),
]


def format_sse(event: BaseEvent, event_id: int) -> str:
    """Serialise one event to the SSE wire format.

    The `id:` line is what lets a client resume with `Last-Event-ID` after a drop
    (FR-40), so it is never omitted.
    """
    return f"id: {event_id}\nevent: {event.event}\ndata: {event.model_dump_json()}\n\n"


HEARTBEAT = ": keep-alive\n\n"  # comment frame; stops proxies closing an idle stream
