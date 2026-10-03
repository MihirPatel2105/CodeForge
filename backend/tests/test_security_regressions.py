"""Previously confirmed attacks must now fail under concurrent requests."""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from app.core.security import decode_access_token, generate_reset_token, hash_reset_token
from app.models import PasswordResetToken
from tests.test_abuse_limits import FakeRedis


def _database():
    return MongoClient(settings.mongo_uri)[settings.mongo_db]


def _reset_link(user):
    token = generate_reset_token()
    _database().password_reset_tokens.insert_one(
        {
            "user_id": decode_access_token(user["token"])["sub"],
            "email": user["email"],
            "token_hash": hash_reset_token(token),
            "expires_at": datetime.now(UTC) + timedelta(minutes=10),
            "created_at": datetime.now(UTC),
        }
    )
    return token


def test_inflight_login_cannot_undo_reset(client, registered_user, monkeypatch):
    from app.api import auth

    token = _reset_link(registered_user)
    entered, release = threading.Event(), threading.Event()
    original = auth.update_user

    async def gated_update(user, fields, **kwargs):
        if "last_login_at" in fields:
            entered.set()
            await asyncio.to_thread(release.wait, 5)
        return await original(user, fields, **kwargs)

    monkeypatch.setattr(auth, "update_user", gated_update)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(
            client.post,
            "/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        try:
            assert entered.wait(5)
            reset = client.post(
                "/auth/reset-password",
                json={
                    "token": token,
                    "new_password": "Replacement12345!",
                },
            )
            assert reset.status_code == 200
        finally:
            release.set()
        assert pending.result(5).status_code == 401
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401
    assert (
        client.post(
            "/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/login",
            json={
                "email": registered_user["email"],
                "password": "Replacement12345!",
            },
        ).status_code
        == 200
    )


def test_reset_token_has_one_concurrent_winner(client, registered_user, monkeypatch):
    token = _reset_link(registered_user)
    original = PasswordResetToken.get_pymongo_collection()
    gate = asyncio.Event()
    arrived = 0

    class Collection:
        def __getattr__(self, name):
            return getattr(original, name)

        async def find_one_and_delete(self, query):
            nonlocal arrived
            arrived += 1
            if arrived == 2:
                gate.set()
            await asyncio.wait_for(gate.wait(), 5)
            return await original.find_one_and_delete(query)

    monkeypatch.setattr(
        PasswordResetToken, "get_pymongo_collection", classmethod(lambda cls: Collection())
    )

    def attempt(index):
        return client.post(
            "/auth/reset-password",
            json={
                "token": token,
                "new_password": f"ChangedPassword{index}!",
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, [1, 2])) == [200, 401]


def test_reauthentication_limit_spans_routes_and_sessions(client, registered_user, monkeypatch):
    redis = FakeRedis()
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")
    for index in range(10):
        path, payload = (
            (
                "/auth/change-password",
                {"current_password": "WrongPassword123!", "new_password": "ChangedPassword123!"},
            )
            if index % 2 == 0
            else ("/auth/passkeys/register/options", {"current_password": "WrongPassword123!"})
        )
        assert (
            client.post(path, headers=registered_user["headers"], json=payload).status_code == 401
        )
    assert (
        client.post(
            "/auth/delete-account",
            headers=registered_user["headers"],
            json={
                "password": "WrongPassword123!",
                "confirmation": "DELETE",
            },
        ).status_code
        == 429
    )


def _parallel_creation(client, user, monkeypatch, resource):
    from app.core import usage_limits

    uid = decode_access_token(user["token"])["sub"]
    _database().users.update_one(
        {"_id": ObjectId(uid)},
        {
            "$set": {
                "monthly_run_limit" if resource == "runs" else "project_limit": 1,
            }
        },
    )
    project = (
        client.post("/projects", headers=user["headers"], json={"name": "Quota"}).json()
        if resource == "runs"
        else None
    )
    gate = asyncio.Event()
    arrived = 0
    original = usage_limits._reserve_count

    async def gated_reserve(*args):
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            gate.set()
        await asyncio.wait_for(gate.wait(), 5)
        return await original(*args)

    monkeypatch.setattr(usage_limits, "_reserve_count", gated_reserve)
    payload = (
        {"project_id": project["id"], "prompt": "Build tasks CRUD"}
        if project
        else {"name": "Quota"}
    )

    def attempt(_):
        return client.post(f"/{resource}", headers=user["headers"], json=payload).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, [1, 2])) == ([202, 409] if project else [201, 409])
    assert _database()[resource].count_documents({"user_id": uid}) == 1


def test_monthly_quota_has_one_concurrent_winner(client, registered_user, monkeypatch):
    _parallel_creation(client, registered_user, monkeypatch, "runs")


def test_project_quota_has_one_concurrent_winner(client, registered_user, monkeypatch):
    _parallel_creation(client, registered_user, monkeypatch, "projects")


def test_active_capacity_releases_when_run_finishes(client, registered_user, monkeypatch):
    monkeypatch.setattr(settings, "max_active_runs_per_user", 1)
    project = client.post(
        "/projects", headers=registered_user["headers"], json={"name": "Slots"}
    ).json()
    payload = {"project_id": project["id"], "prompt": "Build tasks CRUD"}
    first = client.post("/runs", headers=registered_user["headers"], json=payload)
    assert first.status_code == 202
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 409
    _database().runs.update_one(
        {"_id": ObjectId(first.json()["run_id"])}, {"$set": {"status": "succeeded"}}
    )
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 202


def test_reauthentication_fails_closed_without_redis(client, registered_user, monkeypatch):
    redis = FakeRedis()
    redis.unavailable = True
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")
    assert (
        client.post(
            "/auth/change-password",
            headers=registered_user["headers"],
            json={
                "current_password": registered_user["password"],
                "new_password": "ChangedPassword123!",
            },
        ).status_code
        == 503
    )


def test_default_monthly_budget_is_finite(client, registered_user, monkeypatch):
    monkeypatch.setattr(settings, "default_monthly_run_limit", 1)
    project = client.post(
        "/projects", headers=registered_user["headers"], json={"name": "Default"}
    ).json()
    payload = {"project_id": project["id"], "prompt": "Build tasks CRUD"}
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 202
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 409


def test_global_capacity_is_shared_between_accounts(client, registered_user, monkeypatch):
    monkeypatch.setattr(settings, "max_active_runs_global", 1)
    second = client.post(
        "/auth/register",
        json={
            "first_name": "Other",
            "last_name": "Tester",
            "email": "other@example.com",
            "password": "OtherPassword123!",
        },
    ).json()
    headers = {"Authorization": f"Bearer {second['access_token']}"}
    projects = [
        client.post("/projects", headers=h, json={"name": "Global"}).json()
        for h in [registered_user["headers"], headers]
    ]

    def start(index):
        return client.post(
            "/runs",
            headers=[registered_user["headers"], headers][index],
            json={
                "project_id": projects[index]["id"],
                "prompt": "Build tasks CRUD",
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(start, [0, 1])) == [202, 409]


def test_run_submissions_are_throttled_before_admission(client, registered_user, monkeypatch):
    client.app.state.redis = FakeRedis()
    monkeypatch.setattr(settings, "redis_url", "redis://test")
    project = client.post(
        "/projects", headers=registered_user["headers"], json={"name": "Burst"}
    ).json()
    statuses = [
        client.post(
            "/runs",
            headers=registered_user["headers"],
            json={
                "project_id": project["id"],
                "prompt": "Build tasks CRUD",
            },
        ).status_code
        for _ in range(6)
    ]
    assert statuses == [202, 202, 202, 409, 409, 429]


def test_transient_failure_does_not_release_executing_capacity(
    client, registered_user, monkeypatch
):
    monkeypatch.setattr(settings, "max_active_runs_per_user", 1)
    project = client.post(
        "/projects", headers=registered_user["headers"], json={"name": "Transient"}
    ).json()
    payload = {"project_id": project["id"], "prompt": "Build tasks CRUD"}
    first = client.post("/runs", headers=registered_user["headers"], json=payload).json()["run_id"]
    _database().runs.update_one({"_id": ObjectId(first)}, {"$set": {"status": "failed_llm"}})
    _database().run_admissions.update_one({"_id": first}, {"$set": {"executing": True}})
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 409
    _database().run_admissions.update_one({"_id": first}, {"$set": {"executing": False}})
    assert client.post("/runs", headers=registered_user["headers"], json=payload).status_code == 202


def test_login_metadata_preserves_concurrent_admin_limits(client, registered_user, monkeypatch):
    from app.api import auth

    uid = decode_access_token(registered_user["token"])["sub"]
    original = auth.update_user

    async def change_limits(user, fields, **kwargs):
        if "last_login_at" in fields:
            _database().users.update_one({"_id": ObjectId(uid)}, {"$set": {"project_limit": 1}})
        return await original(user, fields, **kwargs)

    monkeypatch.setattr(auth, "update_user", change_limits)
    assert (
        client.post(
            "/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        ).status_code
        == 200
    )
    assert _database().users.find_one({"_id": ObjectId(uid)})["project_limit"] == 1
