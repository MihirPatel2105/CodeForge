"""MFA recovery, enrollment revocation, and cross-request OTP replay regressions."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from pymongo import MongoClient

from app.config import settings


def _enable(client, user, totp_code):
    setup = client.post(
        "/auth/totp/setup",
        headers=user["headers"],
        json={"current_password": user["password"]},
    )
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    code = totp_code(secret)
    enabled = client.post("/auth/totp/verify", headers=user["headers"], json={"code": code})
    assert enabled.status_code == 200
    return secret, code, enabled.json()


def _ticket(client, user):
    result = client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    assert result.status_code == 200
    return result.json()["mfa_ticket"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_enrollment_ends_all_old_sessions_and_returns_working_replacement(
    client, registered_user, totp_code
):
    other = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["access_token"]
    _, _, enabled = _enable(client, registered_user, totp_code)
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401
    assert client.get("/auth/me", headers=_headers(other)).status_code == 401
    assert client.get("/auth/me", headers=_headers(enabled["access_token"])).status_code == 200
    assert len(enabled["codes"]) == 8


@pytest.mark.parametrize("method", ["totp", "recovery_code"])
def test_reset_requires_mfa_before_session(client, registered_user, totp_code, monkeypatch, method):
    secret, _, enabled = _enable(client, registered_user, totp_code)
    links = []

    async def capture(**kwargs):
        links.append(kwargs["reset_url"])

    monkeypatch.setattr("app.api.auth.send_password_reset_email", capture)
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = links[0].rsplit("/", 1)[-1]
    reset = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Replacement12345!"}
    )
    assert reset.status_code == 200
    result = reset.json()
    assert result["access_token"] is None
    assert result["mfa_required"] is True
    assert result["mfa_methods"] == ["totp", "recovery_code"]
    assert client.get("/auth/me", headers=_headers(enabled["access_token"])).status_code == 401
    assert client.get("/auth/me", headers=_headers(result["mfa_ticket"])).status_code == 401
    assert (
        client.post(
            "/auth/reset-password", json={"token": token, "new_password": "Replacement12345!"}
        ).status_code
        == 401
    )
    payload = {"ticket": result["mfa_ticket"]}
    payload["totp_code" if method == "totp" else "recovery_code"] = (
        totp_code(secret) if method == "totp" else enabled["codes"][0]
    )
    completed = client.post("/auth/login/complete", json=payload)
    assert completed.status_code == 200
    assert (
        client.get("/auth/me", headers=_headers(completed.json()["access_token"])).status_code
        == 200
    )
    assert client.post("/auth/login/complete", json=payload).status_code == 401


def test_setup_and_login_codes_cannot_be_replayed_in_security_settings(
    client, registered_user, totp_code
):
    secret, setup_code, enabled = _enable(client, registered_user, totp_code)
    ticket = _ticket(client, registered_user)
    assert (
        client.post(
            "/auth/login/complete", json={"ticket": ticket, "totp_code": setup_code}
        ).status_code
        == 401
    )
    code = totp_code(secret)
    logged_in = client.post("/auth/login/complete", json={"ticket": ticket, "totp_code": code})
    assert logged_in.status_code == 200
    headers = _headers(logged_in.json()["access_token"])
    payload = {"current_password": registered_user["password"], "totp_code": code}
    assert (
        client.post("/auth/recovery-codes/regenerate", headers=headers, json=payload).status_code
        == 401
    )
    assert (
        client.post("/auth/passkeys/register/options", headers=headers, json=payload).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/totp/disable",
            headers=headers,
            json={"current_password": registered_user["password"], "code": code},
        ).status_code
        == 401
    )
    # The setup endpoint cannot double as recovery-code regeneration without a password.
    assert (
        client.post(
            "/auth/totp/verify",
            headers=_headers(enabled["access_token"]),
            json={"code": totp_code(secret)},
        ).status_code
        == 409
    )
    payload["totp_code"] = totp_code(secret)
    assert (
        client.post("/auth/recovery-codes/regenerate", headers=headers, json=payload).status_code
        == 200
    )


def test_concurrent_totp_logins_have_one_winner(client, registered_user, totp_code):
    secret, _, _ = _enable(client, registered_user, totp_code)
    tickets = [_ticket(client, registered_user), _ticket(client, registered_user)]
    code = totp_code(secret)
    gate = Barrier(2)

    def attempt(ticket):
        gate.wait(timeout=5)
        return client.post("/auth/login/complete", json={"ticket": ticket, "totp_code": code})

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(attempt, tickets))
    assert sorted(response.status_code for response in responses) == [200, 401]


def test_existing_account_without_counter_can_consume_code_once(client, registered_user, totp_code):
    secret, _, _ = _enable(client, registered_user, totp_code)
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].users.update_one({}, {"$unset": {"totp_last_counter": ""}})
    code = totp_code(secret)
    for expected in (200, 401):
        result = client.post(
            "/auth/login/complete",
            json={"ticket": _ticket(client, registered_user), "totp_code": code},
        )
        assert result.status_code == expected
