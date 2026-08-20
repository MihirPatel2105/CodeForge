import pytest
from bson import ObjectId
from pymongo import MongoClient

from app.config import settings


@pytest.fixture
def project(client, registered_user):
    response = client.post(
        "/projects",
        json={"name": "Book API", "description": "demo"},
        headers=registered_user["headers"],
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def other_user(client):
    """A second account, for ownership-isolation checks."""
    response = client.post(
        "/auth/register",
        json={
            "first_name": "Otto",
            "email": "other@example.com",
            "password": "Secret12345",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}}


# --------------------------------------------------------------------------- #
# Projects
# --------------------------------------------------------------------------- #


def test_create_project(project):
    assert project["name"] == "Book API"
    assert isinstance(project["id"], str)


def test_projects_require_auth(client):
    assert client.get("/projects").status_code == 401
    assert client.post("/projects", json={"name": "x"}).status_code == 401


def test_list_returns_only_own_projects(client, registered_user, project, other_user):
    mine = client.get("/projects", headers=registered_user["headers"]).json()
    theirs = client.get("/projects", headers=other_user["headers"]).json()
    assert [p["id"] for p in mine] == [project["id"]]
    assert theirs == []


def test_get_another_users_project_is_404(client, project, other_user):
    """404 rather than 403 — a 403 would confirm the id exists."""
    response = client.get(f"/projects/{project['id']}", headers=other_user["headers"])
    assert response.status_code == 404


def test_malformed_project_id_is_404_not_500(client, registered_user):
    response = client.get("/projects/not-an-objectid", headers=registered_user["headers"])
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --------------------------------------------------------------------------- #
# Runs
# --------------------------------------------------------------------------- #


def test_create_run_returns_202_and_launches(client, registered_user, project, no_background_runs):
    """202 and return immediately — the pipeline runs in the background and the client
    watches it over SSE (FR-7). Never block the request on a run that takes minutes."""
    response = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "running"
    assert body["run_id"]
    assert no_background_runs == [body["run_id"]], "the pipeline was not launched"


def test_create_run_on_another_users_project_is_404(client, project, other_user):
    response = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=other_user["headers"],
    )
    assert response.status_code == 404


def test_get_run_returns_initial_state(client, registered_user, project):
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]

    body = client.get(f"/runs/{run_id}", headers=registered_user["headers"]).json()
    assert body["status"] == "running"
    assert body["state"]["loop_count"] == 0
    assert body["state"]["max_loops"] == 3
    assert body["state"]["rag_enabled"] is True
    assert body["state"]["thread_id"] == run_id


def test_rag_flag_is_recorded(client, registered_user, project):
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api", "rag_enabled": False},
        headers=registered_user["headers"],
    ).json()["run_id"]

    body = client.get(f"/runs/{run_id}", headers=registered_user["headers"]).json()
    assert body["state"]["rag_enabled"] is False


def test_run_files_empty_before_generation(client, registered_user, project):
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]

    body = client.get(f"/runs/{run_id}/files", headers=registered_user["headers"]).json()
    assert body["run_id"] == run_id
    assert body["files"] == []


def test_project_run_history(client, registered_user, project):
    for prompt in ("books api", "tasks api"):
        client.post(
            "/runs",
            json={"project_id": project["id"], "prompt": prompt},
            headers=registered_user["headers"],
        )

    runs = client.get(f"/projects/{project['id']}/runs", headers=registered_user["headers"]).json()
    assert len(runs) == 2
    # Summary view must not carry the full state snapshot.
    assert "state" not in runs[0]
    assert runs[0]["iterations"] == 0


def test_get_another_users_run_is_404(client, registered_user, project, other_user):
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]

    assert client.get(f"/runs/{run_id}", headers=other_user["headers"]).status_code == 404


# --------------------------------------------------------------------------- #
# Cancellation
# --------------------------------------------------------------------------- #


def _force_status(run_id: str, status: str) -> None:
    """Write a run's status directly.

    There is deliberately no route that sets an arbitrary status, and the app's own
    Mongo client belongs to the TestClient's event loop, so this reaches the document
    the same way `clean_database` does — synchronously, from outside the app.
    """
    with MongoClient(settings.mongo_uri) as mongo:
        result = mongo[settings.mongo_db]["runs"].update_one(
            {"_id": ObjectId(run_id)}, {"$set": {"status": status}}
        )
    assert result.matched_count == 1


def _start_run(client, registered_user, project) -> str:
    return client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]


def test_cancel_stops_a_live_run_whose_status_looks_terminal(
    client, registered_user, project, monkeypatch
):
    """`failed_llm` does not mean the run stopped.

    A node whose model chain is exhausted records that status and the graph keeps
    going — `after_reviewer` deliberately sends a failed review on to the Tester. The
    endpoint used to trust the stored status and return 200 without cancelling
    anything, so Cancel silently did nothing on exactly the runs a user most wants to
    stop. Observed live 2026-08-19: a sandbox execution and a whole loop iteration ran
    *after* the user pressed Cancel.
    """
    run_id = _start_run(client, registered_user, project)
    _force_status(run_id, "failed_llm")

    cancelled: list[str] = []

    def fake_cancel(rid: str) -> bool:
        cancelled.append(rid)
        return True  # a task is genuinely in flight

    monkeypatch.setattr("app.graph.executor.cancel", fake_cancel)

    response = client.post(f"/runs/{run_id}/cancel", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert cancelled == [run_id], "the in-flight task was never cancelled"


def test_cancel_leaves_a_genuinely_finished_run_alone(
    client, registered_user, project, monkeypatch
):
    """With no task in flight, a terminal status is authoritative: it must be reported
    back untouched rather than overwritten with `cancelled`."""
    run_id = _start_run(client, registered_user, project)
    _force_status(run_id, "succeeded")

    monkeypatch.setattr("app.graph.executor.cancel", lambda rid: False)

    response = client.post(f"/runs/{run_id}/cancel", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
