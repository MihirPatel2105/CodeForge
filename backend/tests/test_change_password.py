"""Changing an account password, and what that does to sessions elsewhere.

The interesting assertions are about the tokens: the browser doing the change keeps
working, and every other one stops. A password change that leaves the old sessions alive
is close to useless when the reason for changing it is that the old one leaked.
"""

import pytest

NEW = "Brandnew12345"


@pytest.fixture
def notices(monkeypatch):
    """Capture the security notice instead of mailing it."""
    sent: list[dict] = []

    async def fake_send(*, to: str, first_name: str = "") -> None:
        sent.append({"to": to, "first_name": first_name})

    monkeypatch.setattr("app.api.auth.send_password_changed_email", fake_send)
    return sent


def _change(client, headers, current="Secret12345", new=NEW):
    return client.post(
        "/auth/change-password",
        json={"current_password": current, "new_password": new},
        headers=headers,
    )


def test_the_new_password_works_and_the_old_one_does_not(client, registered_user):
    assert _change(client, registered_user["headers"]).status_code == 200

    old = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "Secret12345"}
    )
    new = client.post("/auth/login", json={"email": registered_user["email"], "password": NEW})
    assert old.status_code == 401
    assert new.status_code == 200


def test_other_sessions_are_ended(client, registered_user):
    """A second sign-in stands in for the same account open in another browser."""
    other = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other}"}
    assert client.get("/auth/me", headers=other_headers).status_code == 200

    _change(client, registered_user["headers"])

    # Still a perfectly valid signature — it is the generation that is stale.
    assert client.get("/auth/me", headers=other_headers).status_code == 401


def test_the_session_that_changed_it_keeps_working(client, registered_user):
    response = _change(client, registered_user["headers"])
    fresh = {"Authorization": f"Bearer {response.json()['access_token']}"}

    # The returned token is the replacement; the one used to make the change is spent.
    assert client.get("/auth/me", headers=fresh).status_code == 200
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401


def test_a_wrong_current_password_changes_nothing(client, registered_user):
    response = _change(client, registered_user["headers"], current="not-my-password")

    assert response.status_code == 401
    # The original password still signs in, and the original session still works.
    assert (
        client.post(
            "/auth/login", json={"email": registered_user["email"], "password": "Secret12345"}
        ).status_code
        == 200
    )
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 200


@pytest.mark.parametrize("weak", ["short1A", "brandnew12345", "BRANDNEW12345", "BrandNewPassword"])
def test_the_new_password_must_meet_the_same_rules_as_sign_up(client, registered_user, weak):
    assert _change(client, registered_user["headers"], new=weak).status_code == 422


def test_reusing_the_current_password_is_refused(client, registered_user):
    response = _change(client, registered_user["headers"], new="Secret12345")
    assert response.status_code == 409


def test_changing_requires_a_session(client):
    response = client.post(
        "/auth/change-password",
        json={"current_password": "Secret12345", "new_password": NEW},
    )
    assert response.status_code == 401


def test_a_token_without_the_generation_claim_still_works(client, registered_user):
    """Tokens minted before this feature existed carry no `tv`, and must not be
    invalidated by deploying it — that would sign out everyone at once."""
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.config import settings

    user_id = client.get("/auth/me", headers=registered_user["headers"]).json()["id"]
    legacy = jwt.encode(
        {"sub": user_id, "exp": datetime.now(UTC) + timedelta(minutes=5)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code == 200


def test_a_notice_is_emailed_on_a_successful_change(client, registered_user, notices):
    _change(client, registered_user["headers"])

    assert len(notices) == 1
    assert notices[0]["to"] == registered_user["email"]


def test_no_notice_when_the_change_was_refused(client, registered_user, notices):
    """A failed attempt is not something to tell the account about — and mailing on
    every wrong guess would hand an attacker a way to spam the owner's inbox."""
    _change(client, registered_user["headers"], current="not-my-password")
    _change(client, registered_user["headers"], new="weak")

    assert notices == []


def test_the_change_succeeds_even_if_the_notice_cannot_be_sent(
    client, registered_user, monkeypatch
):
    async def explode(**_kwargs) -> None:
        raise RuntimeError("SMTP is down")

    monkeypatch.setattr("app.api.auth.send_password_changed_email", explode)

    assert _change(client, registered_user["headers"]).status_code == 200
    # And the password really did move, rather than being rolled back with the email.
    assert (
        client.post(
            "/auth/login", json={"email": registered_user["email"], "password": NEW}
        ).status_code
        == 200
    )


def test_sign_out_everywhere_kills_every_session(client, registered_user):
    """Including the one that asked. Signing out everywhere and staying signed in here
    would defeat the point — this exists for a token you believe has been copied."""
    other = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other}"}

    response = client.post("/auth/sign-out-everywhere", headers=registered_user["headers"])
    assert response.status_code == 204

    assert client.get("/auth/me", headers=other_headers).status_code == 401
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401


def test_sign_out_everywhere_leaves_the_password_alone(client, registered_user):
    """It ends sessions; it is not a password reset. Signing back in must still work."""
    client.post("/auth/sign-out-everywhere", headers=registered_user["headers"])

    again = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert again.status_code == 200
    assert (
        client.get(
            "/auth/me", headers={"Authorization": f"Bearer {again.json()['access_token']}"}
        ).status_code
        == 200
    )


def test_sign_out_everywhere_requires_a_session(client):
    assert client.post("/auth/sign-out-everywhere").status_code == 401
