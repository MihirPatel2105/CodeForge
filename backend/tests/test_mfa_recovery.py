"""Recovery is admin-gated, email-scoped and never grants a login session."""

from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from app.core.security import _totp, decode_access_token


@pytest.fixture
def database():
    with MongoClient(settings.mongo_uri) as connection:
        yield connection[settings.mongo_db]


@pytest.fixture
def recovery_case(client, registered_user, strong_auth_user, totp_code, monkeypatch, database):
    # strong_auth_user is the operator; use a different account as the recovery target.
    operator = strong_auth_user
    monkeypatch.setattr(settings, "admin_email", operator["email"])
    user = client.post(
        "/auth/register",
        json={"email": "recover@example.com", "password": "Secret12345", "first_name": "Recovery"},
    ).json()
    token = user["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    user_id = decode_access_token(token)["sub"]
    database.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"email_verified": True}})
    secret = client.post(
        "/auth/totp/setup", headers=headers, json={"current_password": "Secret12345"}
    ).json()["secret"]
    enabled = client.post("/auth/totp/verify", headers=headers, json={"code": totp_code(secret)})
    assert enabled.status_code == 200
    emails = []

    async def capture(**kwargs):
        emails.append(kwargs)

    monkeypatch.setattr("app.api.mfa_recovery.send_email", capture)
    monkeypatch.setattr("app.api.mfa_recovery.send_security_alert_email", capture)
    return {
        "operator": operator,
        "id": user_id,
        "codes": enabled.json()["codes"],
        "old_secret": secret,
        "headers": {"Authorization": f"Bearer {enabled.json()['access_token']}"},
        "emails": emails,
    }


def approve(client, case):
    requested = client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"})
    assert requested.status_code == 200
    entries = client.get("/admin/mfa-recovery", headers=case["operator"]["headers"])
    assert entries.status_code == 200
    request_id = entries.json()["items"][0]["id"]
    result = client.post(
        f"/admin/mfa-recovery/{request_id}/review",
        headers=case["operator"]["headers"],
        json={
            "approve": True,
            "current_password": case["operator"]["password"],
            "reason": "Review recovery request",
        },
    )
    assert result.status_code == 200, result.text
    mail = next(item for item in case["emails"] if "subject" in item)
    assert mail["to"] == "recover@example.com"
    return mail["text"].split("/recover-2fa/")[1].split()[0], request_id


def verify(client, case, token, **changes):
    return client.post(
        "/auth/mfa-recovery/verify",
        json={
            "token": token,
            "password": "Secret12345",
            "recovery_code": case["codes"][0],
            **changes,
        },
    )


def test_complete_recovery_revokes_sessions_links_and_old_codes(
    client, recovery_case, database, monkeypatch
):
    case = recovery_case
    token, request_id = approve(client, case)
    assert token not in str(database.mfa_recoveries.find_one({"user_id": case["id"]}))
    verified = verify(client, case, token)
    assert verified.status_code == 200, verified.text
    assert verified.headers["cache-control"] == "no-store"
    setup = verified.json()
    assert "access_token" not in setup
    assert (
        client.get(
            "/auth/me", headers={"Authorization": f"Bearer {setup['setup_token']}"}
        ).status_code
        == 401
    )
    assert verify(client, case, token).status_code == 401
    code = _totp(setup["secret"], int(datetime.now(UTC).timestamp()) // 30)
    done = client.post(
        "/auth/mfa-recovery/complete", json={"setup_token": setup["setup_token"], "code": code}
    )
    assert done.status_code == 200, done.text
    assert done.headers["cache-control"] == "no-store"
    assert len(done.json()["codes"]) == 8
    assert set(done.json()["codes"]).isdisjoint(case["codes"])
    assert "access_token" not in done.json()
    assert client.get("/auth/me", headers=case["headers"]).status_code == 401
    assert (
        client.post(
            "/auth/mfa-recovery/complete", json={"setup_token": setup["setup_token"], "code": code}
        ).status_code
        == 401
    )
    stored = database.mfa_recoveries.find_one({"_id": ObjectId(request_id)})
    assert stored["status"] == "completed" and stored["token_hash"] is None
    assert database.admin_audit_logs.count_documents({"action": "mfa_recovery.approved"}) == 1
    assert any(item.get("title") == "Authenticator replaced" for item in case["emails"])
    from types import SimpleNamespace

    # The setup time step was consumed; use the next real step for login.
    timestamp = int(datetime.now(UTC).timestamp()) + 30
    monkeypatch.setattr("app.core.security.time", SimpleNamespace(time=lambda: timestamp))
    ticket = client.post(
        "/auth/login", json={"email": "recover@example.com", "password": "Secret12345"}
    ).json()["mfa_ticket"]
    assert (
        client.post(
            "/auth/login/complete",
            json={"ticket": ticket, "totp_code": _totp(case["old_secret"], timestamp // 30)},
        ).status_code
        == 401
    )
    login = client.post(
        "/auth/login/complete",
        json={"ticket": ticket, "totp_code": _totp(setup["secret"], timestamp // 30)},
    )
    assert login.status_code == 200
    assert (
        client.get(
            "/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
        ).status_code
        == 200
    )


def test_request_is_neutral_deduplicated_and_admin_protected(client, recovery_case, database):
    expected = client.post(
        "/auth/mfa-recovery/request", json={"email": "unknown@example.com"}
    ).json()
    for _ in range(2):
        assert (
            client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"}).json()
            == expected
        )
    assert database.mfa_recoveries.count_documents({}) == 1
    assert client.get("/admin/mfa-recovery").status_code == 401
    assert client.get("/admin/mfa-recovery", headers=recovery_case["headers"]).status_code == 403


@pytest.mark.parametrize("failure", ["expired", "version", "suspended", "code", "password"])
def test_bad_recovery_proof_cannot_change_authenticator(client, recovery_case, database, failure):
    case = recovery_case
    token, _ = approve(client, case)
    before = database.users.find_one({"_id": ObjectId(case["id"])})["totp_secret_encrypted"]
    changes = {}
    if failure == "expired":
        database.mfa_recoveries.update_one(
            {"user_id": case["id"]},
            {"$set": {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}},
        )
    elif failure == "version":
        database.users.update_one({"_id": ObjectId(case["id"])}, {"$inc": {"token_version": 1}})
    elif failure == "suspended":
        database.users.update_one({"_id": ObjectId(case["id"])}, {"$set": {"is_suspended": True}})
    else:
        changes["password" if failure == "password" else "recovery_code"] = "incorrect"
    assert verify(client, case, token, **changes).status_code == 401
    assert database.users.find_one({"_id": ObjectId(case["id"])})["totp_secret_encrypted"] == before
    assert database.recovery_codes.count_documents({"user_id": case["id"]}) == 8


def test_link_attempt_limit_and_direct_recovery_bypasses(client, recovery_case, database):
    case = recovery_case
    token, _ = approve(client, case)
    for _ in range(5):
        assert verify(client, case, token, recovery_code="incorrect").status_code == 401
    assert verify(client, case, token).status_code == 401
    login = client.post(
        "/auth/login", json={"email": "recover@example.com", "password": "Secret12345"}
    )
    # Lockout may have been reached; bypass checks use an independent existing session.
    database.users.update_one(
        {"_id": ObjectId(case["id"])}, {"$set": {"locked_until": None, "failed_login_attempts": 0}}
    )
    login = client.post(
        "/auth/login", json={"email": "recover@example.com", "password": "Secret12345"}
    ).json()
    assert "recovery_code" not in login["mfa_methods"]
    assert (
        client.post(
            "/auth/login/complete",
            json={"ticket": login["mfa_ticket"], "recovery_code": case["codes"][1]},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/totp/disable",
            headers=case["headers"],
            json={"current_password": "Secret12345", "recovery_code": case["codes"][1]},
        ).status_code
        == 401
    )


def test_repeated_request_preserves_approved_link(client, recovery_case, database):
    token, _ = approve(client, recovery_case)
    before = database.mfa_recoveries.find_one({"user_id": recovery_case["id"]})
    client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"})
    after = database.mfa_recoveries.find_one({"user_id": recovery_case["id"]})
    assert before["token_hash"] == after["token_hash"]
    assert verify(client, recovery_case, token).status_code == 200


def test_admin_password_rejection_and_own_recovery_are_guarded(client, recovery_case, database):
    case = recovery_case
    client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"})
    entry = database.mfa_recoveries.find_one({"user_id": case["id"]})
    path = f"/admin/mfa-recovery/{entry['_id']}/review"
    body = {"approve": True, "current_password": "incorrect", "reason": "Review request"}
    assert client.post(path, headers=case["operator"]["headers"], json=body).status_code == 401
    assert not any("subject" in item for item in case["emails"])
    body.update(approve=False, current_password=case["operator"]["password"])
    assert client.post(path, headers=case["operator"]["headers"], json=body).status_code == 200
    assert database.mfa_recoveries.find_one({"_id": entry["_id"]})["status"] == "rejected"
    assert not any("subject" in item for item in case["emails"])
    client.post("/auth/mfa-recovery/request", json={"email": case["operator"]["email"]})
    own_id = decode_access_token(case["operator"]["token"])["sub"]
    own = database.mfa_recoveries.find_one({"user_id": own_id})
    body["approve"] = True
    assert (
        client.post(
            f"/admin/mfa-recovery/{own['_id']}/review",
            headers=case["operator"]["headers"],
            json=body,
        ).status_code
        == 409
    )


def test_failed_email_delivery_invalidates_link_and_keeps_request_reviewable(
    client, recovery_case, monkeypatch, database
):
    from app.core.email import EmailDeliveryError

    async def fail(**kwargs):
        raise EmailDeliveryError("Unavailable")

    monkeypatch.setattr("app.api.mfa_recovery.send_email", fail)
    case = recovery_case
    client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"})
    entry = database.mfa_recoveries.find_one({"user_id": case["id"]})
    result = client.post(
        f"/admin/mfa-recovery/{entry['_id']}/review",
        headers=case["operator"]["headers"],
        json={
            "approve": True,
            "current_password": case["operator"]["password"],
            "reason": "Review request",
        },
    )
    assert result.status_code == 502
    stored = database.mfa_recoveries.find_one({"_id": entry["_id"]})
    assert stored["status"] == "pending" and stored["token_hash"] is None


def test_setup_token_has_attempt_cap_and_never_disables_old_authenticator(
    client, recovery_case, database
):
    case = recovery_case
    token, _ = approve(client, case)
    setup = verify(client, case, token).json()
    original = database.users.find_one({"_id": ObjectId(case["id"])})["totp_secret_encrypted"]
    for _ in range(5):
        assert (
            client.post(
                "/auth/mfa-recovery/complete",
                json={"setup_token": setup["setup_token"], "code": "invalid"},
            ).status_code
            == 422
        )
    # Invalid shapes never reach the verifier. Valid-shaped wrong codes do.
    counter = int(datetime.now(UTC).timestamp()) // 30
    accepted = {_totp(setup["secret"], counter + drift) for drift in (-1, 0, 1)}
    wrong = next(f"{value:06d}" for value in range(10) if f"{value:06d}" not in accepted)
    for _ in range(5):
        assert (
            client.post(
                "/auth/mfa-recovery/complete",
                json={"setup_token": setup["setup_token"], "code": wrong},
            ).status_code
            == 401
        )
    good = _totp(setup["secret"], counter)
    assert (
        client.post(
            "/auth/mfa-recovery/complete", json={"setup_token": setup["setup_token"], "code": good}
        ).status_code
        == 401
    )
    assert (
        database.users.find_one({"_id": ObjectId(case["id"])})["totp_secret_encrypted"] == original
    )


def test_password_reset_version_allows_a_new_request_without_waiting(
    client, recovery_case, database
):
    token, _ = approve(client, recovery_case)
    database.users.update_one(
        {"_id": ObjectId(recovery_case["id"])}, {"$inc": {"token_version": 1}}
    )
    assert verify(client, recovery_case, token).status_code == 401
    assert (
        client.post("/auth/mfa-recovery/request", json={"email": "recover@example.com"}).status_code
        == 200
    )
    stored = database.mfa_recoveries.find_one({"user_id": recovery_case["id"]})
    assert stored["status"] == "pending" and stored["token_hash"] is None
