"""Outbound email.

SMTP over an app password rather than a transactional-email API: it costs nothing, needs
no account with a third party, and the credential lives in `.env` like every other secret
(CLAUDE.md §2, §5).

`aiosmtplib` rather than the standard library's `smtplib`, which is blocking — a socket
that stalls on a slow mail server would stall the whole event loop with it, and this call
sits inside a request path (CLAUDE.md §6).
"""

import logging
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import formatdate
from html import escape as html_escape

import aiosmtplib

from app.config import settings
from app.core.exceptions import CodeForgeError

logger = logging.getLogger(__name__)


class EmailDeliveryError(CodeForgeError):
    """The message could not be handed to the mail server."""

    status_code = 502
    code = "email_failed"


# --------------------------------------------------------------------------- #
# Theme
# --------------------------------------------------------------------------- #
# Email clients cannot use the app's CSS variables. Keep this snapshot aligned with
# the light palette in `frontend/app/globals.css`.
_BG = "#f7f8fb"  # --bg
_SURFACE = "#ffffff"  # --surface
_SURFACE_2 = "#f3f5f9"  # --surface-2
_FG = "#172033"  # --fg
_FG_MUTED = "#526073"  # --fg-muted
_FG_FAINT = "#657285"  # --fg-faint
_RULE = "#e2e7ef"  # --rule
_BORDER_STRONG = "#cbd4e1"  # --border-strong
_ACCENT_SOFT = "#eef0ff"  # --accent-soft
_ACCENT_BORDER = "#cbd0ff"  # --accent-bd

_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"
_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
_RADIUS = "16px"

# Email clients can fetch a public HTTPS image, but Gmail rejects the two embedded-image
# techniques below. The lockup therefore lives on the frontend and is referenced through
# `APP_BASE_URL`; deployed environments must set that value to the public frontend origin.
# This keeps every email aligned with the product brand without adding an image attachment.
#
#   data: URI  — Gmail, Outlook and Yahoo refuse to render one in an <img src>. The mark
#                arrived as a broken-image icon in every client that matters.
#   cid: part  — renders correctly, but Gmail *silently drops the whole message* when it
#                crosses accounts. Proved twice on 2026-08-20. First with three variants
#                to one inbox: plain text arrived, HTML without an image arrived, the
#                identical HTML with the PNG attached never appeared — not in the inbox,
#                not in spam. Then again with that last variant sent on its own, in case
#                the first run had merely been throttled as a burst. It did not arrive
#                either. SMTP returned 2.0.0 OK every time.
#
# Note the asymmetry that makes this easy to misread: a message from this address *to
# itself* is delivered with the attachment intact and the logo rendering perfectly. Only
# the copy sent to a different account disappears. So "the logo works, I can see it" is
# consistent with every recipient outside the sending account receiving nothing at all.
#
_BRAND = "#3f47c9"
_BRAND_LOCKUP_FALLBACK_URL = (
    "https://raw.githubusercontent.com/MihirPatel2105/CodeForge/main/"
    "frontend/public/brand/codeforge-lockup-light.png"
)


def _brand_lockup_url() -> str:
    base_url = settings.app_base_url.rstrip("/")
    if base_url.startswith("https://"):
        return f"{base_url}/brand/codeforge-lockup-light.png"
    return _BRAND_LOCKUP_FALLBACK_URL


def _shell(*, eyebrow: str, heading: str, rows: str) -> str:
    """Shared email frame: current palette, logo, title, and content.

    Extracted the moment there was a second email — two copies of this table markup
    would drift within a week, and the whole point is that a message from CodeForge
    looks like CodeForge.

    Tables and inline styles throughout. Mail clients strip `<style>` blocks, ignore
    flexbox and grid, and Outlook renders through Word — so this is deliberately the
    layout technique the rest of the codebase would never use.
    """
    return f"""\
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{_BG};padding:36px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:520px;background:{_SURFACE};border:1px solid {_RULE};
                  border-radius:20px;">
      <tr><td style="padding:28px 32px 0 32px;">
        <a href="{html_escape(settings.app_base_url, quote=True)}" style="display:inline-block;text-decoration:none;">
          <img src="{html_escape(_brand_lockup_url(), quote=True)}" alt="CodeForge" width="174" height="58"
               style="display:block;width:174px;height:auto;border:0;outline:none;text-decoration:none;">
        </a>
      </td></tr>

      <tr><td style="padding:31px 32px 0 32px;font-family:{_SANS};font-size:13px;
                     font-weight:650;color:{_BRAND};">{html_escape(eyebrow.capitalize())}</td></tr>

      <tr><td style="padding:11px 32px 0 32px;font-family:{_SANS};font-size:27px;
                     font-weight:700;line-height:1.2;letter-spacing:-0.04em;color:{_FG};">
        {html_escape(heading)}
      </td></tr>

{rows}

      <tr><td style="padding:28px 32px 30px 32px;font-family:{_SANS};font-size:11px;
                     line-height:1.5;color:{_FG_FAINT};">
        CodeForge &nbsp;&middot;&nbsp; Your API workspace
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


def _prose(text: str, *, top: int = 12) -> str:
    return f"""      <tr><td style="padding:{top}px 32px 0 32px;font-family:{_SANS};font-size:15px;
                     line-height:1.65;color:{_FG_MUTED};">
        {text}
      </td></tr>"""


def _footnote(text: str) -> str:
    """A rule, then small print — the same closing device the marketing pages use."""
    return f"""      <tr><td style="padding:27px 32px 0 32px;">
        <div style="border-top:1px solid {_RULE};"></div>
      </td></tr>

      <tr><td style="padding:15px 32px 0 32px;font-family:{_SANS};font-size:12.5px;
                     line-height:1.6;color:{_FG_MUTED};">
        {text}
      </td></tr>"""


def _verification_rows(*, code: str, minutes: int) -> str:
    # The code framed as a value, not dressed up as a button: it is something to read
    # and retype, and a button-shaped thing invites a click that does nothing.
    return f"""{_prose("Enter this code to finish creating your account.")}

      <tr><td style="padding:22px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid {_ACCENT_BORDER};border-radius:{_RADIUS};
                      background:{_ACCENT_SOFT};">
          <tr><td align="center" style="padding:20px 12px;font-family:{_MONO};
                     font-size:30px;font-weight:700;letter-spacing:0.22em;
                     color:{_FG};">{html_escape(code)}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:13px 32px 0 32px;font-family:{_SANS};font-size:13px;
                     color:{_FG_MUTED};">Expires in {minutes} minutes</td></tr>

{
        _footnote(
            "If you did not try to create a CodeForge account, ignore this message "
            "&mdash; nothing was created, and no account exists for this address."
        )
    }"""


def _step_row(index: str, label: str, detail: str) -> str:
    """One numbered step in the welcome message."""
    return f"""      <tr><td style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-top:1px solid {_RULE};">
          <tr>
            <td valign="top" width="38" style="padding:15px 0;font-family:{_MONO};
                       font-size:12px;font-weight:700;color:{_BRAND};">{index}</td>
            <td valign="top" style="padding:13px 0;">
              <div style="font-family:{_SANS};font-size:14px;font-weight:700;
                          color:{_FG};">{label}</div>
              <div style="margin-top:4px;font-family:{_SANS};font-size:13px;
                          line-height:1.5;color:{_FG_MUTED};">{detail}</div>
            </td>
          </tr>
        </table>
      </td></tr>"""


def _button_row(*, href: str, label: str, top: int = 22) -> str:
    """A clear primary action for links back into the product."""
    return f"""      <tr><td style="padding:{top}px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:{_FG};border-radius:12px;">
            <a href="{html_escape(href, quote=True)}"
               style="display:inline-block;padding:14px 23px;font-family:{_SANS};
                      font-size:14px;font-weight:650;color:{_SURFACE};text-decoration:none;">
              {label}
            </a>
          </td></tr>
        </table>
      </td></tr>"""


def _reset_password_rows(*, reset_url: str, minutes: int) -> str:
    safe_url = html_escape(reset_url, quote=True)
    return f"""{
        _prose(
            "We received a request to reset the password for your CodeForge "
            "account. Click below to choose a new one."
        )
    }

{_button_row(href=reset_url, label="Reset password")}

      <tr><td style="padding:14px 32px 0 32px;font-family:{_SANS};font-size:13px;
                     color:{_FG_MUTED};">Expires in {minutes} minutes &middot; Single use</td></tr>

      <tr><td style="padding:18px 32px 0 32px;font-family:{_SANS};font-size:12.5px;
                     line-height:1.6;color:{_FG_FAINT};">
        If the button does not work, paste this into your browser:<br>
        <a href="{safe_url}" style="color:{_BRAND};word-break:break-all;">{safe_url}</a>
      </td></tr>

{
        _footnote(
            "If you did not request this, ignore this message &mdash; your password "
            "will not change, and this link will expire on its own."
        )
    }"""


def _welcome_rows(*, app_url: str) -> str:
    steps = "\n\n".join(
        (
            _step_row("01", "Describe it", "One plain-English sentence about the API you want."),
            _step_row("02", "Approve twice", "Once on the requirements, once on the design."),
            _step_row(
                "03",
                "Watch it run",
                "Five agents build and review it, then a container runs the tests for real.",
            ),
        )
    )
    return f"""{
        _prose(
            "Your account is ready. CodeForge turns a sentence into a working, "
            "tested CRUD REST API &mdash; here is the shape of a run."
        )
    }

      <tr><td style="height:22px;"></td></tr>

{steps}

{_button_row(href=f"{app_url}/projects", label="Start your first run", top=26)}

{
        _footnote(
            "Every run is free to produce &mdash; CodeForge is built entirely on "
            "free-tier models, so nothing here costs you anything."
        )
    }"""


def _security_rows(*, when: str, body: str, warning: str) -> str:
    """A notice about something that already happened to the account.

    Every one of these carries a "if this wasn't you" line. A security email that only
    says what happened is a receipt; the point of sending it is that the person who did
    *not* do it finds out.
    """
    return f"""{_prose(html_escape(body))}

      <tr><td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid {_RULE};border-radius:{_RADIUS};
                      background:{_SURFACE_2};">
          <tr><td style="padding:15px 17px 4px 17px;font-family:{_SANS};font-size:12px;
                     font-weight:650;color:{_FG_MUTED};">When</td></tr>
          <tr><td style="padding:0 17px 16px 17px;font-family:{_SANS};font-size:14px;
                     color:{_FG};">{html_escape(when)}</td></tr>
        </table>
      </td></tr>

{_footnote(warning)}"""


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


async def send_verification_code(*, to: str, code: str, first_name: str = "") -> None:
    greeting = f"Hi {first_name}." if first_name else "Verify your email."
    minutes = settings.otp_ttl_minutes
    await send_email(
        to=to,
        subject=f"{code} is your CodeForge verification code",
        text=(
            f"{greeting}\n\n"
            f"Enter this code to finish creating your CodeForge account:\n\n"
            f"    {code}\n\n"
            f"It expires in {minutes} minutes.\n\n"
            f"If you did not try to create an account, ignore this message — nothing "
            f"was created.\n"
        ),
        html=_shell(
            eyebrow="verify your email",
            heading=greeting,
            rows=_verification_rows(code=code, minutes=minutes),
        ),
    )


async def send_password_reset_email(*, to: str, reset_url: str, first_name: str = "") -> None:
    heading = f"{first_name}, reset your password." if first_name else "Reset your password."
    minutes = settings.reset_token_ttl_minutes
    await send_email(
        to=to,
        subject="Reset your CodeForge password",
        text=(
            f"{heading}\n\n"
            f"We received a request to reset the password for your CodeForge account.\n\n"
            f"Reset it here: {reset_url}\n\n"
            f"This link expires in {minutes} minutes and can only be used once.\n\n"
            f"If you did not request this, ignore this message \u2014 your password will "
            f"not change.\n"
        ),
        html=_shell(
            eyebrow="password reset",
            heading=heading,
            rows=_reset_password_rows(reset_url=reset_url, minutes=minutes),
        ),
    )


async def send_welcome_email(*, to: str, first_name: str = "") -> None:
    """Sent once, when an address has been proven and the account exists.

    Callers must treat a failure here as cosmetic: the account is already created by the
    time this runs, so a mail server having a bad minute must not turn a successful
    sign-up into an error. See `_send_welcome_quietly` in the auth router.
    """
    heading = f"Welcome, {first_name}." if first_name else "Welcome to CodeForge."
    await send_email(
        to=to,
        subject="Your CodeForge account is ready",
        text=(
            f"{heading}\n\n"
            f"Your account is ready. CodeForge turns a sentence into a working, tested "
            f"CRUD REST API.\n\n"
            f"    01  describe it     One plain-English sentence about the API you want.\n"
            f"    02  approve twice   Once on the requirements, once on the design.\n"
            f"    03  watch it run    Five agents build and review it, then a container\n"
            f"                        runs the tests for real.\n\n"
            f"Start your first run: {settings.app_base_url}/projects\n\n"
            f"Every run is free to produce — CodeForge is built entirely on free-tier "
            f"models.\n"
        ),
        html=_shell(
            eyebrow="account created",
            heading=heading,
            rows=_welcome_rows(app_url=settings.app_base_url),
        ),
    )


def _stamp() -> str:
    """UTC, spelled out. A bare local time in an email is ambiguous to the reader and
    wrong for anyone who has since travelled."""
    return datetime.now(UTC).strftime("%d %b %Y at %H:%M UTC")


async def send_password_changed_email(*, to: str, first_name: str = "") -> None:
    """Tell the account its password moved. Never blocks the change itself."""
    heading = (
        f"{first_name}, your password was changed." if first_name else "Your password was changed."
    )
    when = _stamp()
    warning = (
        "If you did not do this, someone else may have access to your account. Sign in "
        "and change your password again straight away."
    )
    body = (
        "The password on your CodeForge account has been changed, and every other "
        "browser that was signed in has been signed out."
    )
    await send_email(
        to=to,
        subject="Your CodeForge password was changed",
        text=f"{heading}\n\n{body}\n\nWhen: {when}\n\n{warning}\n",
        html=_shell(
            eyebrow="security notice",
            heading=heading,
            rows=_security_rows(when=when, body=body, warning=warning),
        ),
    )


async def send_security_alert_email(*, to: str, title: str, detail: str) -> None:
    when = _stamp()
    await send_email(
        to=to,
        subject=f"CodeForge security alert: {title}",
        text=f"{title}\n\n{detail}\n\nWhen: {when}\n",
        html=_shell(
            eyebrow="security alert",
            heading=title,
            rows=_security_rows(
                when=when,
                body=detail,
                warning="If this was not expected, change the account password immediately.",
            ),
        ),
    )


async def send_new_device_email(
    *, to: str, label: str, ip_address: str | None, occurred_at: datetime, review_url: str
) -> None:
    when = occurred_at.astimezone(UTC).strftime("%d %b %Y at %H:%M UTC")
    detail = f"Device: {label}\nTime: {when}\nIP address: {ip_address or 'Unavailable'}"
    await send_email(
        to=to,
        subject="New sign-in to your CodeForge account",
        text=(
            f"A new browser signed in to your CodeForge account.\n\n{detail}\n\n"
            f"Was this you? Review this sign-in: {review_url}\n\n"
            "If it was not you, use that page to sign out every device and then reset your password.\n"
        ),
        html=_shell(
            eyebrow="new sign-in",
            heading="A new browser signed in.",
            rows=(
                _security_rows(
                    when=when,
                    body=f"Device: {label}. IP address: {ip_address or 'Unavailable'}.",
                    warning="If this was not you, sign out every device and reset your password.",
                )
                + _button_row(href=review_url, label="Review sign-in")
            ),
        ),
    )


async def send_account_deleted_email(
    *, to: str, first_name: str = "", projects: int = 0, runs: int = 0
) -> None:
    """Confirm a deletion, with what it actually removed.

    Sent after the account is gone, so this is the last message that address will ever
    receive from CodeForge — which is exactly why it states what was destroyed rather
    than just saying "done".
    """
    heading = (
        f"Your account is deleted, {first_name}." if first_name else "Your account is deleted."
    )
    when = _stamp()
    warning = (
        "If you did not do this, contact whoever runs this CodeForge instance. Nothing "
        "can be restored from here — the data is gone, not archived."
    )
    body = (
        f"Your CodeForge account and everything it owned has been permanently deleted: "
        f"{projects} project(s), {runs} run(s), and every generated file stored against "
        f"them. This address is free to sign up again whenever you like."
    )
    await send_email(
        to=to,
        subject="Your CodeForge account has been deleted",
        text=f"{heading}\n\n{body}\n\nWhen: {when}\n\n{warning}\n",
        html=_shell(
            eyebrow="account deleted",
            heading=heading,
            rows=_security_rows(when=when, body=body, warning=warning),
        ),
    )


def _quote_block(text: str, *, top: int = 16) -> str:
    """User-supplied text in a framed block.

    Escaped, with newlines turned into breaks. This is the only place a stranger's
    keystrokes become HTML, in a message we send to ourselves *and* back to them, so the
    escaping lives here rather than at each call site.
    """
    body = html_escape(text).replace("\n", "<br>")
    return f"""      <tr><td style="padding:{top}px 32px 0 32px;">
        <div style="border:1px solid {_BORDER_STRONG};border-radius:{_RADIUS};
                    background:{_SURFACE_2};padding:16px 18px;font-family:{_SANS};font-size:14px;
                    line-height:1.65;color:{_FG};">{body}</div>
      </td></tr>"""


def _notice(text: str) -> str:
    """A quiet tinted panel for something reassuring rather than actionable."""
    return f"""      <tr><td style="padding:16px 32px 0 32px;">
        <div style="background:{_ACCENT_SOFT};border:1px solid {_ACCENT_BORDER};border-radius:{_RADIUS};
                    padding:14px 16px;font-family:{_SANS};font-size:13.5px;
                    line-height:1.6;color:{_FG_MUTED};">{text}</div>
      </td></tr>"""


def _contact_rows(*, name: str, email: str, phone: str, message: str, when: str) -> str:
    """Sender details as a labelled table, then the message itself in a framed block."""
    details = [("From", name), ("Email", email)]
    if phone:
        details.append(("Phone", phone))
    details.append(("Sent", when))

    rows = "".join(
        f"""        <tr>
          <td style="padding:0 12px 9px 0;font-family:{_SANS};font-size:12px;
                     font-weight:650;
                     color:{_FG_FAINT};white-space:nowrap;vertical-align:top;">{label}</td>
          <td style="padding:0 0 9px 0;font-family:{_SANS};font-size:13.5px;
                     color:{_FG};">{html_escape(value)}</td>
        </tr>"""
        for label, value in details
    )

    return f"""      <tr><td style="padding:20px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
{rows}
        </table>
      </td></tr>

{_quote_block(message)}

{_footnote("Reply to this email and your answer goes straight to the sender.")}"""


async def send_contact_message(*, name: str, email: str, phone: str, message: str) -> None:
    """Forward a contact-form submission to whoever runs this instance.

    Delivered to `SMTP_USER` — the same mailbox the app sends from — so no extra
    configuration is needed to receive it. `reply_to` carries the sender's address, so
    answering is one click and does not require copying anything out of the body.
    """
    when = _stamp()
    heading = f"{name} sent a message"
    text_lines = [
        heading,
        "",
        f"From:  {name}",
        f"Email: {email}",
    ]
    if phone:
        text_lines.append(f"Phone: {phone}")
    text_lines += ["", message, "", f"Sent: {when}"]

    await send_email(
        to=settings.smtp_user or email,
        subject=f"CodeForge contact — {name}",
        text="\n".join(text_lines) + "\n",
        html=_shell(
            eyebrow="contact form",
            heading=heading,
            rows=_contact_rows(name=name, email=email, phone=phone, message=message, when=when),
        ),
        reply_to=email,
    )


def _contact_ack_rows(*, name: str, message: str) -> str:
    greeting = f"Hi {html_escape(name)}, we" if name else "We"
    return f"""{
        _prose(
            f"{greeting} received your message, and someone will reply within one or two "
            "working days."
        )
    }
{_prose("For reference, here is what you sent:", top=14)}
{_quote_block(message, top=12)}
{
        _notice(
            "No action is needed from you. If it becomes urgent, just reply to this "
            "email &mdash; it reaches the same place."
        )
    }
{
        _footnote(
            "You are getting this because this address was used on the CodeForge contact "
            "form. If that was not you, ignore it &mdash; nothing was created or changed."
        )
    }"""


async def send_contact_ack(*, to: str, name: str, message: str) -> None:
    """Confirm to the sender that their message arrived.

    Sent after the message to the team, and never allowed to fail the request — see the
    route. The copy of what they wrote is deliberate: it is the only record they have,
    since the form clears, and it is how they notice they sent the wrong thing.
    """
    heading = "Thanks for getting in touch"
    intro = f"Hi {name}, we received your message" if name else "We received your message"
    await send_email(
        to=to,
        subject="We received your message — CodeForge",
        text=(
            f"{heading}\n\n"
            f"{intro}, and someone will reply within one or two working days.\n\n"
            f"For reference, here is what you sent:\n\n{message}\n\n"
            "No action is needed from you. If it becomes urgent, just reply to this "
            "email — it reaches the same place.\n"
        ),
        html=_shell(
            eyebrow="contact",
            heading=heading,
            rows=_contact_ack_rows(name=name, message=message),
        ),
    )
