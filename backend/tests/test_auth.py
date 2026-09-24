import time

import pytest

from app.core.security import _totp


def _registration(**overrides) -> dict:
    return {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "new@example.com",
        "password": "Secret12345",
        **overrides,
    }


def test_register_returns_token_when_verification_is_off(client):
    # `no_outbound_email` leaves SMTP unconfigured, which is the documented fall-back:
    # sign-up completes in one step rather than becoming impossible. The two-step path
    # lives in test_email_verification.py.
    response = client.post("/auth/register", json=_registration())
    assert response.status_code == 201
    body = response.json()
    assert body["verification_required"] is False
    assert body["access_token"]


def test_register_rejects_duplicate_email(client, registered_user):
    response = client.post(
        "/auth/register",
        json=_registration(email=registered_user["email"], password="Another12345"),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_register_rejects_short_password(client):
    response = client.post("/auth/register", json=_registration(password="Ab1"))
    assert response.status_code == 422


@pytest.mark.parametrize(
    "password",
    [
        "secret12345",  # no uppercase
        "SECRET12345",  # no lowercase
        "SecretPassword",  # no digit
    ],
)
def test_register_enforces_the_rules_the_form_advertises(client, password):
    """The sign-up form ticks these off as the user types; if only the form checked
    them they would be decoration, and the API would still take a weaker password."""
    response = client.post("/auth/register", json=_registration(password=password))
    assert response.status_code == 422


def test_register_rejects_invalid_email(client):
    response = client.post("/auth/register", json=_registration(email="not-an-email"))
    assert response.status_code == 422


def test_register_requires_a_first_name(client):
    response = client.post("/auth/register", json=_registration(first_name="   "))
    assert response.status_code == 422


def test_register_accepts_a_single_name(client):
    """A required surname would lock out anyone who has only one name."""
    response = client.post("/auth/register", json=_registration(last_name=""))
    assert response.status_code == 201


def test_registered_name_comes_back_from_me(client):
    token = client.post("/auth/register", json=_registration()).json()["access_token"]
    body = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert body["first_name"] == "Ada"
    assert body["last_name"] == "Lovelace"


def test_login_succeeds(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_normal_user_can_enable_totp_and_login_in_two_steps(client, registered_user):
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": registered_user["password"]},
        headers=registered_user["headers"],
    )
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    code = _totp(secret, int(time.time()) // 30)

    verify = client.post(
        "/auth/totp/verify",
        json={"code": code},
        headers=registered_user["headers"],
    )
    assert verify.status_code == 204

    password_only = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert password_only.status_code == 200
    assert password_only.json()["mfa_required"] is True
    assert password_only.json()["access_token"] is None
    assert password_only.json()["mfa_methods"] == ["totp"]
    ticket = password_only.json()["mfa_ticket"]
    assert ticket

    completed = client.post(
        "/auth/login/complete",
        json={"ticket": ticket, "totp_code": _totp(secret, int(time.time()) // 30)},
    )
    assert completed.status_code == 200
    assert completed.json()["access_token"]
    assert (
        client.post("/auth/login/complete", json={"ticket": ticket, "totp_code": code}).status_code
        == 401
    )

    old_one_step_payload = client.post(
        "/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
            "totp_code": _totp(secret, int(time.time()) // 30),
        },
    )
    assert old_one_step_payload.status_code == 200
    assert old_one_step_payload.json()["mfa_required"] is True
    assert old_one_step_payload.json()["access_token"] is None


def test_password_mfa_ticket_allows_five_code_attempts(client, registered_user):
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": registered_user["password"]},
        headers=registered_user["headers"],
    )
    secret = setup.json()["secret"]
    code = _totp(secret, int(time.time()) // 30)
    assert (
        client.post(
            "/auth/totp/verify", json={"code": code}, headers=registered_user["headers"]
        ).status_code
        == 204
    )
    ticket = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["mfa_ticket"]
    for _ in range(5):
        assert (
            client.post(
                "/auth/login/complete", json={"ticket": ticket, "totp_code": "000000"}
            ).status_code
            == 401
        )
    blocked = client.post("/auth/login/complete", json={"ticket": ticket, "totp_code": code})
    assert blocked.status_code == 429


def test_normal_user_totp_setup_requires_current_password(client, registered_user):
    response = client.post(
        "/auth/totp/setup",
        json={"current_password": "WrongPassword123"},
        headers=registered_user["headers"],
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_login_rejects_wrong_password(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_login_unknown_email_matches_wrong_password_message(client, registered_user):
    """Both failures must read identically or the endpoint enumerates accounts."""
    unknown = client.post(
        "/auth/login", json={"email": "ghost@example.com", "password": "Secret12345"}
    )
    wrong = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "wrongpassword"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


def test_me_returns_current_user(client, registered_user):
    response = client.get("/auth/me", headers=registered_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == registered_user["email"]
    assert isinstance(body["id"], str)  # never a raw ObjectId


def test_me_requires_a_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_rejects_a_malformed_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401


def test_me_rejects_a_token_signed_with_another_secret(client, registered_user):
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    forged = jwt.encode(
        {"sub": "someone", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "not-the-real-secret",
        algorithm="HS256",
    )
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_expired_token_is_rejected(client, registered_user):
    from app.core.security import create_access_token

    expired = create_access_token("someone", expires_minutes=-1)
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401


@pytest.mark.parametrize("name", ["Tanmay1", "Tanmay!", "R2D2", "Ada <script>"])
def test_register_rejects_names_with_digits_or_symbols(client, name):
    response = client.post("/auth/register", json=_registration(first_name=name))
    assert response.status_code == 422


@pytest.mark.parametrize("name", ["Anne-Marie", "O'Brien", "José", "Tanmay Patel"])
def test_register_accepts_real_names(client, name):
    # Hyphens, apostrophes and accents all appear in real names; rejecting them would
    # lock people out of an account over punctuation.
    response = client.post(
        "/auth/register", json=_registration(first_name=name, email=f"{abs(hash(name))}@x.com")
    )
    assert response.status_code == 201


def test_register_still_allows_an_empty_last_name(client):
    # Plenty of people have one name — the character rule must not make the optional
    # field effectively required.
    response = client.post("/auth/register", json=_registration(last_name=""))
    assert response.status_code == 201
