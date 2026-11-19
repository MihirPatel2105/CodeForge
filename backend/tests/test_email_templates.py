"""The editorial email templates (app/core/email_templates.py).

Rendering only: no SMTP. These pin what matters in a mail client rather than in a browser —
escaping of anything a person typed, the plain-text twin saying the same thing as the HTML,
images that a mail client can actually fetch, and the inbox preview line.
"""

import re

import pytest

from app.config import settings
from app.core import email_templates as templates

WHEN = "19 Nov 2026 at 10:42 UTC"
TO = "maya@example.com"


def every_email() -> dict[str, templates.RenderedEmail]:
    return {
        "verification": templates.verification_code(
            to=TO, code="482917", minutes=10, first_name="Maya"
        ),
        "reset": templates.password_reset(to=TO, reset_url="https://x.test/reset/abc", minutes=10),
        "welcome": templates.welcome(to=TO, first_name="Maya"),
        "password_changed": templates.password_changed(to=TO, when=WHEN),
        "security_alert": templates.security_alert(
            to=TO, title="Passkey added", detail="A passkey was added.", when=WHEN
        ),
        "platform_alert": templates.platform_alert(
            to=TO, title="Platform alert: redis", detail="Redis is down.", when=WHEN
        ),
        "new_sign_in": templates.new_sign_in(
            to=TO,
            label="Chrome on macOS",
            ip_address=None,
            when=WHEN,
            review_url="https://x.test/review",
        ),
        "account_deleted": templates.account_deleted(to=TO, when=WHEN, projects=1, runs=14),
        "contact_message": templates.contact_message(
            to=TO, name="Priya", email="p@example.com", phone="", message="Hello", when=WHEN
        ),
        "contact_ack": templates.contact_ack(to=TO, name="Priya", message="Hello"),
        "recovery_invitation": templates.recovery_invitation(
            to=TO, url="https://x.test/recover/request/1"
        ),
        "recovery_approved": templates.recovery_approved(to=TO, url="https://x.test/recover/1"),
    }


@pytest.mark.parametrize("name", list(every_email()))
def test_every_email_has_a_preview_line_a_footer_and_a_matching_text_version(name):
    email = every_email()[name]

    assert email.subject
    assert email.html.startswith("<!doctype html>")
    # The hidden preheader is the line an inbox shows after the subject.
    assert "display:none;max-height:0" in email.html
    assert f"This email was sent to {TO}." in email.html
    assert f"This email was sent to {TO}." in email.text
    # The plain-text twin carries the same title, and every button's link.
    title = re.search(r"<h1[^>]*>(.*?)</h1>", email.html).group(1)
    assert email.text.startswith(title.replace("&#x27;", "'"))
    for href in re.findall(
        r'<a href="(https://x\.test[^"]*)"[^>]*display:inline-block', email.html
    ):
        assert href in email.text


def test_text_a_person_typed_is_escaped_and_keeps_its_line_breaks():
    email = templates.contact_ack(
        to=TO, name="<b>Priya</b>", message="a <script>x</script>\nsecond line"
    )

    assert "<script>" not in email.html
    assert "&lt;script&gt;" in email.html
    assert "<b>Priya</b>" not in email.html
    assert "x&lt;/script&gt;<br>second line" in email.html
    # Plain text is not HTML, so it keeps the words as typed.
    assert "> a <script>x</script>" in email.text


def test_device_labels_and_alert_details_are_escaped():
    sign_in = templates.new_sign_in(
        to=TO,
        label='<img src=x onerror="1">',
        ip_address="1.2.3.4",
        when=WHEN,
        review_url="https://x.test/r",
    )
    alert = templates.security_alert(
        to=TO, title="<i>t</i>", detail="<a href='//evil'>x</a>", when=WHEN
    )

    assert "<img src=x" not in sign_in.html
    assert "<i>t</i>" not in alert.html
    assert "<a href='//evil'>" not in alert.html


def test_localhost_uses_a_text_wordmark_because_mail_clients_cannot_fetch_it(monkeypatch):
    monkeypatch.setattr(settings, "app_base_url", "http://localhost:3000")
    html = templates.welcome(to=TO).html

    assert "<img " not in html
    assert "data:image" not in html and "cid:" not in html
    assert html.count(">CodeForge</span>") == 2  # header and footer


def test_a_public_origin_uses_the_light_and_dark_lockups(monkeypatch):
    monkeypatch.setattr(settings, "app_base_url", "https://app.codeforge.example/")
    html = templates.welcome(to=TO).html

    assert 'src="https://app.codeforge.example/brand/codeforge-lockup-light-email.png"' in html
    assert 'src="https://app.codeforge.example/brand/codeforge-lockup-dark-email.png"' in html
    assert "https://app.codeforge.example/projects" in html


def test_counts_are_pluralised_and_a_missing_ip_is_said_plainly():
    deleted = templates.account_deleted(to=TO, when=WHEN, projects=1, runs=14)
    sign_in = templates.new_sign_in(
        to=TO, label="Firefox", ip_address=None, when=WHEN, review_url="https://x.test/r"
    )

    assert "1 project deleted" in deleted.text and "14 runs deleted" in deleted.text
    assert "Unavailable" in sign_in.text


def test_platform_alert_subject_does_not_repeat_its_label():
    labelled = templates.platform_alert(to=TO, title="Platform alert: redis", detail="d", when=WHEN)
    bare = templates.platform_alert(to=TO, title="Redis down", detail="d", when=WHEN)

    assert labelled.subject == "CodeForge platform alert: redis"
    assert bare.subject == "CodeForge platform alert: Redis down"


def test_greetings_use_the_first_name_only_when_there_is_one():
    assert "Hello Maya," in templates.welcome(to=TO, first_name=" Maya ").text
    assert "Hello," in templates.welcome(to=TO, first_name="").text


def test_the_verification_code_is_in_the_subject_and_the_body():
    email = templates.verification_code(to=TO, code="482917", minutes=10)

    assert email.subject.startswith("482917 ")
    assert ">482917</div>" in email.html
    assert "    482917" in email.text
