"""Shared test fixtures.

Tests run against a real Mongo (the one in docker-compose) but in a separate database,
so a test run can never touch development data. `MONGO_URI` is pinned to that local
instance and `MONGO_DB` to a dedicated name — both set before any app import, because
`app.config.Settings` reads the environment at import time — so the suite stays fast,
offline-capable, and immune to a real cluster's latency or free-tier limits regardless
of what `backend/.env` points the running app at (Atlas, as of this project's move off
local-only Mongo).
"""

import os

os.environ["MONGO_URI"] = "mongodb://localhost:27017"
os.environ["MONGO_DB"] = "codeforge_test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

COLLECTIONS = (
    "users",
    "pending_signups",
    "password_reset_tokens",
    "revoked_tokens",
    "projects",
    "runs",
    # GridFS is two collections and was previously missed here, so artifacts leaked
    # between tests — harmless until a test asserted on the bucket being empty, which
    # then passed alone and failed in the full suite.
    "artifacts.files",
    "artifacts.chunks",
)


@pytest.fixture(autouse=True)
def no_outbound_email(monkeypatch):
    """Sign-up does not verify email in the offline suite.

    The developer's real SMTP credentials are in `.env`, which `Settings` reads at
    import — so without this the suite would hand a live mail server a message for
    every fake address a test registers. Verification is exercised deliberately in
    `test_email_verification.py`, where the mailer is captured rather than called.
    """
    monkeypatch.setattr(settings, "smtp_user", None)
    monkeypatch.setattr(settings, "smtp_password", None)


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
    payload = {
        "first_name": "Tess",
        "last_name": "Tester",
        "email": "tester@example.com",
        "password": "Secret12345",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {
        "email": payload["email"],
        "password": payload["password"],
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }
