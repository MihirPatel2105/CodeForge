"""Mechanical acceptance scoring for a completed run (docs/ACCEPTANCE.md)."""

import ast
import re
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from app.graph.state import RunMetrics

REQUIRED_APP = {"main.py", "models.py", "schemas.py", "database.py"}
_PLACEHOLDER = re.compile(r"\bTODO\b|rest of the code|implementation here|pass\s*#", re.I)
_OBJECTID = re.compile(r"ObjectId.*(serializ|JSON)|not JSON serializable.*ObjectId", re.I | re.S)
_QUOTA = re.compile(r"\b429\b|rate.?limit|quota|resource.?exhausted", re.I)


def _data(value: Any) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump()
    return value if isinstance(value, dict) else {}


def _when(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed
        except ValueError:
            return None
    return None


def _tree_level(state: dict[str, Any]) -> int:
    files = [_data(f) for f in [*(state.get("files") or []), *(state.get("test_files") or [])]]
    by_path = {f.get("path"): f.get("content", "") for f in files}
    if not REQUIRED_APP <= by_path.keys() or "test_main.py" not in by_path:
        return 0
    for path, content in by_path.items():
        if not isinstance(content, str) or not content.strip() or _PLACEHOLDER.search(content):
            return 0
        if path.endswith(".py"):
            try:
                tree = ast.parse(content, filename=path)
            except SyntaxError:
                return 1
            if any(
                isinstance(node, ast.Expr)
                and isinstance(node.value, ast.Constant)
                and node.value.value is Ellipsis
                for node in ast.walk(tree)
            ):
                return 0
    return 2


def score_run(state: dict[str, Any], *, status: str, prompt_id: str | None = None) -> RunMetrics:
    """Score final state only; an in-flight `failed_llm` status is not terminal."""
    llm_attempts = [_data(attempt) for attempt in (state.get("llm_attempts") or [])]
    metrics = RunMetrics(
        rag_enabled=bool(state.get("rag_enabled", False)),
        iterations=int(state.get("loop_count") or 0),
        prompt_id=prompt_id or state.get("prompt_id"),
        llm_calls=len(llm_attempts),
        tokens_total=int(state.get("llm_tokens") or 0),
    )
    metrics.provider_fallbacks = sum(
        1
        for attempt in llm_attempts
        if attempt.get("fallback") and _QUOTA.search(str(attempt.get("error", "")))
    )
    if metrics.llm_calls and not metrics.tokens_total:
        metrics.notes.append("Structured-call token usage unavailable from the provider response")
    started = _when(state.get("started_at"))
    finished = _when(state.get("finished_at"))
    if started and finished:
        metrics.end_to_end_ms = max(0, int((finished - started).total_seconds() * 1000))

    history = [_data(h) for h in (state.get("loop_history") or [])]
    reviewer_loops = [h for h in history if h.get("trigger") == "reviewer"]
    metrics.blocking_findings_total = sum(
        int(h.get("blocking_findings") or 0) for h in reviewer_loops
    )
    metrics.findings_fixed = sum(
        int(h.get("blocking_findings") or 0)
        for h in reviewer_loops
        if h.get("outcome") == "review_cleared"
    )

    errors = [_data(e) for e in (state.get("errors") or [])]
    error_text = "\n".join(str(e.get("message", "")) for e in errors)
    provider_error_text = "\n".join(str(a.get("error", "")) for a in llm_attempts)
    if status in {"cancelled", "rejected"}:
        metrics.exclusion_reason = status
    elif any(e.get("code") == "SandboxUnavailableError" for e in errors):
        metrics.exclusion_reason = "infrastructure"
    elif (
        llm_attempts
        and not any(attempt.get("ok") for attempt in llm_attempts)
        and all(_QUOTA.search(str(attempt.get("error", ""))) for attempt in llm_attempts)
    ) or (
        not llm_attempts
        and not any(state.get(key) for key in ("requirements", "design", "files"))
        and errors
        and all(_QUOTA.search(str(e.get("message", ""))) for e in errors)
    ):
        metrics.exclusion_reason = "quota_before_completion"

    level = _tree_level(state)
    sandbox = _data(state.get("sandbox"))
    tests = _data(state.get("tests"))
    if level >= 2:
        boot_ok = "CODEFORGE_BOOT_OK" in str(sandbox.get("stdout", ""))
        # Earlier sandbox images had no probe. A fully green suite is still evidence
        # that the application booted, but a failing suite cannot establish L3.
        if boot_ok or (sandbox.get("exit_code") == 0 and tests.get("passed") is True):
            level = 3
    if level >= 3 and sandbox.get("exit_code") in (0, 1) and int(tests.get("total") or 0) > 0:
        level = 4
        metrics.test_pass_ratio = max(
            0.0,
            min(1.0, (int(tests["total"]) - int(tests.get("failed") or 0)) / int(tests["total"])),
        )
        if (
            sandbox.get("exit_code") == 0
            and int(tests.get("failed") or 0) == 0
            and tests.get("passed")
        ):
            level = 5
    metrics.acceptance_level = f"L{level}"
    metrics.generation_succeeded = level >= 3
    metrics.tests_passed = level == 5

    if level < 5 and metrics.exclusion_reason is None:
        if (
            status == "failed_llm"
            and any(e.get("code") == "llm_exhausted" for e in errors)
            and _QUOTA.search(error_text + "\n" + provider_error_text)
        ):
            metrics.failure_category = "quota"
        elif level < 2:
            metrics.failure_category = "schema"
        elif _OBJECTID.search(
            error_text
            + "\n"
            + str(sandbox.get("stdout", ""))
            + "\n"
            + str(sandbox.get("stderr", ""))
        ):
            metrics.failure_category = "objectid"
        elif sandbox.get("timed_out") or sandbox.get("exit_code") == 124:
            metrics.failure_category = "timeout"
        elif status == "failed_max_loops":
            metrics.failure_category = "loop_exhausted"
        else:
            metrics.failure_category = "other"
    return metrics
