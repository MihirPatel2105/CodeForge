"""Retry claims tested with isolated atomic storage; never touches Mongo or providers."""

import asyncio
from copy import deepcopy
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api import run_retry
from app.core.exceptions import ConflictError, NotFoundError, UsageLimitError
from app.models import Run


def setup(monkeypatch):
    from test_run_retry import state

    saved = state()
    document = {
        "id": "run-1",
        "user_id": "user-1",
        "project_id": "project-1",
        "status": "failed_llm",
        "state": saved,
        "updated_at": datetime.now(UTC),
        "metrics": None,
    }
    old = deepcopy(document)
    launches, released, removed = [], [], []

    class Collection:
        async def update_one(self, query, update):
            matches = all(
                document.get("id" if key == "_id" else key) == value for key, value in query.items()
            )
            if matches:
                document.update(deepcopy(update["$set"]))
            return SimpleNamespace(modified_count=int(matches))

        async def find_one(self, query):
            return (
                document
                if all(
                    document.get("id" if key == "_id" else key) == value
                    for key, value in query.items()
                )
                else None
            )

    class Admissions:
        async def delete_one(self, query):
            removed.append(query["_id"])

    async def launch(*args):
        launches.append(args[3])

    async def release(key):
        released.append(key)

    monkeypatch.setattr(
        Run, "get", AsyncMock(side_effect=lambda key: SimpleNamespace(**deepcopy(old)))
    )
    monkeypatch.setattr(Run, "get_pymongo_collection", lambda: Collection())
    monkeypatch.setattr(
        run_retry,
        "compile_graph",
        lambda **kwargs: SimpleNamespace(
            aget_state=AsyncMock(return_value=SimpleNamespace(values=saved, next=()))
        ),
    )
    monkeypatch.setattr(run_retry, "check_run_submission_limit", AsyncMock())
    monkeypatch.setattr(run_retry, "reserve_run", AsyncMock(return_value="monthly"))
    monkeypatch.setattr(run_retry, "confirm_run_admission", AsyncMock())
    monkeypatch.setattr(run_retry.executor, "retry_run", launch)
    monkeypatch.setattr(run_retry.executor, "is_running", lambda key: False)
    monkeypatch.setattr(run_retry, "release_count", release)
    monkeypatch.setattr(
        run_retry, "get_database", lambda: SimpleNamespace(run_admissions=Admissions())
    )
    return document, launches, released, removed


def test_concurrent_retry_requests_launch_only_once(monkeypatch):
    document, launches, _, _ = setup(monkeypatch)

    async def scenario():
        results = await asyncio.gather(
            *[
                run_retry.retry_failed_run("run-1", SimpleNamespace(id="user-1"), SimpleNamespace())
                for _ in range(2)
            ],
            return_exceptions=True,
        )
        assert sum(isinstance(result, ConflictError) for result in results) == 1
        assert launches == ["reviewer"]
        assert document["state"]["stage_retries"] == 1
        assert document["status"] == "running"
        assert document["metrics"] is None

    asyncio.run(scenario())


def test_foreign_owner_is_denied_before_any_recovery(monkeypatch):
    document, launches, _, _ = setup(monkeypatch)
    with pytest.raises(NotFoundError):
        asyncio.run(
            run_retry.retry_failed_run("run-1", SimpleNamespace(id="other"), SimpleNamespace())
        )
    assert launches == []
    assert document["status"] == "failed_llm"


def test_usage_limit_restores_original_failure_without_consuming_retry(monkeypatch):
    document, launches, released, removed = setup(monkeypatch)
    monkeypatch.setattr(run_retry, "reserve_run", AsyncMock(side_effect=UsageLimitError("limit")))
    with pytest.raises(UsageLimitError):
        asyncio.run(
            run_retry.retry_failed_run("run-1", SimpleNamespace(id="user-1"), SimpleNamespace())
        )
    assert document["status"] == "failed_llm"
    assert "stage_retries" not in document["state"]
    assert launches == [] and released == []
    assert removed == ["run-1"]


def test_admission_expiry_releases_monthly_reservation(monkeypatch):
    document, launches, released, removed = setup(monkeypatch)
    monkeypatch.setattr(
        run_retry, "confirm_run_admission", AsyncMock(side_effect=ConflictError("expired"))
    )
    with pytest.raises(ConflictError):
        asyncio.run(
            run_retry.retry_failed_run("run-1", SimpleNamespace(id="user-1"), SimpleNamespace())
        )
    assert document["status"] == "failed_llm"
    assert launches == []
    assert released == ["monthly"] and removed == ["run-1"]


def test_missing_or_foreign_checkpoint_disables_retry(monkeypatch):
    document, launches, _, _ = setup(monkeypatch)
    monkeypatch.setattr(
        run_retry,
        "compile_graph",
        lambda **kwargs: SimpleNamespace(
            aget_state=AsyncMock(return_value=SimpleNamespace(values={}, next=()))
        ),
    )
    info = asyncio.run(run_retry.retry_info("run-1", SimpleNamespace(id="user-1")))
    assert info.stage is None
    assert launches == [] and document["status"] == "failed_llm"


def test_cancel_during_admission_does_not_launch_or_restore_failed_status(monkeypatch):
    document, launches, released, removed = setup(monkeypatch)

    async def reserve(run, user):
        document["status"] = "cancelled"
        return "monthly"

    monkeypatch.setattr(run_retry, "reserve_run", reserve)
    with pytest.raises(ConflictError):
        asyncio.run(
            run_retry.retry_failed_run("run-1", SimpleNamespace(id="user-1"), SimpleNamespace())
        )
    assert document["status"] == "cancelled"
    assert launches == []
    assert released == ["monthly"] and removed == ["run-1"]


@pytest.mark.parametrize("stage,pending", [("pm", "architect"), ("architect", "coder_gate")])
def test_failed_plan_at_approval_boundary_can_be_recovered(monkeypatch, stage, pending):
    document, _, _, _ = setup(monkeypatch)
    saved = document["state"]
    saved.update(
        requirements=None if stage == "pm" else saved["requirements"],
        design=None,
        errors=[{"agent": stage, "code": "llm_exhausted"}],
    )
    monkeypatch.setattr(Run, "get", AsyncMock(return_value=SimpleNamespace(**document)))
    monkeypatch.setattr(
        run_retry,
        "compile_graph",
        lambda **kwargs: SimpleNamespace(
            aget_state=AsyncMock(return_value=SimpleNamespace(values=saved, next=(pending,)))
        ),
    )
    info = asyncio.run(run_retry.retry_info("run-1", SimpleNamespace(id="user-1")))
    assert info.stage == stage and info.remaining == 3
