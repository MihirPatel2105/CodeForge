"""Operator permissions, evidence, grouped incidents, and bounded deployment cleanup."""

from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId
from pymongo import MongoClient

from app.config import settings


@pytest.fixture
def operator(strong_auth_user, monkeypatch):
    monkeypatch.setattr(settings, "admin_email", strong_auth_user["email"])
    return strong_auth_user


def database():
    return MongoClient(settings.mongo_uri)[settings.mongo_db]


def run(client, user, status="failed_llm", age=0):
    project = client.post(
        "/projects", json={"name": "Support project"}, headers=user["headers"]
    ).json()
    result = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "Build a CRUD tasks API"},
        headers=user["headers"],
    )
    assert result.status_code == 202
    rid = result.json()["run_id"]
    database().runs.update_one(
        {"_id": ObjectId(rid)},
        {"$set": {"status": status, "updated_at": datetime.now(UTC) - timedelta(minutes=age)}},
    )
    return rid, project["id"]


@pytest.mark.parametrize(
    "path", ["attention", "incidents", "deployments", "trends", "users/123/support"]
)
def test_non_admin_cannot_read_operations(client, registered_user, path):
    assert client.get(f"/admin/{path}", headers=registered_user["headers"]).status_code == 403


def test_non_admin_cannot_change_incidents_or_stop_apis(client, registered_user):
    assert (
        client.patch(
            "/admin/incidents/failed_llm:2026-10-02",
            json={"status": "resolved", "note": "Investigated"},
            headers=registered_user["headers"],
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/admin/deployments/123/stop",
            json={"reason": "Investigated"},
            headers=registered_user["headers"],
        ).status_code
        == 403
    )


def test_attention_includes_old_blocked_runs_outside_recent_window(client, operator):
    old, _ = run(client, operator, "awaiting_approval", 120)
    database().runs.update_one(
        {"_id": ObjectId(old)}, {"$set": {"created_at": datetime.now(UTC) - timedelta(days=30)}}
    )
    for _ in range(11):
        run(client, operator, "succeeded")
    result = client.get("/admin/attention", headers=operator["headers"])
    assert result.status_code == 200
    assert result.json()["total"] == 1
    item = result.json()["items"][0]
    assert item["run"]["id"] == old and item["priority"] == "urgent"
    assert item["waiting_minutes"] >= 120


def test_failure_guidance_does_not_echo_provider_details(client, operator):
    rid, _ = run(client, operator)
    database().runs.update_one(
        {"_id": ObjectId(rid)},
        {
            "$set": {
                "state.llm_attempts": [
                    {"ok": False, "error": "429 secret-token https://internal.test"}
                ]
            }
        },
    )
    detail = client.get(f"/admin/runs/{rid}", headers=operator["headers"]).json()
    guidance = detail["failure_guidance"]
    assert guidance["category"] == "provider_limit"
    assert "secret-token" not in str(guidance) and "internal.test" not in str(guidance)
    attention = client.get("/admin/attention", headers=operator["headers"]).json()
    assert attention["items"][0]["guidance"] == guidance


def test_incidents_group_failures_record_notes_and_reopen(client, operator):
    first, _ = run(client, operator)
    run(client, operator)
    response = client.get("/admin/incidents", headers=operator["headers"]).json()
    assert len(response["items"]) == 1 and response["items"][0]["count"] == 2
    key = response["items"][0]["key"]
    for status in ["acknowledged", "resolved"]:
        result = client.patch(
            f"/admin/incidents/{key}",
            json={"status": status, "note": "Provider issue reviewed"},
            headers=operator["headers"],
        )
        assert result.status_code == 200
    item = client.get("/admin/incidents", headers=operator["headers"]).json()["items"][0]
    assert item["status"] == "resolved" and len(item["notes"]) == 2
    database().runs.update_one(
        {"_id": ObjectId(first)}, {"$set": {"updated_at": datetime.now(UTC) + timedelta(seconds=1)}}
    )
    item = client.get("/admin/incidents", headers=operator["headers"]).json()["items"][0]
    assert item["status"] == "open" and len(item["notes"]) == 2
    assert database().admin_audit_logs.count_documents({"target_type": "incident"}) == 2
    assert (
        client.patch(
            f"/admin/incidents/{key}",
            json={"status": "resolved", "note": "   "},
            headers=operator["headers"],
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/admin/incidents/not-real",
            json={"status": "resolved", "note": "Reviewed"},
            headers=operator["headers"],
        ).status_code
        == 404
    )


def deployment(client, operator):
    rid, pid = run(client, operator, "succeeded")
    uid = str(database().runs.find_one({"_id": ObjectId(rid)})["user_id"])
    did = (
        database()
        .deployments.insert_one(
            {
                "run_id": rid,
                "project_id": pid,
                "user_id": uid,
                "slot": 0,
                "key_hash": "private-hash",
                "key_prefix": "private-prefix",
                "status": "active",
                "created_at": datetime.now(UTC),
            }
        )
        .inserted_id
    )
    return str(did), rid, uid


def test_deployment_inventory_and_audited_stop(client, operator, monkeypatch):
    did, _, _ = deployment(client, operator)

    async def inspect(ids):
        return {key: {"runtime_status": "ready", "memory_bytes": 100} for key in ids}

    destroyed = []

    async def destroy(key):
        destroyed.append(key)

    monkeypatch.setattr("app.api.admin_operations.inspect_deployments", inspect)
    monkeypatch.setattr("app.api.admin_operations.destroy_deployment", destroy)
    response = client.get("/admin/deployments", headers=operator["headers"])
    assert response.status_code == 200
    assert "private-hash" not in response.text and "private-prefix" not in response.text
    assert response.json()["items"][0]["runtime_status"] == "ready"
    assert (
        client.post(
            f"/admin/deployments/{did}/stop", json={"reason": "   "}, headers=operator["headers"]
        ).status_code
        == 409
    )
    assert not destroyed
    assert (
        client.post(
            f"/admin/deployments/{did}/stop",
            json={"reason": "Owner requested cleanup"},
            headers=operator["headers"],
        ).status_code
        == 200
    )
    assert destroyed == [did]
    assert database().deployments.count_documents({}) == 0
    assert database().admin_audit_logs.count_documents({"target_type": "deployment"}) == 2


def test_stop_failure_retains_cleanup_record(client, operator, monkeypatch):
    did, _, _ = deployment(client, operator)

    async def fail(key):
        raise RuntimeError("private daemon details")

    monkeypatch.setattr("app.api.admin_operations.destroy_deployment", fail)
    response = client.post(
        f"/admin/deployments/{did}/stop",
        json={"reason": "Cleanup required"},
        headers=operator["headers"],
    )
    assert response.status_code == 503 and "private daemon" not in response.text
    assert database().deployments.find_one({"_id": ObjectId(did)})["status"] == "deleting"


def test_support_and_user_filter(client, operator):
    _, _, uid = deployment(client, operator)
    result = client.get(f"/admin/users/{uid}/support", headers=operator["headers"])
    assert result.status_code == 200
    assert result.json()["monthly_runs"] == 1
    assert len(result.json()["deployments"]) == 1
    assert (
        client.get(f"/admin/runs?user_id={uid}", headers=operator["headers"]).json()["pagination"][
            "total"
        ]
        == 1
    )
    assert (
        client.get("/admin/runs?user_id=unknown", headers=operator["headers"]).json()["pagination"][
            "total"
        ]
        == 0
    )


def test_period_comparison_keeps_equal_windows(client, operator):
    first, _ = run(client, operator, "succeeded")
    second, _ = run(client, operator, "failed_llm")
    database().runs.update_one(
        {"_id": ObjectId(first)}, {"$set": {"created_at": datetime.now(UTC) - timedelta(days=9)}}
    )
    response = client.get("/admin/trends?days=7", headers=operator["headers"])
    assert response.status_code == 200
    assert response.json()["current"]["failed"] == 1
    assert response.json()["previous"]["succeeded"] == 1
    assert response.json()["current"]["runs"] == 1
    assert client.get("/admin/trends?days=0", headers=operator["headers"]).status_code == 422
