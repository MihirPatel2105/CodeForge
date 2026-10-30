"""An admin retry starts a run for the owner, so it must pass the owner's usage limits."""

from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from tests.test_admin import _create_run, _create_user, admin_user  # noqa: F401 - fixture reuse


def _db():
    return MongoClient(settings.mongo_uri)


def _finished_run(client, email: str) -> tuple[dict, str, str]:
    owner = _create_user(client, email=email)
    run_id = _create_run(client, owner, project_name="Retry API", prompt="Build a books API")
    with _db() as mongo:
        db = mongo[settings.mongo_db]
        db.runs.update_one({"_id": ObjectId(run_id)}, {"$set": {"status": "failed_llm"}})
        user_id = str(db.users.find_one({"email": email})["_id"])
    return owner, run_id, user_id


def _retry(client, admin, run_id: str):
    return client.post(
        f"/admin/runs/{run_id}/retry",
        json={"reason": "provider recovered"},
        headers=admin["headers"],
    )


def test_admin_retry_reserves_an_admission_for_the_new_run(
    client,
    admin_user,  # noqa: F811
    no_background_runs,
):
    _owner, run_id, user_id = _finished_run(client, "retry-owner@example.com")

    response = _retry(client, admin_user, run_id)

    assert response.status_code == 200
    retried_id = no_background_runs[-1]
    assert retried_id != run_id
    with _db() as mongo:
        admission = mongo[settings.mongo_db].run_admissions.find_one({"_id": retried_id})
    assert admission is not None
    assert admission["user_id"] == user_id


def test_admin_retry_respects_the_owner_monthly_run_limit(
    client,
    admin_user,  # noqa: F811
    no_background_runs,
):
    _owner, run_id, user_id = _finished_run(client, "limited-owner@example.com")
    with _db() as mongo:
        mongo[settings.mongo_db].users.update_one(
            {"_id": ObjectId(user_id)}, {"$set": {"monthly_run_limit": 1}}
        )
    launched_before = list(no_background_runs)

    response = _retry(client, admin_user, run_id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "usage_limit_reached"
    assert no_background_runs == launched_before
    with _db() as mongo:
        db = mongo[settings.mongo_db]
        assert db.runs.count_documents({"user_id": user_id}) == 1
        assert db.admin_audit_logs.count_documents({"action": "run.retried"}) == 0


def test_admin_retry_respects_the_owner_active_run_cap(
    client,
    admin_user,  # noqa: F811
    monkeypatch,
):
    owner, run_id, user_id = _finished_run(client, "busy-owner@example.com")
    project_id = client.get("/projects", headers=owner["headers"]).json()[0]["id"]
    active = client.post(
        "/runs",
        json={"project_id": project_id, "prompt": "Build an authors API"},
        headers=owner["headers"],
    )
    assert active.status_code == 202
    monkeypatch.setattr(settings, "max_active_runs_per_user", 1)

    response = _retry(client, admin_user, run_id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "usage_limit_reached"
    with _db() as mongo:
        assert mongo[settings.mongo_db].runs.count_documents({"user_id": user_id}) == 2
