"""The contact form.

Two things shape every test here:

`no_outbound_email` (autouse, conftest) blanks the SMTP credentials for the whole suite,
which is exactly the "mail is not configured" state — so any test expecting a *successful*
send has to restore them and capture the mailer. Nothing reaches a real mail server.

And the route requires an account. Identity comes from the token, never the body, so the
tests post only a phone and a message and assert on what the server derived.
"""

import pytest

from app.api import contact as contact_module
from app.config import settings


def _message(**overrides) -> dict:
    return {
        "phone": "+91 9876543210",
        "message": "The run stopped at the sandbox stage and I could not tell why.",
        **overrides,
    }


@pytest.fixture
def mailbox(monkeypatch):
    """Pretend SMTP is configured, and capture what would have been sent."""
    monkeypatch.setattr(settings, "smtp_user", "codeforge.sdlc@example.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")

    class _Sent(list):
        acks: list[dict]

    sent: list[dict] = _Sent()

    async def _capture(**kwargs) -> None:
        sent.append(kwargs)

    async def _capture_ack(**kwargs) -> None:
        sent.acks.append(kwargs)

    sent.acks = []
    monkeypatch.setattr(contact_module, "send_contact_message", _capture)
    monkeypatch.setattr(contact_module, "send_contact_ack", _capture_ack)
    return sent


@pytest.fixture(autouse=True)
def clear_throttle():
    """The throttle is module-level state, so it outlives a single test."""
    contact_module._recent.clear()
    yield
    contact_module._recent.clear()


# --------------------------------------------------------------------------- #
# Who is allowed to send
# --------------------------------------------------------------------------- #
def test_requires_an_account(client, mailbox):
    """The form is not a public relay: no token, no message."""
    response = client.post("/contact", json=_message())
    assert response.status_code == 401
    assert mailbox == []


def test_rejects_a_garbage_token(client, mailbox):
    response = client.post(
        "/contact", json=_message(), headers={"Authorization": "Bearer not-a-token"}
    )
    assert response.status_code == 401
    assert mailbox == []


def test_identity_comes_from_the_token_not_the_body(client, registered_user, mailbox):
    """A sender cannot claim to be someone else, even by sending the fields anyway."""
    response = client.post(
        "/contact",
        json={
            **_message(),
            "name": "Someone Else",
            "email": "victim@example.com",
        },
        headers=registered_user["headers"],
    )
    assert response.status_code == 200
    assert mailbox[0]["email"] == registered_user["email"]
    assert mailbox[0]["name"] == "Tess Tester"
    # The acknowledgement must go to the account too, never the supplied address.
    assert mailbox.acks[0]["to"] == registered_user["email"]


# --------------------------------------------------------------------------- #
# Sending
# --------------------------------------------------------------------------- #
def test_sends_the_message(client, registered_user, mailbox):
    response = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert response.status_code == 200
    assert len(mailbox) == 1
    assert "sandbox stage" in mailbox[0]["message"]


def test_the_sender_is_acknowledged(client, registered_user, mailbox):
    client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert len(mailbox.acks) == 1
    # Their own words come back, because the form clears and this is their only record.
    assert "sandbox stage" in mailbox.acks[0]["message"]


def test_phone_is_optional(client, registered_user, mailbox):
    response = client.post("/contact", json=_message(phone=""), headers=registered_user["headers"])
    assert response.status_code == 200
    assert mailbox[0]["phone"] == ""


# --------------------------------------------------------------------------- #
# Input rules
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("phone", ["hbhbj!#!$", "+91 98765abcde", "call me", "+91 12$34567"])
def test_rejects_a_phone_that_is_not_digits(client, registered_user, mailbox, phone):
    response = client.post(
        "/contact", json=_message(phone=phone), headers=registered_user["headers"]
    )
    assert response.status_code == 422
    assert mailbox == []


def test_rejects_a_phone_that_is_too_short(client, registered_user, mailbox):
    response = client.post(
        "/contact", json=_message(phone="+91 12"), headers=registered_user["headers"]
    )
    assert response.status_code == 422


def test_accepts_a_dial_code_with_digits(client, registered_user, mailbox):
    response = client.post(
        "/contact",
        json=_message(phone="+91 9313928398"),
        headers=registered_user["headers"],
    )
    assert response.status_code == 200


@pytest.mark.parametrize("payload", [{"message": ""}, {"message": "x" * 501}])
def test_rejects_a_bad_message(client, registered_user, mailbox, payload):
    response = client.post("/contact", json=_message(**payload), headers=registered_user["headers"])
    assert response.status_code == 422
    assert mailbox == []


# --------------------------------------------------------------------------- #
# Throttling and failure
# --------------------------------------------------------------------------- #
def test_second_message_from_the_same_account_is_throttled(client, registered_user, mailbox):
    first = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert first.status_code == 200
    second = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "rate_limited"
    assert len(mailbox) == 1


def test_a_failed_send_does_not_consume_the_throttle_slot(client, monkeypatch, registered_user):
    """A delivery failure is ours, not the sender's — they must be able to retry."""
    monkeypatch.setattr(settings, "smtp_user", "codeforge.sdlc@example.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")

    async def _explode(**kwargs) -> None:
        raise contact_module.EmailDeliveryError("mail server said no")

    monkeypatch.setattr(contact_module, "send_contact_message", _explode)

    first = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert first.status_code == 502

    # Not 429: the throttle was released when the send failed.
    second = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert second.status_code == 502


def test_a_failed_acknowledgement_does_not_fail_the_submission(
    client, monkeypatch, registered_user
):
    """The team already has the message; the courtesy copy is not worth losing it over."""
    monkeypatch.setattr(settings, "smtp_user", "codeforge.sdlc@example.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")

    delivered: list[dict] = []

    async def _capture(**kwargs) -> None:
        delivered.append(kwargs)

    async def _explode(**kwargs) -> None:
        raise contact_module.EmailDeliveryError("that mailbox bounced")

    monkeypatch.setattr(contact_module, "send_contact_message", _capture)
    monkeypatch.setattr(contact_module, "send_contact_ack", _explode)

    response = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert response.status_code == 200
    assert len(delivered) == 1


def test_form_is_off_when_the_server_has_no_mail_configured(client, registered_user):
    # `no_outbound_email` is autouse, so this is the default state here.
    response = client.post("/contact", json=_message(), headers=registered_user["headers"])
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "email_failed"


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #
def test_no_email_carries_an_image_by_any_technique():
    """Both ways of putting the mark in an email failed against real Gmail delivery.

    A `data:` URI renders as a broken-image icon; a `cid:` attachment renders fine but
    makes Gmail silently drop the whole message when it crosses accounts. The mark is
    drawn with a styled table cell instead, so this guards against either technique
    being reintroduced.
    """
    from app.core.email import _build, _shell

    message = _build(
        "to@example.com",
        "Subject",
        "plain text",
        _shell(eyebrow="test", heading="Test", rows=""),
    )

    types: list[str] = []

    def walk(part):
        types.append(part.get_content_type())
        if part.is_multipart():
            for sub in part.iter_parts():
                walk(sub)

    walk(message)
    assert not any(t.startswith("image/") for t in types), f"image part present: {types}"

    html = next(
        part.get_content()
        for part in message.iter_parts()
        if part.get_content_type() == "text/html"
    )
    assert "data:image" not in html
    assert "cid:" not in html
    assert "codeforge" in html


def test_every_message_carries_a_date(monkeypatch):
    """A message with no Date scores badly with spam filters and threads oddly.

    Message-ID is deliberately absent: we relay through Gmail, which stamps a correct
    one. Inventing an id that claims a domain we do not generate ids for reads as
    spoofing, which is worse than having none.
    """
    from app.core.email import _build

    monkeypatch.setattr(settings, "smtp_user", "codeforge.sdlc@gmail.com")
    message = _build("to@example.com", "Subject", "plain text")

    assert message["Date"], "no Date header"
    assert message["Message-ID"] is None, "we must not forge a Message-ID"


def test_the_acknowledgement_renders_with_the_senders_words_escaped():
    from app.core.email import _contact_ack_rows, _shell

    html = _shell(
        eyebrow="contact",
        heading="Thanks for getting in touch",
        rows=_contact_ack_rows(name="Priya", message="a <script>x</script>\nsecond line"),
    )
    assert "Hi Priya, we received your message" in html
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<br>" in html
