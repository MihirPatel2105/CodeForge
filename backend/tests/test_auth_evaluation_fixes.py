"""Regression tests for the defects found in the 2026-11-20 authentication evaluation.

Each test names the live failure it reproduces. They run against the real test Mongo;
only mail delivery is captured (see the `outbox` fixture in conftest).
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest

from app.config import Settings, settings
from app.models import PendingSignup, User

VICTIM_PASSWORD = "Victim12345"
ATTACKER_PASSWORD = "Attacker12345"


def _register(client, email: str, password: str = VICTIM_PASSWORD, first_name: str = "Ada"):
    return client.post(
        "/auth/register",
        json={"first_name": first_name, "email": email, "password": password},
    )


def _expire_cooldown(db, email: str) -> None:
    """Move the last send far enough back that a second registration is allowed."""
    db.pending_signups.update_one(
        {"email": email},
        {"$set": {"last_sent_at": datetime.now(UTC) - timedelta(hours=1)}},
    )


# --- Sign-up takeover -------------------------------------------------------------


def test_register_returns_a_signup_ticket(client, outbox):
    response = _register(client, "ticket@example.com")
    assert response.status_code == 201
    ticket = response.json().get("signup_ticket")
    assert isinstance(ticket, str) and len(ticket) >= 32


def test_verify_requires_the_signup_ticket(client, outbox):
    _register(client, "noticket@example.com")
    response = client.post(
        "/auth/verify-email", json={"email": "noticket@example.com", "code": outbox[-1]["code"]}
    )
    assert response.status_code == 422


def test_reregistering_a_pending_email_cannot_take_over_the_account(client, outbox, db):
    """Live finding: an attacker re-registered a pending address after the cooldown,
    the owner typed the newest code, and the attacker's password owned the account."""
    victim_ticket = _register(client, "owner@example.com").json()["signup_ticket"]
    _expire_cooldown(db, "owner@example.com")
    attacker = _register(client, "owner@example.com", ATTACKER_PASSWORD, "Attacker")
    assert attacker.status_code == 201

    # The owner never saw the attacker's ticket; they type the newest code they received.
    response = client.post(
        "/auth/verify-email",
        json={
            "email": "owner@example.com",
            "code": outbox[-1]["code"],
            "signup_ticket": victim_ticket,
        },
    )

    assert response.status_code != 200
    assert db.users.count_documents({"email": "owner@example.com"}) == 0


def test_an_attacker_cannot_preregister_an_email_for_its_owner_to_confirm(client, outbox, db):
    _register(client, "early@example.com", ATTACKER_PASSWORD, "Attacker")
    _expire_cooldown(db, "early@example.com")
    owner_ticket = _register(client, "early@example.com").json()["signup_ticket"]

    response = client.post(
        "/auth/verify-email",
        json={
            "email": "early@example.com",
            "code": outbox[-1]["code"],
            "signup_ticket": owner_ticket,
        },
    )

    assert response.status_code == 200
    owner = client.post(
        "/auth/login", json={"email": "early@example.com", "password": VICTIM_PASSWORD}
    )
    attacker = client.post(
        "/auth/login", json={"email": "early@example.com", "password": ATTACKER_PASSWORD}
    )
    assert owner.status_code == 200
    assert attacker.status_code == 401


# --- Email case -------------------------------------------------------------------


def test_email_is_stored_lowercase(client):
    response = _register(client, "  Mixed.Case@Example.com ")
    assert response.status_code == 201
    me = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me.json()["email"] == "mixed.case@example.com"


def test_login_ignores_email_case(client):
    _register(client, "Mixed.Case@Example.com")
    response = client.post(
        "/auth/login", json={"email": "mixed.case@example.com", "password": VICTIM_PASSWORD}
    )
    assert response.status_code == 200


def test_register_rejects_the_same_email_in_another_case(client):
    _register(client, "dup@example.com")
    assert _register(client, "DUP@Example.com").status_code == 409


def test_pending_signup_matches_any_email_case(client, outbox):
    ticket = _register(client, "Pending.Case@Example.com").json()["signup_ticket"]
    response = client.post(
        "/auth/verify-email",
        json={
            "email": "PENDING.case@example.com",
            "code": outbox[-1]["code"],
            "signup_ticket": ticket,
        },
    )
    assert response.status_code == 200


def test_forgot_password_finds_an_account_in_another_case(client, monkeypatch):
    sent: list[str] = []

    async def fake_send(*, to: str, reset_url: str, first_name: str = "") -> None:
        sent.append(to)

    monkeypatch.setattr("app.api.auth.send_password_reset_email", fake_send)
    _register(client, "reset.me@example.com")
    client.post("/auth/forgot-password", json={"email": "RESET.Me@Example.com"})
    assert sent == ["reset.me@example.com"]


# --- 204 responses ----------------------------------------------------------------


def _assert_empty_204(response) -> None:
    assert response.status_code == 204
    assert response.content == b""
    # The Next proxy reads any JSON-labelled /auth/ response as JSON; an empty body
    # labelled application/json made every sign-out look like a 502.
    assert "application/json" not in response.headers.get("content-type", "")


def test_sign_out_is_an_empty_204(client, registered_user):
    _assert_empty_204(client.post("/auth/sign-out", headers=registered_user["headers"]))


def test_sign_out_everywhere_is_an_empty_204(client, registered_user):
    _assert_empty_204(client.post("/auth/sign-out-everywhere", headers=registered_user["headers"]))


def test_device_sign_out_is_an_empty_204(client, registered_user):
    devices = client.get("/auth/devices", headers=registered_user["headers"]).json()
    response = client.post(
        f"/auth/devices/{devices[0]['id']}/sign-out", headers=registered_user["headers"]
    )
    _assert_empty_204(response)


# --- OTP races --------------------------------------------------------------------


def test_concurrent_wrong_codes_cannot_exceed_the_attempt_cap(client, outbox):
    """Live finding: 40 parallel wrong guesses had 25 evaluated against a cap of 5."""
    ticket = _register(client, "race@example.com").json()["signup_ticket"]
    right = outbox[-1]["code"]
    wrong = [
        f"{(int(right) + i) % 10**settings.otp_length:0{settings.otp_length}d}"
        for i in range(1, 31)
    ]

    def guess(code: str) -> int:
        return client.post(
            "/auth/verify-email",
            json={"email": "race@example.com", "code": code, "signup_ticket": ticket},
        ).status_code

    with ThreadPoolExecutor(max_workers=15) as pool:
        statuses = list(pool.map(guess, wrong))

    evaluated = statuses.count(401)
    assert evaluated <= settings.otp_max_attempts, statuses


def test_concurrent_correct_codes_create_one_account_and_no_500(client, outbox, db):
    """Live finding: four simultaneous correct verifies returned 200, 409, 409, 500."""
    ticket = _register(client, "double@example.com").json()["signup_ticket"]
    body = {"email": "double@example.com", "code": outbox[-1]["code"], "signup_ticket": ticket}

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = list(
            pool.map(lambda _: client.post("/auth/verify-email", json=body).status_code, range(6))
        )

    assert 500 not in statuses, statuses
    assert statuses.count(200) == 1, statuses
    assert db.users.count_documents({"email": "double@example.com"}) == 1


# --- Second factor on destructive changes -----------------------------------------


@pytest.fixture
def two_factor_user(client, registered_user, totp_code):
    headers = registered_user["headers"]
    secret = client.post(
        "/auth/totp/setup", headers=headers, json={"current_password": registered_user["password"]}
    ).json()["secret"]
    enabled = client.post("/auth/totp/verify", headers=headers, json={"code": totp_code(secret)})
    assert enabled.status_code == 200
    return {
        **registered_user,
        "secret": secret,
        "headers": {"Authorization": f"Bearer {enabled.json()['access_token']}"},
    }


def test_change_password_needs_the_authenticator_when_2fa_is_on(client, two_factor_user, totp_code):
    body = {"current_password": two_factor_user["password"], "new_password": "Changed12345"}
    refused = client.post("/auth/change-password", headers=two_factor_user["headers"], json=body)
    assert refused.status_code == 401

    accepted = client.post(
        "/auth/change-password",
        headers=two_factor_user["headers"],
        json={**body, "totp_code": totp_code(two_factor_user["secret"])},
    )
    assert accepted.status_code == 200


def test_delete_account_needs_the_authenticator_when_2fa_is_on(client, two_factor_user, totp_code):
    body = {"password": two_factor_user["password"], "confirmation": "DELETE"}
    refused = client.post("/auth/delete-account", headers=two_factor_user["headers"], json=body)
    assert refused.status_code == 401

    accepted = client.post(
        "/auth/delete-account",
        headers=two_factor_user["headers"],
        json={**body, "totp_code": totp_code(two_factor_user["secret"])},
    )
    assert accepted.status_code == 200


# --- Account enumeration by timing -----------------------------------------------


def test_unknown_email_login_still_runs_a_password_check(client, monkeypatch):
    """Live finding: wrong password for a known email took ~19 ms, unknown ~2 ms."""
    from app.api import auth as auth_module

    calls: list[str] = []
    real = auth_module.verify_password

    def spy(password: str, hashed: str) -> bool:
        calls.append(hashed)
        return real(password, hashed)

    monkeypatch.setattr(auth_module, "verify_password", spy)
    response = client.post(
        "/auth/login", json={"email": "ghost@example.com", "password": "Nope12345"}
    )
    assert response.status_code == 401
    assert len(calls) == 1


# --- Timestamps -------------------------------------------------------------------


def test_new_documents_carry_aware_utc_timestamps():
    """Live finding: 'Member since' read 5.5 h ahead when the backend ran in IST."""
    user = User(email="t@example.com", hashed_password="x")
    pending = PendingSignup(
        email="t@example.com", hashed_password="x", code_hash="", expires_at=datetime.now(UTC)
    )
    for value in (user.created_at, pending.created_at, pending.last_sent_at):
        assert value.tzinfo is not None and value.utcoffset() == timedelta(0)


# --- Default secret ---------------------------------------------------------------


@pytest.fixture
def default_settings_env(monkeypatch):
    """Settings built from code defaults alone, not from this machine's environment."""
    for name in ("JWT_SECRET", "CODEFORGE_ENV", "APP_BASE_URL"):
        monkeypatch.delenv(name, raising=False)


def test_default_jwt_secret_is_refused_off_localhost(default_settings_env):
    exposed = Settings(app_base_url="https://codeforge.example.org", _env_file=None)
    assert exposed.jwt_secret == "dev-secret-change-me"
    assert any("JWT_SECRET" in error for error in exposed.startup_security_errors())


def test_default_jwt_secret_is_allowed_for_local_development(default_settings_env):
    local = Settings(app_base_url="http://localhost:3000", _env_file=None)
    assert local.startup_security_errors() == []


# --- Review follow-ups ------------------------------------------------------------


def test_resend_requires_the_signup_ticket(client, outbox, db):
    """Without the ticket, anyone could rotate someone's code every cooldown."""
    ticket = _register(client, "resend@example.com").json()["signup_ticket"]
    _expire_cooldown(db, "resend@example.com")

    stranger = client.post(
        "/auth/resend-code", json={"email": "resend@example.com", "signup_ticket": "x" * 43}
    )
    assert stranger.status_code == 404
    assert len(outbox) == 1

    owner = client.post(
        "/auth/resend-code", json={"email": "resend@example.com", "signup_ticket": ticket}
    )
    assert owner.status_code == 200
    assert len(outbox) == 2


def test_resend_does_not_restore_spent_attempts(client, outbox, db):
    ticket = _register(client, "spent@example.com").json()["signup_ticket"]
    wrong = (
        "0" * settings.otp_length if outbox[-1]["code"] != "0" * settings.otp_length else "1" * 6
    )
    for _ in range(settings.otp_max_attempts - 1):
        client.post(
            "/auth/verify-email",
            json={"email": "spent@example.com", "code": wrong, "signup_ticket": ticket},
        )
    _expire_cooldown(db, "spent@example.com")
    client.post("/auth/resend-code", json={"email": "spent@example.com", "signup_ticket": ticket})

    row = db.pending_signups.find_one({"email": "spent@example.com"})
    assert row["attempts"] == settings.otp_max_attempts - 1


def test_same_password_change_does_not_spend_the_authenticator_code(
    client, two_factor_user, totp_code
):
    code = totp_code(two_factor_user["secret"])
    same = client.post(
        "/auth/change-password",
        headers=two_factor_user["headers"],
        json={
            "current_password": two_factor_user["password"],
            "new_password": two_factor_user["password"],
            "totp_code": code,
        },
    )
    assert same.status_code == 409

    # The same code still works for the real change: it was not consumed by the no-op.
    real = client.post(
        "/auth/change-password",
        headers=two_factor_user["headers"],
        json={
            "current_password": two_factor_user["password"],
            "new_password": "Changed12345",
            "totp_code": code,
        },
    )
    assert real.status_code == 200


@pytest.mark.parametrize(
    "secret", ["change-me", "short-but-unique", "dev-anything-goes-here-0123456789"]
)
def test_weak_jwt_secrets_are_refused_off_localhost(default_settings_env, secret):
    exposed = Settings(
        app_base_url="https://codeforge.example.org", jwt_secret=secret, _env_file=None
    )
    assert any("JWT_SECRET" in error for error in exposed.startup_security_errors())


def test_example_env_secret_still_runs_locally(default_settings_env):
    local = Settings(app_base_url="http://localhost:3000", jwt_secret="change-me", _env_file=None)
    assert local.startup_security_errors() == []
