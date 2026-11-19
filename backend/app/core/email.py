"""Outbound email.

SMTP over an app password rather than a transactional-email API: it costs nothing, needs
no account with a third party, and the credential lives in `.env` like every other secret
(CLAUDE.md §2, §5).

`aiosmtplib` rather than the standard library's `smtplib`, which is blocking — a socket
that stalls on a slow mail server would stall the whole event loop with it, and this call
sits inside a request path (CLAUDE.md §6).

What each message says and how it looks lives in `app/core/email_templates.py`; this
module only decides when to send and hands the result to the mail server.
"""

import logging
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import formatdate

import aiosmtplib

from app.config import settings
from app.core import email_templates as templates
from app.core.exceptions import CodeForgeError

logger = logging.getLogger(__name__)


class EmailDeliveryError(CodeForgeError):
    """The message could not be handed to the mail server."""

    status_code = 502
    code = "email_failed"


def _build(
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    reply_to: str | None = None,
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    message["To"] = to
    message["Subject"] = subject
    # Date is ours to set and costs nothing. Message-ID deliberately is not: we relay
    # through Gmail, and a Message-ID we invent claiming `@gmail.com` is a domain we do
    # not actually generate ids for — which reads as spoofing to a receiving server.
    # Gmail stamps a correct one on submission, so letting it do that is both simpler
    # and more trustworthy than forging one.
    message["Date"] = formatdate(localtime=True)
    # Contact messages are sent *by* the server but are *from* a person. Reply-To makes
    # hitting reply answer the person who wrote in, rather than mailing ourselves.
    if reply_to:
        message["Reply-To"] = reply_to
    # Plain text first, HTML as the alternative. Both are sent: a client that refuses
    # HTML, or a person reading in a terminal, still gets a usable code.
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
    return message


async def send_email(
    *,
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    reply_to: str | None = None,
) -> None:
    """Deliver one message, or raise `EmailDeliveryError`."""
    if not settings.email_verification_enabled:
        raise EmailDeliveryError("Email is not configured on this server")

    try:
        await aiosmtplib.send(
            _build(to, subject, text, html, reply_to),
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            # 587 is the STARTTLS port and 465 the implicit-TLS one; sending the wrong
            # handshake to either simply hangs, so the port decides.
            start_tls=settings.smtp_port == 587,
            use_tls=settings.smtp_port == 465,
            timeout=20,
        )
    except Exception as exc:  # noqa: BLE001 — every aiosmtplib failure is the same to us
        # The address is logged but the exception text is not returned to the client:
        # SMTP rejections can disclose whether a mailbox exists.
        logger.error("SMTP delivery to %s failed: %s", to, exc)
        raise EmailDeliveryError("Could not send the verification email") from exc


async def send_rendered(
    email: templates.RenderedEmail, *, to: str, reply_to: str | None = None
) -> None:
    """Send a message built by `app/core/email_templates.py`."""
    await send_email(
        to=to, subject=email.subject, text=email.text, html=email.html, reply_to=reply_to
    )


def _stamp(moment: datetime | None = None) -> str:
    """UTC, spelled out. A bare local time in an email is ambiguous to the reader and
    wrong for anyone who has since travelled."""
    return (moment or datetime.now(UTC)).astimezone(UTC).strftime("%d %b %Y at %H:%M UTC")


async def send_verification_code(*, to: str, code: str, first_name: str = "") -> None:
    await send_rendered(
        templates.verification_code(
            to=to, code=code, minutes=settings.otp_ttl_minutes, first_name=first_name
        ),
        to=to,
    )


async def send_password_reset_email(*, to: str, reset_url: str, first_name: str = "") -> None:
    await send_rendered(
        templates.password_reset(
            to=to,
            reset_url=reset_url,
            minutes=settings.reset_token_ttl_minutes,
            first_name=first_name,
        ),
        to=to,
    )


async def send_welcome_email(*, to: str, first_name: str = "") -> None:
    """Sent once, when an address has been proven and the account exists.

    Callers must treat a failure here as cosmetic: the account is already created by the
    time this runs, so a mail server having a bad minute must not turn a successful
    sign-up into an error. See `_send_welcome_quietly` in the auth router.
    """
    await send_rendered(templates.welcome(to=to, first_name=first_name), to=to)


async def send_password_changed_email(*, to: str, first_name: str = "") -> None:
    """Tell the account its password moved. Never blocks the change itself."""
    await send_rendered(
        templates.password_changed(to=to, when=_stamp(), first_name=first_name), to=to
    )


async def send_security_alert_email(*, to: str, title: str, detail: str) -> None:
    await send_rendered(
        templates.security_alert(to=to, title=title, detail=detail, when=_stamp()), to=to
    )


async def send_platform_alert_email(*, to: str, title: str, detail: str) -> None:
    await send_rendered(
        templates.platform_alert(to=to, title=title, detail=detail, when=_stamp()), to=to
    )


async def send_new_device_email(
    *, to: str, label: str, ip_address: str | None, occurred_at: datetime, review_url: str
) -> None:
    await send_rendered(
        templates.new_sign_in(
            to=to,
            label=label,
            ip_address=ip_address,
            when=_stamp(occurred_at),
            review_url=review_url,
        ),
        to=to,
    )


async def send_account_deleted_email(
    *, to: str, first_name: str = "", projects: int = 0, runs: int = 0
) -> None:
    """Confirm a deletion, with what it actually removed.

    Sent after the account is gone, so this is the last message that address will ever
    receive from CodeForge — which is exactly why it states what was destroyed rather
    than just saying "done".
    """
    await send_rendered(
        templates.account_deleted(
            to=to, when=_stamp(), first_name=first_name, projects=projects, runs=runs
        ),
        to=to,
    )


async def send_contact_message(*, name: str, email: str, phone: str, message: str) -> None:
    """Forward a contact-form submission to whoever runs this instance.

    Delivered to `SMTP_USER` — the same mailbox the app sends from — so no extra
    configuration is needed to receive it. `reply_to` carries the sender's address, so
    answering is one click and does not require copying anything out of the body.
    """
    to = settings.smtp_user or email
    await send_rendered(
        templates.contact_message(
            to=to, name=name, email=email, phone=phone, message=message, when=_stamp()
        ),
        to=to,
        reply_to=email,
    )


async def send_contact_ack(*, to: str, name: str, message: str) -> None:
    """Confirm to the sender that their message arrived.

    Sent after the message to the team, and never allowed to fail the request — see the
    route. The copy of what they wrote is deliberate: it is the only record they have,
    since the form clears, and it is how they notice they sent the wrong thing.
    """
    await send_rendered(templates.contact_ack(to=to, name=name, message=message), to=to)
