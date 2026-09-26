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
# Copied from the light palette in `frontend/app/globals.css`, not imported: an email is
# rendered by someone else's mail client months after it was sent, so it cannot resolve
# CSS variables, load a stylesheet, or follow a design token that moved. The trade is
# that these five values are a duplicate — if the palette changes, this changes with it.
_BG = "#faf9f7"  # --bg
_SURFACE = "#ffffff"  # --surface
_FG = "#16181c"  # --fg
_FG_MUTED = "#5c6169"  # --fg-muted
_FG_FAINT = "#8a9099"  # --fg-faint
_RULE = "#dcd8cf"  # --rule
_BORDER_STRONG = "#cdcac2"  # --border-strong

# The product's display face is monospace, which is the whole visual signature; a mail
# client that has none of these still lands on its own `monospace`, so the character of
# the design survives even the worst case.
_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"
_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
_RADIUS = "3px"  # --radius: near-square, as on every surface in the app

# The email mark is drawn with a table cell and inline CSS — an indigo tile with
# a white return arrow for the review loop — rather than being an image. Both image
# techniques were tried against real Gmail
# delivery and both failed, so do not reach for either again:
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
# A remote https:// image would work — Gmail proxies and caches those — but it needs
# public hosting the backend does not have. Worth revisiting once the frontend is on
# Vercel: an <img> pointing at a deployed asset would restore the real mark for everyone.
# Until then, type and a coloured tile survive everywhere and need nothing.
_BRAND = "#3f47c9"
_MARK_GLYPH = "↶"


def _shell(*, eyebrow: str, heading: str, rows: str) -> str:
    """The frame both emails share: ground, card, wordmark, eyebrow, heading, footer.

    Extracted the moment there was a second email — two copies of this table markup
    would drift within a week, and the whole point is that a message from CodeForge
    looks like CodeForge.

    Tables and inline styles throughout. Mail clients strip `<style>` blocks, ignore
    flexbox and grid, and Outlook renders through Word — so this is deliberately the
    layout technique the rest of the codebase would never use.
    """
    return f"""\
<body style="margin:0;padding:0;background:{_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{_BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;background:{_SURFACE};border:1px solid {_RULE};
                  border-radius:{_RADIUS};">

      <!-- Wordmark. The tile is a styled table cell, not an image — see the note above
           `_MARK_GLYPH` for why every image technique was abandoned. Outlook ignores
           border-radius and renders a square tile, which is a fine degradation. -->
      <tr><td style="padding:26px 30px 0 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="30" height="30" align="center" valign="middle"
              style="width:30px;height:30px;background:{_BRAND};border-radius:8px;
                     font-family:{_SANS};font-size:22px;font-weight:700;line-height:30px;
                     color:{_SURFACE};text-align:center;">{_MARK_GLYPH}</td>
          <td style="padding-left:9px;">
            <span style="font-family:{_SANS};font-size:18px;font-weight:750;
                         color:{_FG};letter-spacing:-0.06em;">Code</span><span
                  style="font-family:{_SANS};font-size:18px;font-weight:800;
                         color:{_BRAND};letter-spacing:-0.06em;">Forge</span>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:26px 30px 0 30px;font-family:{_MONO};font-size:10px;
                     font-weight:700;text-transform:uppercase;letter-spacing:0.16em;
                     color:{_FG_FAINT};">[ {eyebrow} ]</td></tr>

      <tr><td style="padding:14px 30px 0 30px;font-family:{_MONO};font-size:19px;
                     font-weight:700;line-height:1.3;letter-spacing:-0.03em;color:{_FG};">
        {heading}
      </td></tr>

{rows}

    </table>
  </td></tr>
</table>
</body>"""


def _prose(text: str, *, top: int = 12) -> str:
    return f"""      <tr><td style="padding:{top}px 30px 0 30px;font-family:{_SANS};font-size:14px;
                     line-height:1.6;color:{_FG_MUTED};">
        {text}
      </td></tr>"""


def _footnote(text: str) -> str:
    """A rule, then small print — the same closing device the marketing pages use."""
    return f"""      <tr><td style="padding:24px 30px 0 30px;">
        <div style="border-top:1px solid {_RULE};"></div>
      </td></tr>

      <tr><td style="padding:16px 30px 28px 30px;font-family:{_SANS};font-size:12.5px;
                     line-height:1.6;color:{_FG_FAINT};">
        {text}
      </td></tr>"""


def _verification_rows(*, code: str, minutes: int) -> str:
    # The code framed as a value, not dressed up as a button: it is something to read
    # and retype, and a button-shaped thing invites a click that does nothing.
    return f"""{_prose("Enter this code to finish creating your account.")}

      <tr><td style="padding:22px 30px 0 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid {_BORDER_STRONG};border-radius:{_RADIUS};
                      background:{_BG};">
          <tr><td align="center" style="padding:20px 12px;font-family:{_MONO};
                     font-size:31px;font-weight:700;letter-spacing:0.28em;
                     color:{_FG};">{code}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:16px 30px 0 30px;font-family:{_MONO};font-size:10.5px;
                     font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
                     color:{_FG_FAINT};">expires in {minutes} minutes</td></tr>

{
        _footnote(
            "If you did not try to create a CodeForge account, ignore this message "
            "&mdash; nothing was created, and no account exists for this address."
        )
    }"""


def _step_row(index: str, label: str, detail: str) -> str:
    """One numbered step, set the way the marketing pages set their `[01]` list."""
    return f"""      <tr><td style="padding:0 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-top:1px solid {_RULE};">
          <tr>
            <td valign="top" width="34" style="padding:13px 0;font-family:{_MONO};
                       font-size:11px;font-weight:700;color:{_FG_FAINT};">{index}</td>
            <td valign="top" style="padding:13px 0;">
              <div style="font-family:{_MONO};font-size:13.5px;font-weight:700;
                          color:{_FG};letter-spacing:-0.02em;">{label}</div>
              <div style="margin-top:4px;font-family:{_SANS};font-size:13px;
                          line-height:1.5;color:{_FG_MUTED};">{detail}</div>
            </td>
          </tr>
        </table>
      </td></tr>"""


def _button_row(*, href: str, label: str, top: int = 22) -> str:
    """A single dark, mono, all-caps button — reused wherever an email links back into
    the product rather than just showing a value to read, as the verification code
    does."""
    return f"""      <tr><td style="padding:{top}px 30px 0 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:{_FG};border-radius:{_RADIUS};">
            <a href="{href}"
               style="display:inline-block;padding:14px 26px;font-family:{_MONO};
                      font-size:12px;font-weight:700;text-transform:uppercase;
                      letter-spacing:0.12em;color:{_SURFACE};text-decoration:none;">
              {label}
            </a>
          </td></tr>
        </table>
      </td></tr>"""


def _reset_password_rows(*, reset_url: str, minutes: int) -> str:
    return f"""{
        _prose(
            "We received a request to reset the password for your CodeForge "
            "account. Click below to choose a new one."
        )
    }

{_button_row(href=reset_url, label="Reset password")}

      <tr><td style="padding:16px 30px 0 30px;font-family:{_MONO};font-size:10.5px;
                     font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
                     color:{_FG_FAINT};">expires in {minutes} minutes &middot; single use</td></tr>

      <tr><td style="padding:18px 30px 0 30px;font-family:{_SANS};font-size:12.5px;
                     line-height:1.6;color:{_FG_FAINT};">
        If the button does not work, paste this into your browser:<br>
        <a href="{reset_url}" style="color:{_FG_MUTED};word-break:break-all;">{reset_url}</a>
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
            _step_row("01", "describe it", "One plain-English sentence about the API you want."),
            _step_row("02", "approve twice", "Once on the requirements, once on the design."),
            _step_row(
                "03",
                "watch it run",
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
    return f"""{_prose(body)}

      <tr><td style="padding:20px 30px 0 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid {_BORDER_STRONG};border-radius:{_RADIUS};
                      background:{_BG};">
          <tr><td style="padding:14px 16px;font-family:{_MONO};font-size:11px;
                     font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
                     color:{_FG_FAINT};">when</td></tr>
          <tr><td style="padding:0 16px 14px 16px;font-family:{_MONO};font-size:13px;
                     color:{_FG};">{when}</td></tr>
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
                    body=f"Device: {html_escape(label)}. IP address: {html_escape(ip_address or 'Unavailable')}.",
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
    return f"""      <tr><td style="padding:{top}px 30px 0 30px;">
        <div style="border:1px solid {_BORDER_STRONG};border-radius:{_RADIUS};
                    padding:16px 18px;font-family:{_SANS};font-size:14px;
                    line-height:1.65;color:{_FG};">{body}</div>
      </td></tr>"""


def _notice(text: str) -> str:
    """A quiet tinted panel for something reassuring rather than actionable."""
    return f"""      <tr><td style="padding:16px 30px 0 30px;">
        <div style="background:{_BG};border:1px solid {_RULE};border-radius:{_RADIUS};
                    padding:14px 16px;font-family:{_SANS};font-size:13.5px;
                    line-height:1.6;color:{_FG_MUTED};">{text}</div>
      </td></tr>"""


def _contact_rows(*, name: str, email: str, phone: str, message: str, when: str) -> str:
    """Sender details as a labelled table, then the message itself in a framed block."""
    details = [("from", name), ("email", email)]
    if phone:
        details.append(("phone", phone))
    details.append(("sent", when))

    rows = "".join(
        f"""        <tr>
          <td style="padding:0 12px 7px 0;font-family:{_MONO};font-size:10px;
                     font-weight:700;text-transform:uppercase;letter-spacing:0.14em;
                     color:{_FG_FAINT};white-space:nowrap;vertical-align:top;">{label}</td>
          <td style="padding:0 0 7px 0;font-family:{_SANS};font-size:13.5px;
                     color:{_FG};">{html_escape(value)}</td>
        </tr>"""
        for label, value in details
    )

    return f"""      <tr><td style="padding:18px 30px 0 30px;">
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
