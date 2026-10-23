"""One-time recovery codes for accounts protected by authenticator MFA."""

from pymongo import MongoClient

from app.config import settings


def _enable(client, user, totp_code) -> tuple[str, list[str]]:
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": user["password"]},
        headers=user["headers"],
    )
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    response = client.post(
        "/auth/totp/verify",
        json={"code": totp_code(secret)},
        headers=user["headers"],
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    user["token"] = response.json()["access_token"]
    user["headers"] = {"Authorization": f"Bearer {user['token']}"}
    return secret, response.json()["codes"]


def _ticket(client, user) -> str:
    response = client.post(
        "/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert response.status_code == 200
    assert "recovery_code" not in response.json()["mfa_methods"]
    return response.json()["mfa_ticket"]


def test_codes_are_hashed_and_cannot_bypass_approved_recovery(
    client, registered_user, totp_code
) -> None:
    _, codes = _enable(client, registered_user, totp_code)
    assert len(codes) == len(set(codes)) == 8
    with MongoClient(settings.mongo_uri) as mongo:
        stored = list(mongo[settings.mongo_db].recovery_codes.find({}))
    assert len(stored) == 8
    assert all(code not in str(stored) for code in codes)

    used = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[0]},
    )
    assert used.status_code == 401
    replay = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[0]},
    )
    assert replay.status_code == 401
    next_code = client.post(
        "/auth/login/complete",
        json={"ticket": _ticket(client, registered_user), "recovery_code": codes[1]},
    )
    assert next_code.status_code == 401


def test_regeneration_invalidates_previous_codes(client, registered_user, totp_code) -> None:
    secret, old_codes = _enable(client, registered_user, totp_code)
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
            "totp_code": totp_code(secret),
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
        == 401
    )


def test_disabling_totp_revokes_recovery_codes(client, registered_user, totp_code) -> None:
    secret, _ = _enable(client, registered_user, totp_code)
    response = client.post(
        "/auth/totp/disable",
        json={
            "current_password": registered_user["password"],
            "code": totp_code(secret),
        },
        headers=registered_user["headers"],
    )
    assert response.status_code == 200
    with MongoClient(settings.mongo_uri) as mongo:
        assert mongo[settings.mongo_db].recovery_codes.count_documents({}) == 0


def test_lost_authenticator_requires_approved_recovery_instead_of_disable(
    client, registered_user, totp_code
) -> None:
    _, codes = _enable(client, registered_user, totp_code)
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
    assert disabled.status_code == 401
    with MongoClient(settings.mongo_uri) as mongo:
        assert mongo[settings.mongo_db].recovery_codes.count_documents({}) == 8
