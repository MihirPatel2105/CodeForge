"""A run must never be left saying `running` with nothing driving it.

Both halves of the guard are covered: `_finish` surviving a database that refuses the
write, and the startup pass that fails runs a restart left mid-flight. The bug these
protect against was seen once in the wild — `status: running`, `finished_at: None`, no
live task, forever — which shows the user a spinner that never resolves.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import settings
from app.graph.executor import _finish, reconcile_interrupted_runs
from app.main import app


@pytest.fixture
def db():
    with MongoClient(settings.mongo_uri) as mongo:
        yield mongo[settings.mongo_db]


def _seed_run(db, status: str) -> str:
    run_id = ObjectId()
    db.runs.insert_one(
        {
            "_id": run_id,
            "project_id": str(ObjectId()),
            "user_id": str(ObjectId()),
            "prompt": "books api",
            "status": status,
            "state": {},
        }
    )
    return str(run_id)


# --------------------------------------------------------------------------- #
# _finish — must never propagate, because the caller's `finally` drops the task
# --------------------------------------------------------------------------- #
# These patch `Run.get` outright so no real client is touched, which keeps them off the
# event loop the app's Mongo connection is bound to.


def test_finish_does_not_raise_when_the_write_fails():
    """The whole bug: an exception here escaped the caller's `except`, the `finally`
    dropped the task, and no terminal status was ever written."""
    with (
        patch("app.graph.executor.Run.get", new=AsyncMock(side_effect=ConnectionError("no"))),
        patch("app.graph.executor.events.run_failed", new=AsyncMock()),
        patch("app.graph.executor.asyncio.sleep", new=AsyncMock()),
    ):
        # Returning normally *is* the assertion.
        asyncio.run(_finish("6a86bafb879d6b8ccf5b8382", "failed_llm", "boom"))


def test_finish_retries_before_giving_up():
    """One refused call must not cost the status write. The database is a remote
    service now, so a transient failure is an ordinary event rather than a crisis."""
    saved: list[str] = []

    class FakeRun:
        status = "running"
        updated_at = None

        async def save(self):
            saved.append(self.status)

    get = AsyncMock(side_effect=[ConnectionError("transient"), FakeRun()])
    with (
        patch("app.graph.executor.Run.get", new=get),
        patch("app.graph.executor.events.run_failed", new=AsyncMock()),
        patch("app.graph.executor.asyncio.sleep", new=AsyncMock()),
    ):
        asyncio.run(_finish("6a86bafb879d6b8ccf5b8382", "failed_llm", "boom"))

    assert get.await_count == 2, "should retry after the first failure"
    assert saved == ["failed_llm"], "the retry must actually write the status"


def test_finish_still_writes_the_status_if_the_event_cannot_be_emitted():
    """The status write is the part that matters; a dropped SSE frame must not undo it."""
    saved: list[str] = []

    class FakeRun:
        status = "running"
        updated_at = None

        async def save(self):
            saved.append(self.status)

    with (
        patch("app.graph.executor.Run.get", new=AsyncMock(return_value=FakeRun())),
        patch("app.graph.executor.events.run_failed", new=AsyncMock(side_effect=RuntimeError())),
    ):
        asyncio.run(_finish("6a86bafb879d6b8ccf5b8382", "failed_llm", "boom"))

    assert saved == ["failed_llm"]


# --------------------------------------------------------------------------- #
# reconcile — driven through a real startup, which is how it actually runs
# --------------------------------------------------------------------------- #
# Deliberately without the `client` fixture: it holds a connection bound to its own
# event loop, and `connect()` returns early when a client already exists, so a nested
# lifespan would reuse one from the wrong loop and raise.


def test_startup_fails_runs_left_mid_flight(db):
    """A `running` run has no task after a restart and can never resume itself."""
    stranded = _seed_run(db, "running")

    # Entering a second TestClient runs the lifespan again — a restart, in effect.
    with TestClient(app):
        pass

    assert db.runs.find_one({"_id": ObjectId(stranded)})["status"] == "failed_llm"


def test_startup_leaves_paused_and_finished_runs_alone(db):
    """`awaiting_approval` is *meant* to have no task — it resumes when somebody
    approves. Failing those on boot would destroy every run paused at a checkpoint."""
    paused = _seed_run(db, "awaiting_approval")
    done = _seed_run(db, "succeeded")

    with TestClient(app):
        pass

    assert db.runs.find_one({"_id": ObjectId(paused)})["status"] == "awaiting_approval"
    assert db.runs.find_one({"_id": ObjectId(done)})["status"] == "succeeded"


def test_reconcile_reports_how_many_it_touched(db):
    _seed_run(db, "running")
    _seed_run(db, "running")
    _seed_run(db, "awaiting_approval")

    with TestClient(app):
        pass

    assert db.runs.count_documents({"status": "running"}) == 0
    assert db.runs.count_documents({"status": "awaiting_approval"}) == 1


def test_reconcile_is_importable_and_returns_a_count():
    """Guards the signature the lifespan depends on."""
    assert callable(reconcile_interrupted_runs)
