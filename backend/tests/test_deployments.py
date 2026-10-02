"""Published API keys protect the gateway and hosted data is removed on unpublish."""

from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from pymongo import MongoClient

from app.config import settings


def _passed_run(client, registered_user):
    project = client.post(
        "/projects", json={"name": "Hosted API"}, headers=registered_user["headers"]
    ).json()
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "items API"},
        headers=registered_user["headers"],
    ).json()["run_id"]
    files = [
        {"path": path, "content": "# generated"}
        for path in ("main.py", "database.py", "models.py", "schemas.py")
    ]
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].runs.update_one(
            {"_id": ObjectId(run_id)},
            {
                "$set": {
                    "status": "succeeded",
                    "metrics": {"tests_passed": True},
                    "state.files": files,
                }
            },
        )
    return project["id"], run_id


def test_publish_key_is_one_time_and_gateway_checks_it(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with (
        patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock),
        patch("app.api.deployments.execute_deployment", new_callable=AsyncMock) as execute,
        patch("app.api.deployments.destroy_deployment", new_callable=AsyncMock) as destroy,
    ):
        created = client.post(f"/runs/{run_id}/deployment", headers=registered_user["headers"])
        assert created.status_code == 201
        info = created.json()
        key = info["api_key"]
        assert key.startswith("cf_live_")
        assert info["url"].endswith(f"/api/v1/deployments/{info['id']}")
        read = client.get(f"/runs/{run_id}/deployment", headers=registered_user["headers"])
        assert read.status_code == 200
        assert "api_key" not in read.json()
        assert client.get(f"/api/v1/deployments/{info['id']}/items").status_code == 401
        assert (
            client.get(
                f"/api/v1/deployments/{info['id']}/items",
                headers={"Authorization": "Bearer cf_live_wrong"},
            ).status_code
            == 401
        )

        execute.return_value = {
            "status": 200,
            "body": '[{"name":"sample"}]',
            "content_type": "application/json",
            "truncated": False,
        }
        response = client.get(
            f"/api/v1/deployments/{info['id']}/items",
            headers={"Authorization": f"Bearer {key}"},
        )
        assert response.status_code == 200
        assert response.json() == [{"name": "sample"}]
        assert execute.await_args.args[2:4] == ("GET", "/items")
        assert response.headers["x-content-type-options"] == "nosniff"

        execute.return_value = {
            "status": 200,
            "body": "<script>example</script>",
            "content_type": "text/html",
            "truncated": False,
        }
        untrusted = client.get(
            f"/api/v1/deployments/{info['id']}/items",
            headers={"Authorization": f"Bearer {key}"},
        )
        assert untrusted.headers["content-type"].startswith("text/plain")

        removed = client.delete(f"/runs/{run_id}/deployment", headers=registered_user["headers"])
        assert removed.status_code == 204
        destroy.assert_awaited_once_with(info["id"])
        assert (
            client.get(
                f"/api/v1/deployments/{info['id']}/items",
                headers={"Authorization": f"Bearer {key}"},
            ).status_code
            == 401
        )


def test_rotating_key_revokes_old_key(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock):
        original = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
        rotated = client.post(
            f"/runs/{run_id}/deployment/rotate-key", headers=registered_user["headers"]
        ).json()
    assert rotated["api_key"] != original["api_key"]
    url = f"/api/v1/deployments/{original['id']}/items"
    old_response = client.get(url, headers={"Authorization": f"Bearer {original['api_key']}"})
    assert old_response.status_code == 401
    with patch("app.api.deployments.execute_deployment", new_callable=AsyncMock) as execute:
        execute.return_value = {
            "status": 204,
            "body": "",
            "content_type": "application/json",
            "truncated": False,
        }
        assert (
            client.delete(
                url, headers={"Authorization": f"Bearer {rotated['api_key']}"}
            ).status_code
            == 204
        )


def test_publish_requires_passing_run_and_owner(client, registered_user):
    project = client.post(
        "/projects", json={"name": "Not ready"}, headers=registered_user["headers"]
    ).json()
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "items API"},
        headers=registered_user["headers"],
    ).json()["run_id"]
    assert (
        client.post(f"/runs/{run_id}/deployment", headers=registered_user["headers"]).status_code
        == 409
    )
    other = client.post(
        "/auth/register",
        json={"first_name": "Other", "email": "other@example.com", "password": "Secret12345"},
    ).json()
    assert (
        client.get(
            f"/runs/{run_id}/deployment",
            headers={"Authorization": f"Bearer {other['access_token']}"},
        ).status_code
        == 404
    )


def test_gateway_rejects_bad_body_before_generated_code(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
    with patch("app.api.deployments.execute_deployment", new_callable=AsyncMock) as execute:
        response = client.post(
            f"/api/v1/deployments/{published['id']}/items",
            headers={
                "Authorization": f"Bearer {published['api_key']}",
                "Content-Type": "text/plain",
            },
            content="not json",
        )
        assert response.status_code == 400
        execute.assert_not_called()


def test_gateway_limits_requests_before_running_generated_code(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
    with patch("app.api.deployments.execute_deployment", new_callable=AsyncMock) as execute:
        execute.return_value = {
            "status": 200,
            "body": "[]",
            "content_type": "application/json",
            "truncated": False,
        }
        url = f"/api/v1/deployments/{published['id']}/items"
        headers = {"Authorization": f"Bearer {published['api_key']}"}
        for _ in range(60):
            assert client.get(url, headers=headers).status_code == 200
        limited = client.get(url, headers=headers)
        assert limited.status_code == 429
        assert 1 <= int(limited.headers["retry-after"]) <= 60
        assert limited.headers["x-ratelimit-remaining"] == "0"
        assert execute.await_count == 60


@pytest.mark.parametrize(
    "result",
    [
        {"status": 200, "body": '[{"name":', "content_type": "application/json", "truncated": True},
        {"status": 200, "body": "invalid", "content_type": "application/json", "truncated": False},
        {
            "status": 500,
            "body": "Traceback secret",
            "content_type": "text/plain",
            "truncated": False,
        },
        {"error": "RuntimeError secret"},
    ],
)
def test_gateway_never_returns_broken_or_internal_responses(client, registered_user, result):
    _, run_id = _passed_run(client, registered_user)
    with patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
    with patch(
        "app.api.deployments.execute_deployment", new_callable=AsyncMock, return_value=result
    ):
        response = client.get(
            f"/api/v1/deployments/{published['id']}/items",
            headers={"Authorization": f"Bearer {published['api_key']}"},
        )
    assert response.status_code == (502 if result.get("status") == 200 else 503)
    assert response.json()["error"]["message"]
    assert "secret" not in response.text
    assert "Traceback" not in response.text


def test_owner_health_check_and_usage_are_truthful(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
    url = f"/runs/{run_id}/deployment/check"
    assert client.post(url).status_code == 401
    with patch("app.api.deployments.execute_deployment", new_callable=AsyncMock) as execute:
        execute.return_value = {
            "status": 200,
            "body": '{"openapi":"3.1.0","paths":{}}',
            "content_type": "application/json",
            "truncated": False,
        }
        response = client.post(url, headers=registered_user["headers"])
        assert response.status_code == 200
        health = response.json()
        assert health["ready"] is True
        assert health["requests_this_minute"] == 1
        assert health["request_limit"] == 60
        assert health["duration_ms"] >= 0
        assert execute.await_args.args[2:4] == ("GET", "/openapi.json")
        execute.side_effect = RuntimeError("secret host details")
        failed = client.post(url, headers=registered_user["headers"]).json()
        assert failed["ready"] is False
        assert "secret" not in failed["detail"]
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].deployments.update_one(
            {"_id": ObjectId(published["id"])}, {"$set": {"status": "deleting"}}
        )
    assert client.post(url, headers=registered_user["headers"]).status_code == 409


def test_failed_publication_releases_capacity(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with (
        patch(
            "app.api.deployments.ensure_deployment",
            new_callable=AsyncMock,
            side_effect=RuntimeError("startup failed"),
        ),
        patch("app.api.deployments.destroy_deployment", new_callable=AsyncMock) as destroy,
    ):
        response = client.post(f"/runs/{run_id}/deployment", headers=registered_user["headers"])
        assert response.status_code == 503
        destroy.assert_awaited_once()
    assert (
        client.get(f"/runs/{run_id}/deployment", headers=registered_user["headers"]).status_code
        == 404
    )


def test_project_deletion_removes_published_api(client, registered_user):
    project_id, run_id = _passed_run(client, registered_user)
    with (
        patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock),
        patch("app.api.projects.destroy_deployment", new_callable=AsyncMock) as destroy,
    ):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
        response = client.delete(f"/projects/{project_id}", headers=registered_user["headers"])
        assert response.status_code == 200
        destroy.assert_awaited_once_with(published["id"])
        assert (
            client.get(
                f"/api/v1/deployments/{published['id']}/items",
                headers={"Authorization": f"Bearer {published['api_key']}"},
            ).status_code
            == 401
        )


def test_account_deletion_removes_published_api(client, registered_user):
    _, run_id = _passed_run(client, registered_user)
    with (
        patch("app.api.deployments.ensure_deployment", new_callable=AsyncMock),
        patch("app.core.account_deletion.destroy_deployment", new_callable=AsyncMock) as destroy,
    ):
        published = client.post(
            f"/runs/{run_id}/deployment", headers=registered_user["headers"]
        ).json()
        response = client.post(
            "/auth/delete-account",
            json={"password": "Secret12345", "confirmation": "DELETE"},
            headers=registered_user["headers"],
        )
        assert response.status_code == 200
        destroy.assert_awaited_once_with(published["id"])
        with MongoClient(settings.mongo_uri) as mongo:
            assert mongo[settings.mongo_db].deployments.count_documents({}) == 0
