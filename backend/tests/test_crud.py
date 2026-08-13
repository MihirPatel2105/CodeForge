import pytest


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
        "/auth/register", json={"email": "other@example.com", "password": "secret12345"}
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


def test_create_run_returns_202_and_queues(client, registered_user, project):
    response = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["run_id"]


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
    assert body["status"] == "queued"
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
