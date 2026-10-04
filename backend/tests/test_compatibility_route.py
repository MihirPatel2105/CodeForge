"""Exercise the real owner checks and HTTP contract with database/runtime boundaries faked."""

import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import preview
from app.core.deps import get_current_user
from app.core.exceptions import CodeForgeError
from app.main import codeforge_error_handler
from app.models import Run
from app.sandbox.runner import SandboxUnavailableError


@pytest.fixture(autouse=True)
def clean_database():
    yield


def run(run_id, parent=None, owner="owner", status="succeeded", passed=True):
    return SimpleNamespace(
        id=run_id,
        user_id=owner,
        project_id="project",
        parent_run_id=parent,
        status=status,
        metrics=SimpleNamespace(tests_passed=passed),
        state={
            "files": [
                {"path": path, "content": "# generated"}
                for path in ("main.py", "models.py", "schemas.py", "database.py")
            ]
        },
    )


@pytest.fixture
def http(monkeypatch):
    records = {"version": run("version", "source"), "source": run("source")}

    async def get(run_id):
        return records.get(run_id)

    monkeypatch.setattr(Run, "get", get)
    app = FastAPI()
    app.include_router(preview.router)
    app.add_exception_handler(CodeForgeError, codeforge_error_handler)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="owner")
    with TestClient(app) as client:
        yield client, records


def schema(required=False):
    return {
        "openapi": "3.1.0",
        "paths": {
            "/books": {
                "post": {
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {"title": {"type": "string"}},
                                    "required": ["title"] if required else [],
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "OK"}},
                }
            }
        },
    }


def test_report_compares_actual_runtime_schemas_and_names_source(http, monkeypatch):
    client, _ = http

    async def execute(run_id, files, method, path, body):
        assert method == "GET" and path == "/openapi.json" and body is None
        return {"status": 200, "body": json.dumps(schema(run_id == "version")), "truncated": False}

    monkeypatch.setattr(preview, "preview_request", execute)
    response = client.post("/runs/version/compatibility")
    assert response.status_code == 200
    report = response.json()
    assert report["status"] == "breaking"
    assert report["source_run_id"] == "source"
    assert report["checked_at"].endswith("Z")
    assert any(c["code"] == "required_added" for c in report["changes"])


@pytest.mark.parametrize("target", ["version", "source"])
def test_both_versions_are_owner_checked_before_any_runtime_access(http, monkeypatch, target):
    client, records = http
    records[target].user_id = "someone-else"

    async def forbidden(*args):
        pytest.fail("Ownership must be checked before accessing any runtime")

    monkeypatch.setattr(preview, "preview_request", forbidden)
    assert client.post("/runs/version/compatibility").status_code == 404


@pytest.mark.parametrize("target", ["version", "source"])
def test_unpassed_versions_do_not_start_previews(http, monkeypatch, target):
    client, records = http
    records[target].metrics.tests_passed = False

    async def forbidden(*args):
        pytest.fail("An unpassed version must not access the runtime")

    monkeypatch.setattr(preview, "preview_request", forbidden)
    assert client.post("/runs/version/compatibility").status_code == 409


@pytest.mark.parametrize("parent", [None, "version", "missing"])
def test_invalid_lineage_is_rejected(http, parent):
    client, records = http
    records["version"].parent_run_id = parent
    assert client.post("/runs/version/compatibility").status_code in {404, 409}


def test_cross_project_parent_is_rejected(http):
    client, records = http
    records["source"].project_id = "other-project"
    assert client.post("/runs/version/compatibility").status_code == 409


@pytest.mark.parametrize(
    "result",
    [
        {"status": 200, "body": "private invalid text", "truncated": False},
        {"status": 200, "body": json.dumps(schema()), "truncated": True},
        {"status": 500, "body": "private runtime failure", "truncated": False},
        {"status": 200, "body": "x" * 70_000, "truncated": False},
    ],
)
def test_incomplete_runtime_schemas_return_review_without_raw_details(http, monkeypatch, result):
    client, _ = http
    monkeypatch.setattr(preview, "preview_request", AsyncMock(return_value=result))
    response = client.post("/runs/version/compatibility")
    assert response.status_code == 200
    assert response.json()["status"] == "needs_review"
    assert response.json()["checked_operations"] == 0
    assert "private" not in response.text


def test_unavailable_docker_is_a_review_gap_not_a_clean_verdict(http, monkeypatch):
    client, _ = http
    monkeypatch.setattr(
        preview,
        "preview_request",
        AsyncMock(side_effect=SandboxUnavailableError("private socket path")),
    )
    response = client.post("/runs/version/compatibility")
    assert response.status_code == 200
    assert response.json()["status"] == "needs_review"
    assert "private" not in response.text


@pytest.mark.skipif(
    not os.getenv("RUN_LIVE_DOCKER"),
    reason="set RUN_LIVE_DOCKER=1 for real schema extraction",
)
def test_real_preview_schemas_produce_a_breaking_http_report(http):
    import asyncio
    from uuid import uuid4

    from app.sandbox.preview import stop_preview

    client, records = http
    source_id, version_id = f"compat-source-{uuid4().hex}", f"compat-new-{uuid4().hex}"
    source, version = run(source_id), run(version_id, source_id)
    records.update({source_id: source, version_id: version})
    for record, changed in ((source, False), (version, True)):
        record.state["files"][0]["content"] = (
            "from fastapi import FastAPI\nfrom pydantic import BaseModel\n"
            "app = FastAPI()\nclass BookCreate(BaseModel):\n    title: str\n"
            + ("    due_date: str\n" if changed else "")
            + "class BookRead(BaseModel):\n    title: str\n    id: "
            + ("int\n" if changed else "str\n")
            + "@app.post('/books', response_model=BookRead)\ndef create(book: BookCreate):\n"
            + "    return {'title': book.title, 'id': "
            + ("1" if changed else "'1'")
            + "}\n"
            + ("" if changed else "@app.get('/books')\ndef books(): return []\n")
        )
    try:
        response = client.post(f"/runs/{version_id}/compatibility")
        assert response.status_code == 200
        report = response.json()
        assert report["status"] == "breaking", report
        assert {c["code"] for c in report["changes"]} >= {
            "operation_removed",
            "required_added",
            "type_changed",
        }
        assert report["source_run_id"] == source_id
    finally:

        async def cleanup():
            await stop_preview(source_id)
            await stop_preview(version_id)

        asyncio.run(cleanup())
