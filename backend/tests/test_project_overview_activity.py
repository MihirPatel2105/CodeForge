"""Project overview: ordered by latest activity, filterable by the latest run's state."""

from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient

from app.config import settings


def _set_run(run_id: str, **fields) -> None:
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].runs.update_one({"_id": ObjectId(run_id)}, {"$set": fields})


def _set_project(project_id: str, **fields) -> None:
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].projects.update_one(
            {"_id": ObjectId(project_id)}, {"$set": fields}
        )


def _names(page: dict) -> list[str]:
    return [item["name"] for item in page["items"]]


def _seed(client, headers) -> dict[str, str]:
    """Three projects created oldest to newest; only Alpha and Beta have runs."""
    base = datetime(2026, 10, 1, tzinfo=UTC)
    ids: dict[str, str] = {}
    for offset, name in enumerate(["Alpha", "Beta", "Gamma"]):
        project = client.post("/projects", json={"name": name}, headers=headers).json()
        _set_project(project["id"], created_at=base + timedelta(days=offset))
        ids[name] = project["id"]
    for name, day in (("Beta", 5), ("Alpha", 9)):
        run = client.post(
            "/runs", json={"project_id": ids[name], "prompt": f"{name} API"}, headers=headers
        ).json()
        _set_run(run["run_id"], created_at=base + timedelta(days=day))
        ids[f"{name}-run"] = run["run_id"]
    return ids


def test_projects_are_ordered_by_latest_run_then_creation(client, registered_user):
    headers = registered_user["headers"]
    _seed(client, headers)

    page = client.get("/projects/overview", headers=headers).json()

    assert _names(page) == ["Alpha", "Beta", "Gamma"]
    assert page["items"][0]["last_activity_at"].startswith("2026-10-10")
    assert page["items"][2]["last_activity_at"].startswith("2026-10-03")


def test_activity_cursor_walks_every_project_once(client, registered_user):
    headers = registered_user["headers"]
    _seed(client, headers)

    seen: list[str] = []
    cursor = None
    for _ in range(4):
        query = "/projects/overview?limit=1" + (f"&cursor={cursor}" if cursor else "")
        page = client.get(query, headers=headers).json()
        seen += _names(page)
        cursor = page["next_cursor"]
        if not cursor:
            break

    assert seen == ["Alpha", "Beta", "Gamma"]
    bad = client.get("/projects/overview?cursor=not-a-cursor", headers=headers)
    assert bad.status_code == 422


def test_state_filter_uses_each_projects_latest_run(client, registered_user):
    headers = registered_user["headers"]
    ids = _seed(client, headers)
    _set_run(ids["Alpha-run"], status="awaiting_approval")
    _set_run(ids["Beta-run"], status="failed_llm")

    needs_you = client.get("/projects/overview?state=needs_you", headers=headers).json()
    failing = client.get("/projects/overview?state=failing", headers=headers).json()
    passing = client.get("/projects/overview?state=passing", headers=headers).json()

    assert _names(needs_you) == ["Alpha"]
    assert needs_you["matching_projects"] == 1
    assert needs_you["total_projects"] == 3
    assert _names(failing) == ["Beta"]
    assert _names(passing) == []
    assert client.get("/projects/overview?state=bogus", headers=headers).status_code == 422
