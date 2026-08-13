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
