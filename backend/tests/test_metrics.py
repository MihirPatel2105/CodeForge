"""Acceptance gates and the persisted Phase 8 metrics, without live services."""

import asyncio
from datetime import UTC, datetime, timedelta

from app.graph.metrics import score_run
from app.graph.persistence import save_state
from app.models import Run


def _state(*, sandbox=None, tests=None, **extra):
    start = datetime(2026, 9, 15, 10, tzinfo=UTC)
    state = {
        "run_id": "run-1",
        "files": [
            {"path": path, "content": "value = 1\n"}
            for path in ("database.py", "models.py", "schemas.py", "main.py")
        ],
        "test_files": [{"path": "test_main.py", "content": "def test_ok():\n    assert True\n"}],
        "sandbox": sandbox,
        "tests": tests,
        "started_at": start,
        "finished_at": start + timedelta(seconds=12),
        "rag_enabled": True,
        "errors": [],
        "loop_count": 0,
        "loop_history": [],
    }
    state.update(extra)
    return state


def test_green_run_reaches_l5_and_counts_reviewer_cleared_findings():
    state = _state(
        sandbox={"exit_code": 0, "stdout": "CODEFORGE_BOOT_OK\n3 passed in 0.1s"},
        tests={"passed": True, "total": 3, "failed": 0},
        loop_count=1,
        loop_history=[{"trigger": "reviewer", "blocking_findings": 2, "outcome": "review_cleared"}],
        llm_attempts=[
            {"model": "groq/a", "ok": False, "error": "429 rate limit", "fallback": True},
            {"model": "openrouter/b", "ok": True, "fallback": False},
        ],
        llm_tokens=85,
    )
    scored = score_run(state, status="succeeded", prompt_id="p01")
    assert scored.acceptance_level == "L5"
    assert scored.generation_succeeded and scored.tests_passed
    assert scored.test_pass_ratio == 1.0
    assert scored.blocking_findings_total == scored.findings_fixed == 2
    assert scored.end_to_end_ms == 12_000
    assert scored.prompt_id == "p01"
    assert scored.llm_calls == 2
    assert scored.provider_fallbacks == 1
    assert scored.tokens_total == 85


def test_booted_app_with_failing_tests_reaches_l4_only():
    state = _state(
        sandbox={"exit_code": 1, "stdout": "CODEFORGE_BOOT_OK\n2 failed, 3 passed"},
        tests={"passed": False, "total": 5, "failed": 2},
    )
    scored = score_run(state, status="failed_max_loops")
    assert scored.acceptance_level == "L4"
    assert scored.generation_succeeded and not scored.tests_passed
    assert scored.test_pass_ratio == 0.6
    assert scored.failure_category == "loop_exhausted"


def test_syntax_error_fails_before_sandbox_result_can_count():
    state = _state(
        sandbox={"exit_code": 0, "stdout": "CODEFORGE_BOOT_OK"},
        tests={"passed": True, "total": 1, "failed": 0},
    )
    state["files"][0]["content"] = "def broken(:\n"
    scored = score_run(state, status="succeeded")
    assert scored.acceptance_level == "L1"
    assert not scored.generation_succeeded
    assert scored.failure_category == "schema"


def test_infrastructure_failure_is_excluded_from_denominator():
    state = _state(errors=[{"code": "SandboxUnavailableError", "message": "Docker stopped"}])
    scored = score_run(state, status="failed_sandbox")
    assert scored.exclusion_reason == "infrastructure"
    assert scored.failure_category is None


def test_mid_run_quota_failure_is_included_and_counts_failed_attempts():
    state = _state(
        test_files=[],
        llm_attempts=[
            {"model": "groq/a", "ok": True, "fallback": False},
            {"model": "openrouter/b", "ok": False, "error": "model unavailable", "fallback": True},
            {"model": "mistral/c", "ok": False, "error": "429 rate limit", "fallback": False},
        ],
        errors=[{"code": "llm_exhausted", "message": "model unavailable"}],
    )
    scored = score_run(state, status="failed_llm")
    assert scored.exclusion_reason is None
    assert scored.failure_category == "quota"
    assert scored.llm_calls == 3


def test_all_providers_429_before_completion_is_excluded():
    state = _state(
        files=[],
        test_files=[],
        llm_attempts=[{"model": "groq/a", "ok": False, "error": "429", "fallback": False}],
    )
    scored = score_run(state, status="failed_llm")
    assert scored.exclusion_reason == "quota_before_completion"
    assert scored.failure_category is None


def test_terminal_save_populates_run_metrics(monkeypatch):
    state = _state(
        sandbox={"exit_code": 0, "stdout": "CODEFORGE_BOOT_OK\n1 passed"},
        tests={"passed": True, "total": 1, "failed": 0},
        status="succeeded",
    )

    class SavedRun:
        status = "running"
        iterations = 0
        metrics = None

        async def save(self):
            self.saved = True

    saved = SavedRun()

    async def get(_run_id):
        return saved

    monkeypatch.setattr(Run, "get", get)
    asyncio.run(save_state(state))
    assert saved.saved
    assert saved.metrics is not None and saved.metrics.acceptance_level == "L5"
