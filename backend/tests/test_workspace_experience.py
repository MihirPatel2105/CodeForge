"""Workspace evolution: permissions, immutable source runs and bounded checkpoints."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from langgraph.checkpoint.memory import MemorySaver
from pymongo import MongoClient

from app.config import settings
from app.graph import executor
from app.graph.build import build_graph, thread_config
from app.graph.executor import resume_run as real_resume_run
from app.graph.executor import start_run as real_start_run
from app.graph.state import new_run_state


@pytest.fixture
def workspace(client, registered_user):
    headers = registered_user["headers"]
    project = client.post("/projects", json={"name": "Library"}, headers=headers).json()
    run = client.post(
        "/runs", json={"project_id": project["id"], "prompt": "Book API"}, headers=headers
    ).json()
    return headers, project["id"], run["run_id"]


def update_run(run_id, **fields):
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].runs.update_one({"_id": ObjectId(run_id)}, {"$set": fields})


def test_archive_restore_and_rename(client, workspace):
    headers, project, _ = workspace
    payload = {"name": "Updated library", "description": "Books", "archived": True}
    response = client.patch(f"/projects/{project}", headers=headers, json=payload)
    assert response.status_code == 200
    assert response.json()["archived"]
    assert not client.get("/projects/overview", headers=headers).json()["items"]
    archived = client.get("/projects/overview?archived=true", headers=headers).json()
    assert archived["items"][0]["name"] == payload["name"]
    payload["archived"] = False
    client.patch(f"/projects/{project}", headers=headers, json=payload)
    assert len(client.get("/projects/overview", headers=headers).json()["items"]) == 1
    payload["name"] = "  "
    assert client.patch(f"/projects/{project}", headers=headers, json=payload).status_code == 422


def test_version_keeps_source_and_requires_passed_tests(client, workspace):
    headers, project, source = workspace
    payload = {"project_id": project, "prompt": "Add a due date", "parent_run_id": source}
    assert client.post("/runs", json=payload, headers=headers).status_code == 409
    original_files = [{"path": "main.py", "content": "source"}]
    update_run(
        source,
        status="succeeded",
        metrics={"tests_passed": True},
        state={"files": original_files, "requirements": {"summary": "Books"}},
    )
    before = client.get(f"/runs/{source}", headers=headers).json()
    response = client.post("/runs", json=payload, headers=headers)
    assert response.status_code == 202
    new = client.get(f"/runs/{response.json()['run_id']}", headers=headers).json()
    assert new["parent_run_id"] == source
    assert new["state"]["revision_context"]["files"] == original_files
    assert client.get(f"/runs/{source}", headers=headers).json() == before
    another_project = client.post("/projects", json={"name": "Other"}, headers=headers).json()["id"]
    payload["project_id"] = another_project
    assert client.post("/runs", json=payload, headers=headers).status_code == 409


def test_filters_attention_and_other_owner(client, workspace):
    headers, project, run = workspace
    update_run(run, status="awaiting_approval")
    assert len(client.get("/runs/attention", headers=headers).json()) == 1
    assert not client.get(f"/projects/{project}/runs/page?q=missing", headers=headers).json()[
        "items"
    ]
    assert (
        len(
            client.get(
                f"/projects/{project}/runs/page?q=Book&outcome=awaiting_approval", headers=headers
            ).json()["items"]
        )
        == 1
    )
    token = client.post(
        "/auth/register",
        json={"first_name": "Other", "email": "other@example.com", "password": "Secret12345"},
    ).json()["access_token"]
    other = {"Authorization": f"Bearer {token}"}
    assert client.get("/runs/attention", headers=other).json() == []
    assert (
        client.patch(f"/projects/{project}", headers=other, json={"name": "Intrusion"}).status_code
        == 404
    )
    assert (
        client.post(
            f"/runs/{run}/revise", headers=other, json={"phase": "pm", "note": "change"}
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/runs",
            headers=other,
            json={"project_id": project, "parent_run_id": run, "prompt": "change"},
        ).status_code
        == 404
    )


def test_checkpoint_decisions_are_bounded_and_cannot_repeat(client, workspace, monkeypatch):
    headers, _, run = workspace
    revisions = AsyncMock()
    monkeypatch.setattr(executor, "revise_run", revisions)
    update_run(run, status="awaiting_approval", state={"awaiting_approval": "pm"})
    endpoint = f"/runs/{run}/revise"
    assert (
        client.post(
            endpoint, headers=headers, json={"phase": "architect", "note": "change"}
        ).status_code
        == 409
    )
    assert (
        client.post(endpoint, headers=headers, json={"phase": "pm", "note": "   "}).status_code
        == 422
    )
    assert (
        client.post(
            endpoint, headers=headers, json={"phase": "pm", "note": "Add a date"}
        ).status_code
        == 200
    )
    assert revisions.await_count == 1
    assert (
        client.post(endpoint, headers=headers, json={"phase": "pm", "note": "Again"}).status_code
        == 409
    )
    update_run(
        run,
        status="awaiting_approval",
        state={
            "awaiting_approval": "pm",
            "checkpoint_revisions": [{"phase": "pm", "note": "change"}] * 3,
        },
    )
    assert (
        client.post(endpoint, headers=headers, json={"phase": "pm", "note": "Again"}).status_code
        == 409
    )
    assert (
        client.post(
            f"/runs/{run}/approve", headers=headers, json={"phase": "pm", "approved": True}
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/runs/{run}/approve", headers=headers, json={"phase": "pm", "approved": False}
        ).status_code
        == 409
    )


def test_revision_rewinds_only_requested_stage_and_pauses_again(monkeypatch):
    """Execute real LangGraph checkpoint updates with deterministic agent nodes."""
    import app.graph.build as assembly

    calls = []

    async def pm(state):
        calls.append("pm")
        return {"requirements": None}

    async def architect(state):
        calls.append("architect")
        return {"design": None}

    monkeypatch.setattr(assembly, "pm_node", pm)
    monkeypatch.setattr(assembly, "architect_node", architect)
    graph = build_graph().compile(
        checkpointer=MemorySaver(), interrupt_before=["architect", "coder_gate"]
    )
    monkeypatch.setattr(executor, "compile_graph", lambda **kwargs: graph)
    monkeypatch.setattr(executor, "mark_execution", AsyncMock())
    monkeypatch.setattr(executor.events, "approval_resolved", AsyncMock())
    after = AsyncMock()
    monkeypatch.setattr(executor, "_after_invoke", after)

    async def journey():
        config = thread_config("revision-test")
        state = new_run_state(
            run_id="revision-test",
            project_id="p",
            user_id="u",
            thread_id="revision-test",
            user_prompt="books",
        )
        await graph.ainvoke(state, config)
        assert calls == ["pm"]
        await executor.revise_run("revision-test", "pm", "Add a date")
        await executor.await_all(10)
        snap = await graph.aget_state(config)
        assert snap.next == ("architect",)
        assert calls == ["pm", "pm"]
        assert snap.values["checkpoint_revisions"][0]["note"] == "Add a date"
        await graph.ainvoke(None, config)
        assert (await graph.aget_state(config)).next == ("coder_gate",)
        await executor.revise_run("revision-test", "architect", "Use plural paths")
        await executor.await_all(10)
        assert calls == ["pm", "pm", "architect", "architect"]
        assert (await graph.aget_state(config)).next == ("coder_gate",)

    asyncio.run(journey())


def test_stale_checkpoint_and_final_judgement(client, workspace):
    headers, _, run = workspace
    update_run(
        run,
        status="awaiting_approval",
        state={
            "awaiting_approval": "pm",
            "checkpoint_revisions": [{"phase": "pm", "note": "new plan"}],
        },
    )
    assert (
        client.post(
            f"/runs/{run}/approve",
            headers=headers,
            json={"phase": "pm", "approved": True, "expected_revision": 0},
        ).status_code
        == 409
    )
    update_run(run, status="succeeded")
    response = client.post(
        f"/runs/{run}/approve",
        headers=headers,
        json={"phase": "final", "approved": False, "note": "Needs more work"},
    )
    assert response.status_code == 200
    current = client.get(f"/runs/{run}", headers=headers).json()
    assert current["status"] == "succeeded"
    assert current["state"]["approvals"]["final"]["approved"] is False


def test_real_executor_persists_revisions_and_reapproval(client, registered_user, monkeypatch):
    """Real HTTP + Mongo + graph nodes, replacing only model responses/checkpointer."""
    from app.agents import ArchitectAgent, PMAgent
    from app.llm.client import LLMResult
    from app.schemas.agents import Design, Requirements

    async def pm(_self, state):
        revised = bool(state.get("checkpoint_revisions"))
        return LLMResult(
            value=Requirements(
                project_name="Library",
                summary="Books",
                entities=[
                    {
                        "name": "Book",
                        "fields": [
                            {"name": "title", "type": "str"},
                            *([{"name": "year", "type": "int"}] if revised else []),
                        ],
                    }
                ],
                operations=["create", "read"],
            ),
            model="test",
            attempts=[],
        )

    async def architect(_self, _state):
        return LLMResult(
            value=Design(
                collections=[{"name": "books", "fields": ["title"]}],
                endpoints=[
                    {
                        "method": "GET",
                        "path": "/books",
                        "response_model": "BookRead",
                        "status_code": 200,
                    }
                ],
                files=[{"path": "main.py", "purpose": "routes"}],
            ),
            model="test",
            attempts=[],
        )

    monkeypatch.setattr(PMAgent, "run", pm)
    monkeypatch.setattr(ArchitectAgent, "run", architect)
    graph = build_graph().compile(
        checkpointer=MemorySaver(), interrupt_before=["architect", "coder_gate"]
    )
    monkeypatch.setattr(executor, "compile_graph", lambda **kwargs: graph)
    monkeypatch.setattr(executor, "mark_execution", AsyncMock())
    monkeypatch.setattr(executor, "start_run", real_start_run)
    monkeypatch.setattr(executor, "resume_run", real_resume_run)
    headers = registered_user["headers"]
    project = client.post("/projects", json={"name": "Books"}, headers=headers).json()["id"]
    run = client.post(
        "/runs", headers=headers, json={"project_id": project, "prompt": "Book API"}
    ).json()["run_id"]
    client.portal.call(executor.await_all, 10)
    first = client.get(f"/runs/{run}", headers=headers).json()
    assert first["status"] == "awaiting_approval"
    assert len(first["state"]["requirements"]["entities"][0]["fields"]) == 1
    for number in range(3):
        response = client.post(
            f"/runs/{run}/revise",
            headers=headers,
            json={"phase": "pm", "note": "Add year", "expected_revision": number},
        )
        assert response.status_code == 200
        client.portal.call(executor.await_all, 10)
        current = client.get(f"/runs/{run}", headers=headers).json()
        assert current["status"] == "awaiting_approval"
        assert len(current["state"]["checkpoint_revisions"]) == number + 1
        assert len(current["state"]["requirements"]["entities"][0]["fields"]) == 2
    assert (
        client.post(
            f"/runs/{run}/revise",
            headers=headers,
            json={"phase": "pm", "note": "Again", "expected_revision": 3},
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/runs/{run}/approve",
            headers=headers,
            json={"phase": "pm", "approved": True, "expected_revision": 3},
        ).status_code
        == 200
    )
    client.portal.call(executor.await_all, 10)
    current = client.get(f"/runs/{run}", headers=headers).json()
    assert current["state"]["awaiting_approval"] == "architect"
    assert current["state"]["approvals"]["pm"]["approved"] is True
    assert (
        client.post(
            f"/runs/{run}/revise",
            headers=headers,
            json={"phase": "architect", "note": "Keep plural routes", "expected_revision": 0},
        ).status_code
        == 200
    )
    client.portal.call(executor.await_all, 10)
    current = client.get(f"/runs/{run}", headers=headers).json()
    assert current["state"]["awaiting_approval"] == "architect"
    assert current["state"]["design"]["endpoints"][0]["path"] == "/books"
    assert not current["state"]["files"]
    client.post(f"/runs/{run}/cancel", headers=headers)
