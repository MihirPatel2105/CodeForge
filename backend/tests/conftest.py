"""Shared test fixtures.

Tests run against a real Mongo (the one in docker-compose) but in a separate database,
so a test run can never touch development data. `MONGO_DB` is set before any app import
because `app.config.Settings` reads the environment at import time.
"""

import os

os.environ["MONGO_DB"] = "codeforge_test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

COLLECTIONS = ("users", "projects", "runs")


@pytest.fixture(autouse=True)
def no_background_runs(monkeypatch):
    """Stop `POST /runs` from actually launching the pipeline.

    Since Phase 7 that endpoint starts the graph in the background, which would make the
    offline suite fire real LLM calls — slow, flaky, and it would spend the free-tier
    quota this project runs on. Tests assert that a launch was *requested*; the pipeline
    itself is exercised by the opt-in live suites.
    """
    launched: list[str] = []

    async def fake_start(run, *, with_approvals: bool = True) -> None:
        launched.append(str(run.id))
        run.status = "running"
        await run.save()

    monkeypatch.setattr("app.graph.executor.start_run", fake_start)
    monkeypatch.setattr("app.graph.executor.resume_run", lambda run_id: _noop())
    return launched


async def _noop() -> None:
    return None


@pytest.fixture
def client():
    # Context manager form is required: entering it runs the lifespan, which is what
    # connects Mongo and initialises Beanie.
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_database():
    """Empty the collections after every test.

    Documents are deleted rather than the database dropped, so the indexes created at
    startup survive — without them the unique-email constraint would silently vanish
    after the first test.
    """
    yield
    with MongoClient(settings.mongo_uri) as mongo:
        db = mongo[settings.mongo_db]
        for name in COLLECTIONS:
            db[name].delete_many({})


@pytest.fixture
def registered_user(client):
    """A registered account plus its auth header."""
    payload = {"email": "tester@example.com", "password": "secret12345"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {
        "email": payload["email"],
        "password": payload["password"],
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }
