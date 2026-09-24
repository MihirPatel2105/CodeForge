"""Admin control-centre access and read-only inventory endpoints."""

import time

import pytest
from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from app.core.security import _totp
from app.graph.state import RunMetrics


@pytest.fixture
def admin_user(registered_user, monkeypatch):
    monkeypatch.setattr(settings, "admin_email", registered_user["email"])
    return registered_user


def _create_user(client, *, email: str, first_name: str = "Other") -> dict:
    response = client.post(
        "/auth/register",
        json={
            "first_name": first_name,
            "email": email,
            "password": "Secret12345",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}


def _create_run(client, user: dict, *, project_name: str, prompt: str) -> str:
    project = client.post(
        "/projects",
        json={"name": project_name},
        headers=user["headers"],
    ).json()
    response = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": prompt},
        headers=user["headers"],
    )
    assert response.status_code == 202
    return response.json()["run_id"]


def test_me_marks_only_configured_operator_as_admin(client, admin_user):
    body = client.get("/auth/me", headers=admin_user["headers"]).json()
    assert body["is_admin"] is True

    ordinary = _create_user(client, email="ordinary@example.com")
    body = client.get("/auth/me", headers=ordinary["headers"]).json()
    assert body["is_admin"] is False


def test_admin_routes_fail_closed_without_admin_email(client, registered_user, monkeypatch):
    monkeypatch.setattr(settings, "admin_email", None)
    response = client.get("/admin/overview", headers=registered_user["headers"])
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_ordinary_user_cannot_read_admin_inventory(client, registered_user):
    response = client.get("/admin/users", headers=registered_user["headers"])
    assert response.status_code == 403


def test_admin_overview_counts_platform_and_returns_cross_user_runs(client, admin_user):
    other = _create_user(client, email="other@example.com")
    run_id = _create_run(
        client,
        other,
        project_name="Inventory API",
        prompt="Build inventory endpoints",
    )

    response = client.get("/admin/overview", headers=admin_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert body["totals"]["users"] == 2
    assert body["totals"]["projects"] == 1
    assert body["totals"]["runs"] == 1
    assert body["totals"]["active_runs"] == 1
    assert body["recent_runs"][0]["id"] == run_id
    assert body["recent_runs"][0]["user_email"] == other["email"]
    assert body["recent_runs"][0]["project_name"] == "Inventory API"


def test_admin_run_inventory_is_cross_user_and_user_inventory_is_aggregated(client, admin_user):
    other = _create_user(client, email="builder@example.com", first_name="Builder")
    run_id = _create_run(client, other, project_name="Tasks API", prompt="Build task CRUD")

    runs = client.get("/admin/runs", headers=admin_user["headers"])
    assert runs.status_code == 200
    assert runs.json()["items"][0]["id"] == run_id
    assert runs.json()["items"][0]["user_email"] == "builder@example.com"

    detail = client.get(f"/admin/runs/{run_id}", headers=admin_user["headers"])
    assert detail.status_code == 200
    assert detail.json()["run"]["id"] == run_id
    assert detail.json()["state"]["thread_id"] == run_id

    users = client.get("/admin/users?q=builder", headers=admin_user["headers"])
    assert users.status_code == 200
    assert len(users.json()["items"]) == 1
    assert users.json()["items"][0]["project_count"] == 1
    assert users.json()["items"][0]["run_count"] == 1

    detail = client.get(
        f"/admin/users/{users.json()['items'][0]['id']}", headers=admin_user["headers"]
    )
    assert detail.status_code == 200
    assert detail.json()["projects"][0]["name"] == "Tasks API"
    assert detail.json()["recent_runs"][0]["id"] == run_id


def test_quality_uses_persisted_metrics_and_keeps_exclusions_out_of_rates(client, admin_user):
    other = _create_user(client, email="quality@example.com")
    good = _create_run(client, other, project_name="Good API", prompt="Build good CRUD")
    excluded = _create_run(client, other, project_name="Quota API", prompt="Build quota CRUD")

    with MongoClient(settings.mongo_uri) as mongo:
        runs = mongo[settings.mongo_db].runs
        runs.update_one(
            {"_id": ObjectId(good)},
            {
                "$set": {
                    "metrics": RunMetrics(
                        generation_succeeded=True,
                        tests_passed=True,
                        test_pass_ratio=1.0,
                        rag_enabled=True,
                        acceptance_level="L5",
                        end_to_end_ms=10_000,
                        tokens_total=100,
                    ).model_dump()
                }
            },
        )
        runs.update_one(
            {"_id": ObjectId(excluded)},
            {
                "$set": {
                    "metrics": RunMetrics(
                        rag_enabled=False,
                        exclusion_reason="quota_before_completion",
                        acceptance_level="L0",
                    ).model_dump()
                }
            },
        )

    response = client.get("/admin/quality", headers=admin_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert body["measured_runs"] == 2
    assert body["eligible_runs"] == 1
    assert body["excluded_runs"] == 1
    assert body["test_pass_rate"] == 100.0
    assert body["acceptance_levels"] == [{"label": "L5", "count": 1, "percentage": 100.0}]
    rag_enabled = next(group for group in body["rag_comparison"] if group["rag_enabled"])
    assert rag_enabled["l5_rate"] == 100.0


def test_admin_cancel_and_session_revoke_are_audited(client, admin_user):
    other = _create_user(client, email="action@example.com")
    run_id = _create_run(client, other, project_name="Action API", prompt="Build actions")

    cancelled = client.post(
        f"/admin/runs/{run_id}/cancel",
        json={"reason": "Run has been stuck without a new event."},
        headers=admin_user["headers"],
    )
    assert cancelled.status_code == 200

    users = client.get("/admin/users?q=action", headers=admin_user["headers"]).json()["items"]
    revoked = client.post(
        f"/admin/users/{users[0]['id']}/revoke-sessions",
        json={"reason": "Account owner requested every session to end."},
        headers=admin_user["headers"],
    )
    assert revoked.status_code == 200
    assert client.get("/auth/me", headers=other["headers"]).status_code == 401

    audit = client.get("/admin/audit-log", headers=admin_user["headers"])
    assert audit.status_code == 200
    assert [entry["action"] for entry in audit.json()["items"]] == [
        "user.sessions_revoked",
        "run.cancelled",
    ]


def test_system_health_reports_services_without_spending_provider_quota(client, admin_user):
    response = client.get("/admin/system-health", headers=admin_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert {service["name"] for service in body["services"]} == {
        "API",
        "MongoDB",
        "Sandbox",
        "Email",
        "Langfuse",
    }
    assert {provider["name"] for provider in body["providers"]} == {
        "groq",
        "openrouter",
        "mistral",
    }


def test_all_admin_read_routes_reject_ordinary_users(client, registered_user):
    for path in (
        "/admin/overview",
        "/admin/runs",
        "/admin/users",
        "/admin/quality",
        "/admin/system-health",
        "/admin/audit-log",
        "/admin/monitoring",
    ):
        response = client.get(path, headers=registered_user["headers"])
        assert response.status_code == 403, path


def test_admin_can_suspend_restore_verify_and_limit_a_user(client, admin_user):
    other = _create_user(client, email="managed@example.com")
    users = client.get("/admin/users?q=managed", headers=admin_user["headers"]).json()["items"]
    user_id = users[0]["id"]

    limited = client.post(
        f"/admin/users/{user_id}/limits",
        json={"project_limit": 1, "monthly_run_limit": 1, "reason": "Support plan limit."},
        headers=admin_user["headers"],
    )
    assert limited.status_code == 200
    assert (
        client.post("/projects", json={"name": "One"}, headers=other["headers"]).status_code == 201
    )
    blocked = client.post("/projects", json={"name": "Two"}, headers=other["headers"])
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "usage_limit_reached"

    suspended = client.post(
        f"/admin/users/{user_id}/suspend",
        json={"reason": "Account owner reported compromise."},
        headers=admin_user["headers"],
    )
    assert suspended.status_code == 200
    assert client.get("/auth/me", headers=other["headers"]).status_code == 403
    restored = client.post(
        f"/admin/users/{user_id}/restore",
        json={"reason": "Ownership was verified."},
        headers=admin_user["headers"],
    )
    assert restored.status_code == 200


def test_admin_can_permanently_delete_a_user_and_owned_data(client, admin_user, monkeypatch):
    notices: list[dict] = []

    async def fake_notice(**kwargs):
        notices.append(kwargs)

    monkeypatch.setattr("app.api.admin.send_account_deleted_email", fake_notice)
    other = _create_user(client, email="delete-me@example.com", first_name="Delete")
    _create_run(client, other, project_name="Disposable API", prompt="Build disposable CRUD")
    target = client.get("/admin/users?q=delete-me", headers=admin_user["headers"]).json()["items"][
        0
    ]

    unconfirmed = client.post(
        f"/admin/users/{target['id']}/delete",
        json={
            "current_password": admin_user["password"],
            "confirmation": "delete",
            "reason": "User requested permanent removal.",
        },
        headers=admin_user["headers"],
    )
    assert unconfirmed.status_code == 422

    denied = client.post(
        f"/admin/users/{target['id']}/delete",
        json={
            "current_password": "WrongPassword123",
            "confirmation": "DELETE",
            "reason": "User requested permanent removal.",
        },
        headers=admin_user["headers"],
    )
    assert denied.status_code == 401

    forbidden = client.post(
        f"/admin/users/{target['id']}/delete",
        json={
            "current_password": admin_user["password"],
            "confirmation": "DELETE",
            "reason": "Attempted without admin access.",
        },
        headers=other["headers"],
    )
    assert forbidden.status_code == 403

    response = client.post(
        f"/admin/users/{target['id']}/delete",
        json={
            "current_password": admin_user["password"],
            "confirmation": "DELETE",
            "reason": "User requested permanent removal.",
        },
        headers=admin_user["headers"],
    )
    assert response.status_code == 200
    assert response.json() == {
        "projects_deleted": 1,
        "runs_deleted": 1,
        "artifacts_deleted": 0,
    }
    assert client.get("/auth/me", headers=other["headers"]).status_code == 401

    with MongoClient(settings.mongo_uri) as mongo:
        database = mongo[settings.mongo_db]
        assert database.users.find_one({"email": "delete-me@example.com"}) is None
        assert database.projects.count_documents({"user_id": target["id"]}) == 0
        assert database.runs.count_documents({"user_id": target["id"]}) == 0

    audit = client.get(
        "/admin/audit-log?action=user.deleted", headers=admin_user["headers"]
    ).json()["items"]
    assert audit[0]["target_id"] == target["id"]
    assert audit[0]["reason"] == "User requested permanent removal."
    assert audit[0]["details"]["projects_deleted"] == 1
    assert notices == [
        {
            "to": "delete-me@example.com",
            "first_name": "Delete",
            "projects": 1,
            "runs": 1,
        }
    ]


def test_admin_cannot_delete_the_configured_administrator(client, admin_user):
    admin_id = client.get("/auth/me", headers=admin_user["headers"]).json()["id"]
    response = client.post(
        f"/admin/users/{admin_id}/delete",
        json={
            "current_password": admin_user["password"],
            "confirmation": "DELETE",
            "reason": "This must remain protected.",
        },
        headers=admin_user["headers"],
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_admin_totp_setup_changes_login_to_two_step(client, admin_user):
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": admin_user["password"]},
        headers=admin_user["headers"],
    )
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["provisioning_uri"].startswith("otpauth://totp/CodeForge%3A")
    assert f"secret={secret}" in setup.json()["provisioning_uri"]
    code = _totp(secret, int(time.time()) // 30)
    assert (
        client.post(
            "/auth/totp/verify", json={"code": code}, headers=admin_user["headers"]
        ).status_code
        == 204
    )

    first = client.post(
        "/auth/login",
        json={"email": admin_user["email"], "password": admin_user["password"]},
    )
    assert first.status_code == 200
    assert first.json()["mfa_required"] is True
    assert first.json()["access_token"] is None

    second = client.post(
        "/auth/login/complete",
        json={"ticket": first.json()["mfa_ticket"], "totp_code": code},
    )
    assert second.status_code == 200
    assert second.json()["access_token"]


def test_admin_lists_are_paginated_and_exports_are_csv(client, admin_user):
    for index in range(3):
        _create_user(client, email=f"page-{index}@example.com")
    page = client.get("/admin/users?page=1&page_size=2", headers=admin_user["headers"])
    assert page.status_code == 200
    assert len(page.json()["items"]) == 2
    assert page.json()["pagination"]["total"] == 4
    export = client.get("/admin/users/export.csv", headers=admin_user["headers"])
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "user_id,email,name" in export.text
