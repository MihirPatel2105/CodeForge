"""Forgot password, end to end: request a link, use it once, and everything that must
not be true along the way — no enumeration, no replay, no reuse past expiry.
"""

from datetime import UTC, datetime, timedelta

import pytest
from pymongo import MongoClient

from app.config import settings


@pytest.fixture
def db():
    with MongoClient(settings.mongo_uri) as mongo:
        yield mongo[settings.mongo_db]


@pytest.fixture
def reset_outbox(monkeypatch):
    """Capture the reset-link email instead of mailing it."""
    sent: list[dict] = []

    async def fake_send(*, to: str, reset_url: str, first_name: str = "") -> None:
        sent.append({"to": to, "reset_url": reset_url, "first_name": first_name})

    monkeypatch.setattr("app.api.auth.send_password_reset_email", fake_send)
    return sent


@pytest.fixture
def changed_outbox(monkeypatch):
    """Capture the password-changed notice the reset also sends."""
    sent: list[dict] = []

    async def fake_send(*, to: str, first_name: str = "") -> None:
        sent.append({"to": to, "first_name": first_name})

    monkeypatch.setattr("app.api.auth.send_password_changed_email", fake_send)
    return sent


def _token_from(reset_outbox) -> str:
    url = reset_outbox[0]["reset_url"]
    return url.rsplit("/", 1)[-1]


def test_requesting_a_reset_emails_a_link(client, registered_user, reset_outbox):
    response = client.post("/auth/forgot-password", json={"email": registered_user["email"]})

    assert response.status_code == 200
    assert len(reset_outbox) == 1
    assert reset_outbox[0]["to"] == registered_user["email"]
    assert "/reset-password/" in reset_outbox[0]["reset_url"]


def test_an_unknown_email_gets_the_identical_response_and_sends_nothing(
    client, registered_user, reset_outbox
):
    known = client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    # Only the real account actually got a link.
    assert len(reset_outbox) == 1


def test_the_link_signs_the_user_in_with_the_new_password(
    client, registered_user, reset_outbox, changed_outbox
):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = _token_from(reset_outbox)

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Brandnew12345"}
    )
    assert response.status_code == 200
    fresh = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/me", headers=fresh).status_code == 200

    login = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "Brandnew12345"}
    )
    assert login.status_code == 200
    assert changed_outbox == [{"to": registered_user["email"], "first_name": "Tess"}]


def test_the_link_cannot_be_used_twice(client, registered_user, reset_outbox):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = _token_from(reset_outbox)

    first = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Brandnew12345"}
    )
    assert first.status_code == 200

    replay = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "SomethingElse12345"}
    )
    assert replay.status_code == 401
    # And the first password is the one that actually stuck.
    login = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "Brandnew12345"}
    )
    assert login.status_code == 200


def test_a_made_up_token_is_refused(client):
    response = client.post(
        "/auth/reset-password", json={"token": "not-a-real-token", "new_password": "Brandnew12345"}
    )
    assert response.status_code == 401


def test_using_the_link_ends_other_sessions(client, registered_user, reset_outbox):
    """The scenario this exists for: an account has been compromised. The reset has to
    kill whatever session the attacker is holding, not just log the owner in fresh."""
    other = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other}"}

    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = _token_from(reset_outbox)
    client.post("/auth/reset-password", json={"token": token, "new_password": "Brandnew12345"})

    assert client.get("/auth/me", headers=other_headers).status_code == 401


def test_an_expired_link_is_refused(client, registered_user, reset_outbox, db):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = _token_from(reset_outbox)
    db.password_reset_tokens.update_one(
        {}, {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}}
    )

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Brandnew12345"}
    )
    assert response.status_code == 401
    # The original password is untouched.
    login = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "Secret12345"}
    )
    assert login.status_code == 200


def test_requesting_again_replaces_the_previous_link(
    client, registered_user, reset_outbox, monkeypatch
):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    first_token = _token_from(reset_outbox)

    monkeypatch.setattr(settings, "reset_resend_cooldown_seconds", 0)
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    second_token = _token_from(reset_outbox[-1:])

    assert first_token != second_token
    stale = client.post(
        "/auth/reset-password", json={"token": first_token, "new_password": "Brandnew12345"}
    )
    assert stale.status_code == 401
    fresh = client.post(
        "/auth/reset-password", json={"token": second_token, "new_password": "Brandnew12345"}
    )
    assert fresh.status_code == 200


def test_a_second_request_within_the_cooldown_sends_nothing(client, registered_user, reset_outbox):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    response = client.post("/auth/forgot-password", json={"email": registered_user["email"]})

    assert response.status_code == 200  # still the same generic response
    assert len(reset_outbox) == 1  # but only one email actually went out


def test_new_password_must_meet_the_same_rules(client, registered_user, reset_outbox):
    client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    token = _token_from(reset_outbox)

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "alllowercase1"}
    )
    assert response.status_code == 422


def test_no_notice_when_the_reset_link_itself_could_not_be_emailed(
    client, registered_user, monkeypatch
):
    """A dead mail server must not surface as an API error on the request step — the
    caller gets the same generic response either way, by design."""

    async def explode(**_kwargs) -> None:
        raise RuntimeError("SMTP is down")

    monkeypatch.setattr("app.api.auth.send_password_reset_email", explode)

    response = client.post("/auth/forgot-password", json={"email": registered_user["email"]})
    assert response.status_code == 200
