"""The two-step sign-up: details in, code out, account only on a correct code.

The mailer is captured rather than called — these tests must not touch a live SMTP
server. What is *not* stubbed is everything that matters: the pending document, the
hashing, the expiry, the attempt cap and the cooldown all run for real against Mongo.
"""

from datetime import UTC, datetime, timedelta

from app.config import settings


def _registration(**overrides) -> dict:
    return {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "new@example.com",
        "password": "Secret12345",
        **overrides,
    }


def test_register_sends_a_code_and_creates_no_account(client, outbox):
    response = client.post("/auth/register", json=_registration())

    assert response.status_code == 201
    body = response.json()
    assert body["verification_required"] is True
    # No session is handed out before the address is proven.
    assert body["access_token"] is None
    assert len(outbox) == 1
    assert outbox[0]["to"] == "new@example.com"
    assert outbox[0]["code"].isdigit()
    assert len(outbox[0]["code"]) == settings.otp_length


def test_no_user_document_exists_until_verified(client, outbox, db):
    client.post("/auth/register", json=_registration())

    assert db.users.find_one({"email": "new@example.com"}) is None
    assert db.pending_signups.find_one({"email": "new@example.com"}) is not None


def test_the_code_is_not_stored_in_readable_form(client, outbox, db):
    client.post("/auth/register", json=_registration())

    pending = db.pending_signups.find_one({"email": "new@example.com"})
    assert pending is not None
    assert outbox[0]["code"] not in pending["code_hash"]
    # The password is hashed here too — this collection is no more sensitive than users.
    assert "Secret12345" not in pending["hashed_password"]


def test_correct_code_creates_the_account_and_signs_in(client, outbox, welcomes):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]

    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["first_name"] == "Ada"


def test_a_code_cannot_be_used_twice(client, outbox, welcomes):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    code = outbox[0]["code"]
    client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": code},
    )

    replay = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": code},
    )
    assert replay.status_code == 404


def test_wrong_code_is_rejected_and_spends_an_attempt(client, outbox, welcomes):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    wrong = "0" * settings.otp_length
    assert wrong != outbox[0]["code"]  # guard against a one-in-a-million flake

    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": wrong},
    )
    assert response.status_code == 401
    # The correct code still works: a wrong guess must not invalidate the real one.
    ok = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert ok.status_code == 200


def test_attempts_are_capped(client, outbox):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    wrong = "0" * settings.otp_length

    for _ in range(settings.otp_max_attempts):
        client.post(
            "/auth/verify-email",
            json={"signup_ticket": ticket, "email": "new@example.com", "code": wrong},
        )

    # Even the correct code is refused once the budget is gone — the sign-up is dead.
    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert response.status_code in (404, 429)


def test_an_expired_code_is_refused(client, outbox, db):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    # Mongo's TTL sweep runs about once a minute, so a row can outlive its expiry —
    # the route must check the date itself rather than trust the index.
    db.pending_signups.update_one(
        {"email": "new@example.com"},
        {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}},
    )

    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert response.status_code == 401
    assert db.users.find_one({"email": "new@example.com"}) is None


def test_resend_is_rate_limited(client, outbox):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]

    response = client.post(
        "/auth/resend-code", json={"email": "new@example.com", "signup_ticket": ticket}
    )
    assert response.status_code == 429
    assert len(outbox) == 1  # nothing was sent


def test_resend_issues_a_new_code_once_the_cooldown_passes(client, outbox, welcomes, db):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    db.pending_signups.update_one(
        {"email": "new@example.com"},
        {
            "$set": {
                "last_sent_at": datetime.now(UTC)
                - timedelta(seconds=settings.otp_resend_cooldown_seconds + 1)
            }
        },
    )

    response = client.post(
        "/auth/resend-code", json={"email": "new@example.com", "signup_ticket": ticket}
    )
    assert response.status_code == 200
    assert len(outbox) == 2

    # The superseded code stops working; only the newest one is live.
    stale = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert stale.status_code == 401
    fresh = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[1]["code"]},
    )
    assert fresh.status_code == 200


def test_verifying_an_unknown_email_does_not_create_anything(client, outbox):
    response = client.post(
        "/auth/verify-email",
        json={"email": "ghost@example.com", "code": "123456", "signup_ticket": "x" * 43},
    )
    assert response.status_code == 404


def test_an_unverified_signup_cannot_log_in(client, outbox):
    client.post("/auth/register", json=_registration())

    response = client.post(
        "/auth/login", json={"email": "new@example.com", "password": "Secret12345"}
    )
    assert response.status_code == 401


def test_a_pasted_code_with_spaces_is_accepted(client, outbox, welcomes):
    """Mail clients and people both break codes up; rejecting that is a papercut."""
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    code = outbox[0]["code"]
    spaced = f"{code[:3]} {code[3:]}"

    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": spaced},
    )
    assert response.status_code == 200


def test_registering_again_replaces_the_pending_signup(client, outbox, welcomes, monkeypatch):
    """A corrected sign-up must not leave two live codes for one inbox."""
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    monkeypatch.setattr(settings, "otp_resend_cooldown_seconds", 0)

    second = client.post("/auth/register", json=_registration(first_name="Grace"))
    ticket = second.json()["signup_ticket"]
    assert second.status_code == 201
    assert len(outbox) == 2

    client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[1]["code"]},
    )
    token = client.post(
        "/auth/login", json={"email": "new@example.com", "password": "Secret12345"}
    ).json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["first_name"] == "Grace"


def test_a_welcome_email_is_sent_once_the_account_exists(client, outbox, welcomes):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    # Nothing is welcomed before the address is proven.
    assert welcomes == []

    client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )

    assert len(welcomes) == 1
    assert welcomes[0] == {"to": "new@example.com", "first_name": "Ada"}


def test_a_wrong_code_does_not_trigger_a_welcome(client, outbox, welcomes):
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]
    client.post(
        "/auth/verify-email",
        json={
            "signup_ticket": ticket,
            "email": "new@example.com",
            "code": "0" * settings.otp_length,
        },
    )
    assert welcomes == []


def test_signup_still_succeeds_when_the_welcome_email_fails(client, outbox, monkeypatch):
    """The account exists by the time the welcome is sent, so a mail server having a bad
    minute must not turn a completed sign-up into an error the user sees."""

    async def explode(**_kwargs) -> None:
        raise RuntimeError("SMTP is down")

    monkeypatch.setattr("app.api.auth.send_welcome_email", explode)
    ticket = client.post("/auth/register", json=_registration()).json()["signup_ticket"]

    response = client.post(
        "/auth/verify-email",
        json={"signup_ticket": ticket, "email": "new@example.com", "code": outbox[0]["code"]},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]

    # And the account really is usable, not merely reported as created.
    login = client.post("/auth/login", json={"email": "new@example.com", "password": "Secret12345"})
    assert login.status_code == 200
