"""Closing an account.

The assertions worth having here are the negative ones: that a wrong password changes
nothing, and that nothing belonging to the account survives it. A delete that half worked
is worse than one that failed outright, because nobody would notice.
"""

import pytest
from pymongo import MongoClient

from app.config import settings


@pytest.fixture
def notices(monkeypatch):
    """Capture the deletion confirmation instead of mailing it."""
    sent: list[dict] = []

    async def fake_send(*, to: str, first_name: str = "", projects: int = 0, runs: int = 0) -> None:
        sent.append({"to": to, "first_name": first_name, "projects": projects, "runs": runs})

    monkeypatch.setattr("app.api.auth.send_account_deleted_email", fake_send)
    return sent


@pytest.fixture
def db():
    with MongoClient(settings.mongo_uri) as mongo:
        yield mongo[settings.mongo_db]


@pytest.fixture
def user_with_data(client, registered_user):
    """An account that owns something, so the cascade has work to do."""
    project = client.post(
        "/projects",
        json={"name": "Book API", "description": "books"},
        headers=registered_user["headers"],
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    run = client.post(
        "/runs",
        json={"project_id": project_id, "prompt": "an API for books", "use_rag": False},
        headers=registered_user["headers"],
    )
    assert run.status_code == 202  # accepted: the pipeline starts in the background
    return {**registered_user, "project_id": project_id, "run_id": run.json()["run_id"]}


def _delete(client, headers, password="Secret12345", confirmation="DELETE"):
    return client.post(
        "/auth/delete-account",
        json={"password": password, "confirmation": confirmation},
        headers=headers,
    )


def test_deletes_the_account_and_everything_it_owns(client, user_with_data, db):
    response = _delete(client, user_with_data["headers"])

    assert response.status_code == 200
    assert response.json()["projects_deleted"] == 1
    assert response.json()["runs_deleted"] == 1

    assert db.users.find_one({"email": user_with_data["email"]}) is None
    assert db.projects.count_documents({"_id": {"$exists": True}}) == 0
    assert db.runs.count_documents({"_id": {"$exists": True}}) == 0


def test_the_token_stops_working_afterwards(client, user_with_data):
    _delete(client, user_with_data["headers"])

    # The JWT is still cryptographically valid — it is the user it points at that is
    # gone. If this returned 200 the token would outlive the account.
    response = client.get("/auth/me", headers=user_with_data["headers"])
    assert response.status_code == 401


def test_a_wrong_password_deletes_nothing(client, user_with_data, db):
    response = _delete(client, user_with_data["headers"], password="not-my-password")

    assert response.status_code == 401
    assert db.users.find_one({"email": user_with_data["email"]}) is not None
    assert db.projects.count_documents({}) == 1
    assert db.runs.count_documents({}) == 1


@pytest.mark.parametrize("confirmation", ["", "delete", "Delete", "DELETE ACCOUNT", "yes"])
def test_the_confirmation_must_be_typed_exactly(client, user_with_data, db, confirmation):
    """Anything but the exact word is refused, including the lowercase near-miss — the
    dialog asks for one specific string so that it cannot be cleared by reflex."""
    response = _delete(client, user_with_data["headers"], confirmation=confirmation)

    assert response.status_code == 422
    assert db.users.find_one({"email": user_with_data["email"]}) is not None


def test_surrounding_whitespace_in_the_confirmation_is_forgiven(client, user_with_data):
    """Typed input picks up stray spaces; the word is what matters, not the padding."""
    assert _delete(client, user_with_data["headers"], confirmation="  DELETE  ").status_code == 200


def test_deleting_requires_a_session(client):
    response = client.post(
        "/auth/delete-account", json={"password": "Secret12345", "confirmation": "DELETE"}
    )
    assert response.status_code == 401


def test_another_account_is_untouched(client, user_with_data, db):
    other = client.post(
        "/auth/register",
        json={
            "first_name": "Other",
            "email": "other@example.com",
            "password": "Secret12345",
        },
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    client.post("/projects", json={"name": "Theirs", "description": "x"}, headers=other_headers)

    _delete(client, user_with_data["headers"])

    assert db.users.find_one({"email": "other@example.com"}) is not None
    assert db.projects.count_documents({}) == 1  # only the other account's
    assert client.get("/auth/me", headers=other_headers).status_code == 200


def test_the_email_can_be_used_again(client, user_with_data):
    email = user_with_data["email"]
    _delete(client, user_with_data["headers"])

    response = client.post(
        "/auth/register",
        json={"first_name": "Fresh", "email": email, "password": "Secret12345"},
    )
    assert response.status_code == 201


def test_a_confirmation_is_emailed_with_what_was_removed(client, user_with_data, notices):
    _delete(client, user_with_data["headers"])

    assert len(notices) == 1
    # The address has to be read off the user document before it is deleted; if it were
    # read afterwards there would be nothing left to read it from.
    assert notices[0]["to"] == user_with_data["email"]
    assert notices[0]["projects"] == 1
    assert notices[0]["runs"] == 1


def test_no_confirmation_when_the_deletion_was_refused(client, user_with_data, notices):
    _delete(client, user_with_data["headers"], password="not-my-password")
    assert notices == []


def test_the_account_is_still_deleted_if_the_email_fails(client, user_with_data, db, monkeypatch):
    async def explode(**_kwargs) -> None:
        raise RuntimeError("SMTP is down")

    monkeypatch.setattr("app.api.auth.send_account_deleted_email", explode)

    assert _delete(client, user_with_data["headers"]).status_code == 200
    assert db.users.find_one({"email": user_with_data["email"]}) is None


def test_gridfs_artifacts_are_actually_deleted(client, user_with_data, notices, db):
    """The cascade must remove stored artifacts, not just count them.

    Regression test for a real bug: `delete_run_artifacts` iterated GridFS with
    `bucket.find()` and subscripted each result as `record["_id"]`, but that yields
    `AsyncGridOut` objects, which raises `TypeError`. Every existing delete-account test
    happened to use an account whose runs had no artifacts, so the loop body never ran
    and `artifacts_deleted == 0` passed for entirely the wrong reason. The bug only
    surfaced when a live pipeline run finally produced real artifacts, and it 500'd.

    Seeded with synchronous GridFS rather than the app's own async helper: the app's
    client is bound to the event loop the lifespan created it on, and driving it from
    the test's loop raises. The stored shape is identical either way.
    """
    from gridfs import GridFSBucket

    run_id = user_with_data["run_id"]
    bucket = GridFSBucket(db, bucket_name="artifacts")
    bucket.upload_from_stream(
        f"{run_id}_file_tree_0.zip",
        b"PK\x03\x04 fake zip payload",
        metadata={"run_id": run_id, "kind": "file_tree", "iteration": 0},
    )
    assert db["artifacts.files"].count_documents({"metadata.run_id": run_id}) == 1

    response = _delete(client, user_with_data["headers"])

    assert response.status_code == 200
    assert response.json()["artifacts_deleted"] == 1
    # Both halves of the bucket must be gone, not just the file record.
    assert db["artifacts.files"].count_documents({"metadata.run_id": run_id}) == 0
    assert db["artifacts.chunks"].count_documents({}) == 0
