"""Try API stays owner-only and requires a completed, tested run."""

from unittest.mock import AsyncMock, patch

from bson import ObjectId
from pymongo import MongoClient

from app.api.preview import _operations
from app.config import settings
from app.sandbox.preview import validate_request


def _run_id(client, registered_user):
    project = client.post(
        "/projects",
        json={"name": "Preview test"},
        headers=registered_user["headers"],
    ).json()
    return client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "items API"},
        headers=registered_user["headers"],
    ).json()["run_id"]


def _make_successful(run_id):
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


def test_preview_requires_a_passed_run(client, registered_user):
    run_id = _run_id(client, registered_user)
    with patch("app.api.preview.preview_request", new_callable=AsyncMock) as execute:
        response = client.get(f"/runs/{run_id}/preview", headers=registered_user["headers"])
    assert response.status_code == 409
    execute.assert_not_called()


def test_preview_is_owner_only(client, registered_user):
    run_id = _run_id(client, registered_user)
    _make_successful(run_id)
    other = client.post(
        "/auth/register",
        json={"first_name": "Other", "email": "other@example.com", "password": "Secret12345"},
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/runs/{run_id}/preview", headers=headers).status_code == 404
    assert (
        client.post(
            f"/runs/{run_id}/preview/request",
            json={"method": "GET", "path": "/items"},
            headers=headers,
        ).status_code
        == 404
    )
    assert client.delete(f"/runs/{run_id}/preview", headers=headers).status_code == 404


def test_preview_discovers_routes_and_relays_a_request(client, registered_user):
    run_id = _run_id(client, registered_user)
    _make_successful(run_id)
    openapi = {
        "paths": {
            "/items": {
                "post": {
                    "summary": "Create item",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ItemCreate"}
                            }
                        }
                    },
                }
            }
        },
        "components": {
            "schemas": {
                "ItemCreate": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}, "count": {"type": "integer"}},
                }
            }
        },
    }
    import json

    with patch("app.api.preview.preview_request", new_callable=AsyncMock) as execute:
        execute.return_value = {"status": 200, "body": json.dumps(openapi), "session_started": True}
        info = client.get(f"/runs/{run_id}/preview", headers=registered_user["headers"])
        assert info.status_code == 200
        assert info.json()["operations"] == [
            {
                "method": "POST",
                "path": "/items",
                "summary": "Create item",
                "has_body": True,
                "example_body": {"name": "example", "count": 0},
            }
        ]
        execute.return_value = {
            "status": 201,
            "body": '{"name":"sample"}',
            "content_type": "application/json",
            "truncated": False,
            "duration_ms": 9,
            "session_started": False,
        }
        response = client.post(
            f"/runs/{run_id}/preview/request",
            json={"method": "POST", "path": "/items", "body": {"name": "sample"}},
            headers=registered_user["headers"],
        )
        assert response.status_code == 200
        assert response.json()["status"] == 201
        assert execute.await_args.args[2:] == ("POST", "/items", {"name": "sample"})


def test_preview_rejects_unsafe_paths_and_large_bodies():
    import pytest

    for path in ("https://example.com", "//example.com", "/../secret", "/items\\bad"):
        with pytest.raises(ValueError):
            validate_request("GET", path, None)
    with pytest.raises(ValueError):
        validate_request("POST", "/items", {"payload": "x" * 20_000})


def test_openapi_ignores_non_api_methods():
    assert _operations({"paths": {"/items": {"parameters": [], "head": {}}}}) == []
