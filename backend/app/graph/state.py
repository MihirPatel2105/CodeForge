"""RunState — the project's spine. See `docs/STATE_AND_API.md` §1.

Every agent reads and writes this object; the LangGraph checkpointer persists it at
each transition. It is a `TypedDict` because that is what `StateGraph` expects, with
`total=False` so partially-populated state is legal mid-run.

Rules that hold everywhere:

* `files` is always the *current* tree. Previous iterations live in `loop_history`.
* Nothing is removed on failure — a partial run is a reportable result.
* No raw LLM text is stored here, only validated schema objects.
"""

from datetime import datetime
from typing import Literal, TypedDict

from pydantic import BaseModel, Field

from app.schemas.agents import (
    CodeOutput,
    Design,
    GeneratedFile,
    Requirements,
    ReviewResult,
    TestResult,
)
from app.schemas.sandbox import SandboxResult

DEFAULT_MAX_LOOPS = 3

RunStatus = Literal[
    "queued",
    "running",
    "awaiting_approval",
    "succeeded",
    "failed_max_loops",  # loop cap hit — partial result kept
    "failed_sandbox",  # container or runtime failure
    "failed_llm",  # every provider exhausted
    "rejected",  # human rejected at a checkpoint
    "cancelled",
]

ApprovalPhase = Literal["pm", "architect", "final"]

# What sent control back to the Coder for a fix pass.
LoopTrigger = Literal["reviewer", "tester"]

AgentName = Literal["pm", "architect", "coder", "reviewer", "tester"]


class ApprovalRecord(BaseModel):
    approved: bool
    note: str | None = None
    at: datetime
    auto: bool = False  # set by the evaluation harness; keeps eval runs distinguishable


class LoopRecord(BaseModel):
    """One trip around the review <-> test cycle. Feeds the Phase 8 metrics."""

    iteration: int
    trigger: LoopTrigger
    blocking_findings: int = 0
    failed_tests: int = 0
    outcome: str | None = None  # filled in once the following pass resolves
    at: datetime


class RunError(BaseModel):
    agent: str | None = None
    code: str
    message: str
    at: datetime


class RunState(TypedDict, total=False):
    # identity
    run_id: str
    project_id: str
    user_id: str
    thread_id: str  # LangGraph checkpointer thread

    # input
    user_prompt: str

    # phase outputs
    requirements: Requirements | None
    design: Design | None
    code: CodeOutput | None
    files: list[GeneratedFile]  # current code tree, overwritten each fix pass
    test_files: list[GeneratedFile]
    review: ReviewResult | None
    tests: TestResult | None
    sandbox: SandboxResult | None

    # loop control
    loop_count: int
    max_loops: int
    loop_history: list[LoopRecord]

    # human-in-the-loop
    awaiting_approval: ApprovalPhase | None
    approvals: dict[str, ApprovalRecord]

    # meta
    status: RunStatus
    current_agent: AgentName | None
    prompt_versions: dict[str, str]  # agent -> template version
    rag_enabled: bool
    errors: list[RunError]
    started_at: datetime
    finished_at: datetime | None


def new_run_state(
    *,
    run_id: str,
    project_id: str,
    user_id: str,
    thread_id: str,
    user_prompt: str,
    rag_enabled: bool = True,
    max_loops: int = DEFAULT_MAX_LOOPS,
) -> RunState:
    """Build the initial state for a run. Collections start empty, never unset, so
    nodes can append without first checking for existence."""
    return RunState(
        run_id=run_id,
        project_id=project_id,
        user_id=user_id,
        thread_id=thread_id,
        user_prompt=user_prompt,
        requirements=None,
        design=None,
        code=None,
        files=[],
        test_files=[],
        review=None,
        tests=None,
        sandbox=None,
        loop_count=0,
        max_loops=max_loops,
        loop_history=[],
        awaiting_approval=None,
        approvals={},
        status="queued",
        current_agent=None,
        prompt_versions={},
        rag_enabled=rag_enabled,
        errors=[],
        started_at=datetime.now(),
        finished_at=None,
    )


class RunMetrics(BaseModel):
    """Written to `runs.metrics` at completion. See `docs/ACCEPTANCE.md`."""

    generation_succeeded: bool = False  # reached acceptance level L3
    tests_passed: bool = False  # reached acceptance level L5
    test_pass_ratio: float = 0.0
    iterations: int = 0
    blocking_findings_total: int = 0
    findings_fixed: int = 0  # review-loop effectiveness
    rag_enabled: bool = False
    llm_calls: int = 0
    tokens_total: int = 0
    provider_fallbacks: int = 0  # how often a 429 forced a provider switch
    end_to_end_ms: int = 0
    failure_category: str | None = None
    prompt_id: str | None = None  # links a run to backend/tests/prompts.json
    notes: list[str] = Field(default_factory=list)
