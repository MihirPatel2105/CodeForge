"""Admin proof is server-side, session-bound, recent and rate-limited."""

import time
from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId
from pymongo import MongoClient
from redis.exceptions import ConnectionError

from app.config import settings
from app.core.security import _totp, create_access_token, decode_access_token, decrypt_totp_secret


class FakeRedis:
    def __init__(self):
        self.counts = {}
        self.unavailable = False

    async def eval(self, script, numkeys, key, window):
        if self.unavailable:
            raise ConnectionError("offline")
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key], window

    async def aclose(self):
        pass


def db():
    return MongoClient(settings.mongo_uri)[settings.mongo_db]


@pytest.fixture
def operator(strong_auth_user, monkeypatch):
    monkeypatch.setattr(settings, "admin_email", strong_auth_user["email"])
    return strong_auth_user


def test_password_and_forged_role_do_not_unlock_admin(client, registered_user, monkeypatch):
    monkeypatch.setattr(settings, "admin_email", registered_user["email"])
    status = client.get("/auth/admin-access", headers=registered_user["headers"])
    assert status.json() == {"allowed": False, "expires_at": None}
    for method, path in [("GET", "/admin/overview"), ("POST", "/admin/deployments/123/stop")]:
        response = client.request(
            method, path, headers=registered_user["headers"], json={"reason": "Test reason"}
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "admin_verification_required"
    monkeypatch.setattr(settings, "admin_email", "different@example.com")
    assert (
        client.get(
            "/admin/overview", headers={**registered_user["headers"], "X-Admin": "true"}
        ).status_code
        == 403
    )


def test_recent_totp_session_unlocks_without_cache(client, operator):
    response = client.get("/auth/admin-access", headers=operator["headers"])
    assert response.status_code == 200
    assert response.json()["allowed"] is True
    until = datetime.fromisoformat(response.json()["expires_at"].replace("Z", "+00:00"))
    assert datetime.now(UTC) < until <= datetime.now(UTC) + timedelta(hours=1)
    response = client.get("/admin/overview", headers=operator["headers"])
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize(
    "change",
    [
        "expired_proof",
        "future_proof",
        "revoked",
        "missing",
        "unverified",
        "reset_required",
        "role_removed",
    ],
)
def test_admin_security_changes_take_effect_immediately(client, operator, monkeypatch, change):
    claims = decode_access_token(operator["token"])
    database = db()
    if change == "missing":
        database.login_sessions.delete_one({"jti": claims["jti"]})
    elif change == "revoked":
        database.login_sessions.update_one(
            {"jti": claims["jti"]}, {"$set": {"revoked_at": datetime.now(UTC)}}
        )
    elif change in {"expired_proof", "future_proof"}:
        offset = -61 if change == "expired_proof" else 10
        database.login_sessions.update_one(
            {"jti": claims["jti"]},
            {"$set": {"strong_auth_at": datetime.now(UTC) + timedelta(minutes=offset)}},
        )
    elif change == "role_removed":
        monkeypatch.setattr(settings, "admin_email", None)
    else:
        field = "email_verified" if change == "unverified" else "password_reset_required"
        database.users.update_one(
            {"_id": ObjectId(claims["sub"])}, {"$set": {field: change != "unverified"}}
        )
    assert client.get("/admin/overview", headers=operator["headers"]).status_code == 403


def test_signed_token_without_session_cannot_become_admin(client, operator):
    claims = decode_access_token(operator["token"])
    token = create_access_token(claims["sub"], token_version=claims["tv"])
    assert (
        client.get("/admin/overview", headers={"Authorization": f"Bearer {token}"}).status_code
        == 403
    )
    malformed = create_access_token("invalid-object-id")
    assert (
        client.get("/admin/overview", headers={"Authorization": f"Bearer {malformed}"}).status_code
        == 401
    )


def test_admin_limits_shared_across_sessions_fail_closed(client, operator, monkeypatch):
    redis = FakeRedis()
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")
    for _ in range(20):
        assert (
            client.patch(
                "/admin/incidents/unknown",
                headers=operator["headers"],
                json={"status": "open", "note": "Test note"},
            ).status_code
            == 404
        )
    assert (
        client.patch(
            "/admin/incidents/unknown",
            headers=operator["headers"],
            json={"status": "open", "note": "Test note"},
        ).status_code
        == 429
    )
    assert client.get("/admin/overview", headers=operator["headers"]).status_code == 200
    claims = decode_access_token(operator["token"])
    secret = decrypt_totp_secret(
        db().users.find_one({"_id": ObjectId(claims["sub"])})["totp_secret_encrypted"]
    )
    ticket = client.post(
        "/auth/login", json={"email": operator["email"], "password": operator["password"]}
    ).json()["mfa_ticket"]
    token = client.post(
        "/auth/login/complete",
        json={"ticket": ticket, "totp_code": _totp(secret, int(time.time()) // 30)},
    ).json()["access_token"]
    assert (
        client.patch(
            "/admin/incidents/unknown",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "open", "note": "Another session"},
        ).status_code
        == 429
    )
    read_key = next(key for key in redis.counts if ":read:" in key)
    redis.counts[read_key] = 180
    assert client.get("/admin/overview", headers=operator["headers"]).status_code == 429
    redis.unavailable = True
    assert client.get("/admin/overview", headers=operator["headers"]).status_code == 503


def test_all_admin_routes_use_central_server_guard():
    def has_guard(dependant):
        return getattr(dependant.call, "__name__", "") == "get_current_admin" or any(
            has_guard(dep) for dep in dependant.dependencies
        )

    from app.api.admin import router as admin_router
    from app.api.admin_operations import router as operations_router

    routes = [*admin_router.routes, *operations_router.routes]
    assert routes
    assert all(has_guard(route.dependant) for route in routes)


def test_recovery_login_keeps_account_access_but_cannot_unlock_admin(client, operator):
    claims = decode_access_token(operator["token"])
    user = db().users.find_one({"_id": ObjectId(claims["sub"])})
    secret = decrypt_totp_secret(user["totp_secret_encrypted"])
    codes = client.post(
        "/auth/recovery-codes/regenerate",
        headers=operator["headers"],
        json={
            "current_password": operator["password"],
            "totp_code": _totp(secret, int(time.time()) // 30),
        },
    )
    assert codes.status_code == 200
    ticket = client.post(
        "/auth/login", json={"email": operator["email"], "password": operator["password"]}
    ).json()["mfa_ticket"]
    response = client.post(
        "/auth/login/complete", json={"ticket": ticket, "recovery_code": codes.json()["codes"][0]}
    )
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert client.get("/admin/overview", headers=headers).status_code == 403


def test_admin_csv_neutralizes_user_controlled_formulas():
    import csv
    import io

    from app.api.admin import _csv_response

    values = [
        '=HYPERLINK("https://example.com")',
        " +SUM(1,2)",
        "@SUM(1,2)",
        "-CMD",
        "\tvalue",
        "ordinary",
        -3,
    ]
    result = _csv_response("test.csv", [values])
    row = next(csv.reader(io.StringIO(result.body.decode())))
    assert row[:5] == ["'" + value for value in values[:5]]
    assert row[5:] == ["ordinary", "-3"]
