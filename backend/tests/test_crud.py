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


def test_run_files_includes_the_generated_test_suite(client, registered_user, project):
    """The endpoint must return `test_files` as well as `files`.

    It previously returned only the application files. That broke the dashboard's code
    viewer in a way no unit test caught: the file rail is built from SSE `file.written`
    events, which *do* include the test suite, and the panel auto-selects the newest
    file — so it landed on `test_main.py`, found no content for it, and rendered its
    "No files yet" empty state while the rail beside it listed five files. Only the
    empty-tree case was covered here, so the omission was invisible.
    """
    from bson import ObjectId
    from pymongo import MongoClient

    from app.config import settings

    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]

    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].runs.update_one(
            {"_id": ObjectId(run_id)},
            {
                "$set": {
                    "state.files": [{"path": "main.py", "content": "app = FastAPI()"}],
                    "state.test_files": [{"path": "test_main.py", "content": "def test_x(): ..."}],
                }
            },
        )

    body = client.get(f"/runs/{run_id}/files", headers=registered_user["headers"]).json()
    paths = [f["path"] for f in body["files"]]
    assert paths == ["main.py", "test_main.py"], paths
    # Content must come back too — a path with no content is what broke the viewer.
    assert all(f["content"] for f in body["files"])


def test_file_history_returns_archived_passes_only_to_run_owner(
    client, registered_user, project, other_user
):
    from gridfs import GridFSBucket

    from app.db.artifacts import zip_tree
    from app.schemas.agents import GeneratedFile

    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "books api"},
        headers=registered_user["headers"],
    ).json()["run_id"]
    with MongoClient(settings.mongo_uri) as mongo:
        bucket = GridFSBucket(mongo[settings.mongo_db], bucket_name="artifacts")
        for iteration, content in ((0, "value = 1\n"), (1, "value = 2\n")):
            bucket.upload_from_stream(
                f"{run_id}-tree-{iteration}.zip",
                zip_tree([GeneratedFile(path="main.py", content=content)]),
                metadata={"run_id": run_id, "kind": "file_tree", "iteration": iteration},
            )

    url = f"/runs/{run_id}/file-history"
    response = client.get(url, headers=registered_user["headers"])
    assert response.status_code == 200
    versions = response.json()["versions"]
    assert [version["iteration"] for version in versions] == [0, 1]
    assert [version["files"][0]["content"] for version in versions] == [
        "value = 1\n",
        "value = 2\n",
    ]
    assert client.get(url, headers=other_user["headers"]).status_code == 404


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


def test_rejection_records_excluded_terminal_metrics(client, registered_user, project):
    run_id = _start_run(client, registered_user, project)
    response = client.post(
        f"/runs/{run_id}/approve",
        json={"phase": "pm", "approved": False, "note": "requirements need revision"},
        headers=registered_user["headers"],
    )
    assert response.status_code == 200
    snapshot = client.get(f"/runs/{run_id}", headers=registered_user["headers"]).json()
    assert snapshot["status"] == "rejected"
    assert snapshot["metrics"]["exclusion_reason"] == "rejected"


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
    snapshot = client.get(f"/runs/{run_id}", headers=registered_user["headers"]).json()
    assert snapshot["metrics"]["exclusion_reason"] == "cancelled"


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


# --------------------------------------------------------------------------- #
# Deleting a project
# --------------------------------------------------------------------------- #


def test_delete_project_removes_it(client, registered_user, project):
    response = client.delete(f"/projects/{project['id']}", headers=registered_user["headers"])
    assert response.status_code == 200

    gone = client.get(f"/projects/{project['id']}", headers=registered_user["headers"])
    assert gone.status_code == 404


def test_delete_project_requires_auth(client, project):
    response = client.delete(f"/projects/{project['id']}")
    assert response.status_code == 401


def test_cannot_delete_another_users_project(client, project, other_user, registered_user):
    """404 rather than 403 — a stranger should not learn the project exists."""
    response = client.delete(f"/projects/{project['id']}", headers=other_user["headers"])
    assert response.status_code == 404

    # And it really is still there for its owner.
    still = client.get(f"/projects/{project['id']}", headers=registered_user["headers"])
    assert still.status_code == 200


def test_delete_project_takes_its_runs_with_it(
    client, registered_user, project, no_background_runs
):
    created = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "An API for books"},
        headers=registered_user["headers"],
    )
    assert created.status_code == 202
    run_id = created.json()["run_id"]

    response = client.delete(f"/projects/{project['id']}", headers=registered_user["headers"])
    assert response.status_code == 200
    assert response.json()["runs_deleted"] == 1

    orphan = client.get(f"/runs/{run_id}", headers=registered_user["headers"])
    assert orphan.status_code == 404


def test_delete_project_removes_stored_artifacts(
    client, registered_user, project, no_background_runs
):
    """GridFS is the easy thing to leave behind.

    Artifacts live in their own pair of collections, so removing a run does not remove
    the file trees stored against it. Asserting the reported count is not enough on its
    own — an earlier bug in this cascade passed its tests because the accounts under
    test had no artifacts, so the loop never ran. This writes real ones first.
    """
    created = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "An API for books"},
        headers=registered_user["headers"],
    )
    run_id = created.json()["run_id"]

    # Write two GridFS files against the run, the way a real run's artifacts are stored.
    mongo = MongoClient(settings.mongo_uri)
    db = mongo[settings.mongo_db]
    bucket_files = db["artifacts.files"]
    for kind in ("file_tree", "pytest_report"):
        db["artifacts.chunks"].insert_one({"files_id": ObjectId(), "n": 0, "data": b"x"})
        bucket_files.insert_one(
            {
                "filename": f"{run_id}_{kind}",
                "length": 1,
                "chunkSize": 261120,
                "uploadDate": None,
                "metadata": {"run_id": run_id, "kind": kind, "iteration": 0},
            }
        )
    assert bucket_files.count_documents({"metadata.run_id": run_id}) == 2

    response = client.delete(f"/projects/{project['id']}", headers=registered_user["headers"])
    assert response.status_code == 200
    assert response.json()["artifacts_deleted"] == 2
    assert bucket_files.count_documents({"metadata.run_id": run_id}) == 0
    mongo.close()


def test_delete_project_leaves_other_projects_alone(client, registered_user, project):
    other = client.post(
        "/projects",
        json={"name": "Untouched"},
        headers=registered_user["headers"],
    ).json()

    client.delete(f"/projects/{project['id']}", headers=registered_user["headers"])

    survivor = client.get(f"/projects/{other['id']}", headers=registered_user["headers"])
    assert survivor.status_code == 200
