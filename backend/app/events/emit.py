"""Convenience emitters used by the graph nodes.

Nodes call these rather than constructing events, so the wording that reaches the
dashboard lives in one place. `docs/UI_BRIEF.md` §4.2 shows the timeline these produce —
every line should read as a short human sentence, not a log record.
"""

from typing import Any

from app.events import schemas as ev
from app.events.bus import emit

AGENT_LABELS = {
    "pm": "PM",
    "architect": "Architect",
    "coder": "Coder",
    "reviewer": "Reviewer",
    "tester": "Tester",
}


async def run_started(run_id: str, prompt: str) -> None:
    await emit(run_id, ev.RunStarted(run_id=run_id, prompt=prompt))


async def agent_started(run_id: str, agent: str, iteration: int = 0) -> None:
    await emit(run_id, ev.AgentStarted(agent=agent, iteration=iteration))


async def agent_message(run_id: str, agent: str, text: str) -> None:
    await emit(run_id, ev.AgentMessage(agent=agent, text=text))


async def agent_completed(
    run_id: str, agent: str, summary: dict[str, Any], duration_ms: int
) -> None:
    await emit(
        run_id,
        ev.AgentCompleted(agent=agent, output_summary=summary, duration_ms=duration_ms),
    )


async def agent_failed(
    run_id: str, agent: str, code: str, message: str, iteration: int = 0
) -> None:
    await emit(
        run_id,
        ev.AgentFailed(agent=agent, code=code, message=message[:400], iteration=iteration),
    )


async def approval_required(run_id: str, phase: str, payload: dict[str, Any]) -> None:
    await emit(run_id, ev.ApprovalRequired(phase=phase, payload=payload))


async def approval_resolved(
    run_id: str, phase: str, approved: bool, note: str | None = None
) -> None:
    await emit(run_id, ev.ApprovalResolved(phase=phase, approved=approved, note=note))


async def loop_iteration(
    run_id: str, iteration: int, trigger: str, blocking: int = 0, failed_tests: int = 0
) -> None:
    """The event the dashboard is built around.

    `docs/UI_BRIEF.md` calls this the demo's centrepiece: it is the moment work travels
    backwards to the Coder. It carries everything the UI needs to narrate that — which
    iteration, what triggered it, and how much was wrong — so the frontend never has to
    fetch anything to render it.
    """
    await emit(
        run_id,
        ev.LoopIteration(
            iteration=iteration,
            trigger=trigger,
            blocking_findings=blocking,
            failed_tests=failed_tests,
        ),
    )


async def file_written(run_id: str, path: str, content: str) -> None:
    await emit(run_id, ev.FileWritten(path=path, bytes=len(content.encode())))


async def sandbox_started(run_id: str, image: str) -> None:
    await emit(run_id, ev.SandboxStarted(image=image))


async def sandbox_output(run_id: str, chunk: str, stream: str = "stdout") -> None:
    await emit(run_id, ev.SandboxOutput(stream=stream, chunk=chunk))


async def tests_result(run_id: str, passed: bool, total: int, failed: int) -> None:
    await emit(run_id, ev.TestsResult(passed=passed, total=total, failed=failed))


async def run_completed(run_id: str, status: str, iterations: int, duration_ms: int) -> None:
    await emit(
        run_id,
        ev.RunCompleted(status=status, iterations=iterations, duration_ms=duration_ms),
    )


async def run_failed(run_id: str, status: str, reason: str) -> None:
    await emit(run_id, ev.RunFailed(status=status, reason=reason[:400]))


# --------------------------------------------------------------------------- #
# Phrasing helpers — the words a viewer actually reads
# --------------------------------------------------------------------------- #


def describe_requirements(requirements) -> str:
    names = ", ".join(e.name for e in requirements.entities)
    fields = ", ".join(f.name for f in requirements.entities[0].fields[:4])
    return f"Identified entity: {names} ({fields})"


def describe_design(design) -> str:
    explicit = sum(1 for e in design.endpoints if e.response_model)
    return f"{len(design.endpoints)} endpoints designed, {explicit} with explicit response models"


def describe_review(review) -> str:
    blocking = len(review.blocking)
    if not review.findings:
        return "No issues found"
    if blocking:
        return f"{len(review.findings)} findings, {blocking} blocking"
    return f"{len(review.findings)} findings, none blocking — passed"
