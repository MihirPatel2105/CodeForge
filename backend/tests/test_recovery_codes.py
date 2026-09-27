"""One-time recovery codes for accounts protected by authenticator MFA."""

import time

from pymongo import MongoClient

from app.config import settings
from app.core.security import _totp


def _enable(client, user) -> tuple[str, list[str]]:
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": user["password"]},
        headers=user["headers"],
    )
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    response = client.post(
        "/auth/totp/verify",
        json={"code": _totp(secret, int(time.time()) // 30)},
        headers=user["headers"],
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    return secret, response.json()["codes"]


def _ticket(client, user) -> str:
    response = client.post(
        "/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert response.status_code == 200
    assert "recovery_code" in response.json()["mfa_methods"]
    return response.json()["mfa_ticket"]


def test_codes_are_hashed_and_single_use(client, registered_user) -> None:
    _, codes = _enable(client, registered_user)
    assert len(codes) == len(set(codes)) == 8
    with MongoClient(settings.mongo_uri) as mongo:
        stored = list(mongo[settings.mongo_db].recovery_codes.find({}))
    assert len(stored) == 8
    assert all(code not in str(stored) for code in codes)

    used = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[0]},
    )
    assert used.status_code == 200
    assert used.json()["access_token"]
    replay = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[0]},
    )
    assert replay.status_code == 401
    next_code = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[1]},
    )
    assert next_code.status_code == 200


def test_regeneration_invalidates_previous_codes(client, registered_user) -> None:
    secret, old_codes = _enable(client, registered_user)
    denied = client.post(
        "/auth/recovery-codes/regenerate",
        json={"current_password": registered_user["password"], "totp_code": "000000"},
        headers=registered_user["headers"],
    )
    assert denied.status_code == 401
    refreshed = client.post(
        "/auth/recovery-codes/regenerate",
        json={
            "current_password": registered_user["password"],
            "totp_code": _totp(secret, int(time.time()) // 30),
        },
        headers=registered_user["headers"],
    )
    assert refreshed.status_code == 200
    assert refreshed.headers["cache-control"] == "no-store"
    new_codes = refreshed.json()["codes"]
    assert set(old_codes).isdisjoint(new_codes)
    assert (
        client.post(
            "/auth/login/complete",
            json={"ticket": _ticket(client, registered_user), "recovery_code": old_codes[0]},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/login/complete",
            json={"ticket": _ticket(client, registered_user), "recovery_code": new_codes[0]},
        ).status_code
        == 200
    )


def test_disabling_totp_revokes_recovery_codes(client, registered_user) -> None:
    secret, _ = _enable(client, registered_user)
    response = client.post(
        "/auth/totp/disable",
        json={
            "current_password": registered_user["password"],
            "code": _totp(secret, int(time.time()) // 30),
        },
        headers=registered_user["headers"],
    )
    assert response.status_code == 200
    with MongoClient(settings.mongo_uri) as mongo:
        assert mongo[settings.mongo_db].recovery_codes.count_documents({}) == 0


def test_lost_authenticator_can_be_replaced_with_recovery_code(client, registered_user) -> None:
    _, codes = _enable(client, registered_user)
    assert (
        client.post(
            "/auth/totp/setup",
            json={"current_password": registered_user["password"]},
            headers=registered_user["headers"],
        ).status_code
        == 409
    )

    disabled = client.post(
        "/auth/totp/disable",
        json={"current_password": registered_user["password"], "recovery_code": codes[0]},
        headers=registered_user["headers"],
    )
    assert disabled.status_code == 200
    fresh_headers = {"Authorization": f"Bearer {disabled.json()['access_token']}"}
    assert (
        client.post(
            "/auth/totp/setup",
            json={"current_password": registered_user["password"]},
            headers=fresh_headers,
        ).status_code
        == 200
    )
    with MongoClient(settings.mongo_uri) as mongo:
        assert mongo[settings.mongo_db].recovery_codes.count_documents({}) == 0
