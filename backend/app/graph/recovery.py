"""Bounded recovery of provider failures from a trusted graph checkpoint."""

from typing import Any

MAX_STAGE_RETRIES = 3
STAGES = ("pm", "architect", "coder", "reviewer", "tester")
PREDECESSORS = {
    "pm": "__start__",
    "architect": "pm",
    "coder": "coder_gate",
    "reviewer": "coder",
    "tester": "reviewer",
}


def _get(value: Any, key: str, default: Any = None) -> Any:
    return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)


def retry_stage(state: dict[str, Any]) -> str | None:
    if state.get("status") != "failed_llm" or state.get("stage_retries", 0) >= MAX_STAGE_RETRIES:
        return None
    latest_errors = {_get(error, "agent"): _get(error, "code") for error in state.get("errors", [])}
    failures = {agent for agent, code in latest_errors.items() if code == "llm_exhausted"}
    if not state.get("requirements"):
        stage = "pm"
    elif not state.get("design"):
        stage = "architect"
    else:
        written = {_get(file, "path") for file in state.get("files", [])}
        missing = any(
            _get(file, "path") not in written for file in _get(state["design"], "files", [])
        )
        if missing or not written:
            if state.get("loop_history"):
                return None  # Re-entering a failed fix pass could spend or bypass a repair budget.
            stage = "coder"
        elif state.get("review") is None:
            stage = "reviewer"
        elif not state.get("test_files"):
            stage = "tester"
        else:
            return None
    if stage not in failures:
        return None
    approvals = state.get("approvals", {})
    required = () if stage == "pm" else ("pm",) if stage == "architect" else ("pm", "architect")
    if any(
        not _get(approvals.get(phase), "approved") or _get(approvals.get(phase), "auto", False)
        for phase in required
    ):
        return None
    if stage == "tester" and not _get(state.get("review"), "passed"):
        return None
    return stage


def retry_update(state: dict[str, Any], stage: str, attempt: int) -> dict[str, Any]:
    update: dict[str, Any] = {
        "status": "running",
        "finished_at": None,
        "current_agent": None,
        "awaiting_approval": None,
        "stage_retries": attempt,
        "retry_stage": stage,
        "sandbox": None,
        "tests": None,
    }
    if stage in ("pm", "architect", "coder", "reviewer"):
        update.update(review=None, test_files=[])
    if stage == "pm":
        update.update(requirements=None, design=None, code=None, files=[])
    if stage == "architect":
        update.update(design=None, code=None, files=[])
    keep = () if stage == "pm" else ("pm",) if stage == "architect" else ("pm", "architect")
    update["approvals"] = {
        phase: record for phase, record in state.get("approvals", {}).items() if phase in keep
    }
    return update
