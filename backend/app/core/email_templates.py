"""Transactional email content and layout, in the editorial style of docs/design/ANTHROPIC_DESIGN.md.

Every message is a list of small blocks (paragraph, section heading, numbered steps, facts,
button…). Each block renders twice, to HTML and to plain text, so the two versions of an
email can never say different things. `app/core/email.py` only sends what these return.

Email HTML is its own world: tables and inline styles only, because mail clients strip
`<style>`, ignore flexbox and grid, and Outlook renders through Word. Web fonts are not
reliable either, so every font stack ends in faces that ship with the reader's system
(Georgia for the serif, Helvetica/Arial for the sans).

Everything a person typed (names, messages, device labels) is escaped here, in the
renderer, so no call site can forget to.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from html import escape

from app.config import settings

# --------------------------------------------------------------------------- #
# Palette and type (a snapshot of the light theme; email cannot read CSS variables)
# --------------------------------------------------------------------------- #
_PAGE = "#ffffff"  # around the card
_PAPER = "#faf9f5"  # the card
_INK = "#141413"
_MUTED = "#5e5d59"
_HAIR = "#e3e1d9"
_TILE = "#efede6"  # numbered tiles, the code, quoted messages
_FOOT_TEXT = "#c2c0b6"
_FOOT_FAINT = "#9c9a92"
_FOOT_HAIR = "#3d3d3a"

_SERIF = "Newsreader, Georgia, 'Times New Roman', serif"
_SANS = (
    "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
)
_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"

_GUTTER = 48  # side padding inside the card

_SECURITY_REASON = (
    "Security notices are always sent, so you know about every change to your account."
)


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


# --------------------------------------------------------------------------- #
# Blocks
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Para:
    text: str
    small: bool = False


@dataclass(frozen=True)
class Heading:
    text: str


@dataclass(frozen=True)
class Steps:
    items: tuple[tuple[str, str], ...]  # (title, detail)


@dataclass(frozen=True)
class Bullets:
    items: tuple[str, ...]


@dataclass(frozen=True)
class Facts:
    rows: tuple[tuple[str, str], ...]  # (label, value)


@dataclass(frozen=True)
class Code:
    value: str


@dataclass(frozen=True)
class Quote:
    text: str


@dataclass(frozen=True)
class Button:
    label: str
    href: str


@dataclass(frozen=True)
class LinkFallback:
    href: str


@dataclass(frozen=True)
class Rule:
    pass


Block = Para | Heading | Steps | Bullets | Facts | Code | Quote | Button | LinkFallback | Rule


def _row(inner: str, *, top: int) -> str:
    return f'<tr><td class="cf-gutter" style="padding:{top}px {_GUTTER}px 0 {_GUTTER}px;">{inner}</td></tr>'


def _table(rows: str, style: str = "") -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="{style}">{rows}</table>'
    )


def _para_html(block: Para) -> str:
    size, color = ("13.5px", _MUTED) if block.small else ("16px", _INK)
    return _row(
        f'<p style="margin:0;font-family:{_SANS};font-size:{size};line-height:1.6;color:{color};">'
        f"{escape(block.text)}</p>",
        top=14 if block.small else 18,
    )


def _heading_html(block: Heading) -> str:
    return _row(
        f'<h2 style="margin:0;font-family:{_SERIF};font-size:24px;font-weight:400;line-height:1.25;'
        f'letter-spacing:-0.01em;color:{_INK};">{escape(block.text)}</h2>',
        top=40,
    )


def _steps_html(block: Steps) -> str:
    rows = "".join(
        f"""<tr>
  <td valign="top" width="48" style="padding:0 18px 26px 0;">
    <div style="width:48px;height:48px;line-height:48px;border-radius:8px;background:{_TILE};text-align:center;
                font-family:{_SERIF};font-size:22px;color:{_INK};">{index}</div>
  </td>
  <td valign="top" style="padding:0 0 26px 0;">
    <div style="font-family:{_SERIF};font-size:20px;line-height:1.3;color:{_INK};">{escape(title)}</div>
    <div style="margin-top:8px;font-family:{_SANS};font-size:15px;line-height:1.6;color:{_INK};">{escape(detail)}</div>
  </td>
</tr>"""
        for index, (title, detail) in enumerate(block.items, start=1)
    )
    return _row(_table(rows), top=22)


def _bullets_html(block: Bullets) -> str:
    cell = f"font-family:{_SANS};line-height:1.55;color:{_INK};"
    rows = "".join(
        f"""<tr>
  <td valign="top" width="22" style="padding:0 0 10px 6px;font-size:16px;{cell}">&bull;</td>
  <td valign="top" style="padding:0 0 10px 0;font-size:15.5px;{cell}">{escape(item)}</td>
</tr>"""
        for item in block.items
    )
    return _row(_table(rows), top=14)


def _facts_html(block: Facts) -> str:
    edge = f"border-top:1px solid {_HAIR};font-family:{_SANS};line-height:1.5;"
    rows = "".join(
        f"""<tr>
  <td valign="top" width="34%" style="padding:13px 16px 13px 0;{edge}font-size:14px;color:{_MUTED};">{escape(label)}</td>
  <td valign="top" style="padding:13px 0;{edge}font-size:14.5px;color:{_INK};word-break:break-word;">{escape(value)}</td>
</tr>"""
        for label, value in block.rows
    )
    return _row(_table(rows, f"border-bottom:1px solid {_HAIR};"), top=22)


def _code_html(block: Code) -> str:
    # Framed as a value to read and retype, not dressed up as a button that does nothing.
    return _row(
        f'<div style="padding:22px 12px;border-radius:8px;background:{_TILE};text-align:center;'
        f"font-family:{_MONO};font-size:34px;font-weight:600;letter-spacing:0.32em;color:{_INK};"
        f'">{escape(block.value)}</div>',
        top=24,
    )


def _quote_html(block: Quote) -> str:
    body = escape(block.text).replace("\n", "<br>")
    return _row(
        f'<div style="padding:18px 20px;border-radius:8px;background:{_TILE};font-family:{_SANS};'
        f'font-size:15px;line-height:1.65;color:{_INK};">{body}</div>',
        top=16,
    )


def _button_html(block: Button) -> str:
    return _row(
        f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td style="border-radius:8px;background:{_INK};">
    <a href="{escape(block.href, quote=True)}" style="display:inline-block;padding:13px 24px;font-family:{_SANS};
       font-size:15px;font-weight:600;line-height:1.2;color:{_PAPER};text-decoration:none;border-radius:8px;">{escape(block.label)}</a>
  </td>
</tr></table>""",
        top=28,
    )


def _fallback_html(block: LinkFallback) -> str:
    href = escape(block.href, quote=True)
    return _row(
        f'<p style="margin:0;font-family:{_SANS};font-size:13px;line-height:1.6;color:{_MUTED};">'
        f"If the button doesn&rsquo;t work, paste this link into your browser:<br>"
        f'<a href="{href}" style="color:{_INK};text-decoration:underline;word-break:break-all;">{href}</a></p>',
        top=18,
    )


def _rule_html(_block: Rule) -> str:
    return _row(
        f'<div style="height:1px;line-height:1px;font-size:0;background:{_HAIR};">&nbsp;</div>',
        top=40,
    )


_HTML_RENDERERS = {
    Para: _para_html,
    Heading: _heading_html,
    Steps: _steps_html,
    Bullets: _bullets_html,
    Facts: _facts_html,
    Code: _code_html,
    Quote: _quote_html,
    Button: _button_html,
    LinkFallback: _fallback_html,
    Rule: _rule_html,
}


def _facts_text(block: Facts) -> str:
    width = max(len(label) for label, _ in block.rows) + 2
    return "\n".join(f"{label + ':':<{width}}{value}" for label, value in block.rows)


_TEXT_RENDERERS = {
    Para: lambda block: block.text,
    Heading: lambda block: f"{block.text}\n{'-' * len(block.text)}",
    Steps: lambda block: "\n\n".join(
        f"{index}. {title}\n   {detail}"
        for index, (title, detail) in enumerate(block.items, start=1)
    ),
    Bullets: lambda block: "\n".join(f"- {item}" for item in block.items),
    Facts: _facts_text,
    Code: lambda block: f"    {block.value}",
    Quote: lambda block: "\n".join(f"> {line}" for line in (block.text.splitlines() or [""])),
    Button: lambda block: f"{block.label}: {block.href}",
    LinkFallback: lambda _block: "",  # the text version already carries the full link
    Rule: lambda _block: "---",
}


# --------------------------------------------------------------------------- #
# Frame
# --------------------------------------------------------------------------- #
def _logo_url(variant: str) -> str | None:
    """The lockup as a public HTTPS image on the frontend, never embedded in the message.

    Both ways of embedding it failed in practice:

      data: URI — Gmail, Outlook and Yahoo refuse to render one in an <img src>; the mark
                  arrived as a broken-image icon in every client that matters.
      cid: part — renders, but Gmail *silently drops the whole message* when it crosses
                  accounts (proved twice on 2026-08-20, SMTP returning 2.0.0 OK each time).
                  A message from this address to itself arrives with the logo intact, so
                  "the logo works, I can see it" is consistent with every other recipient
                  receiving nothing at all.

    Deployed environments must therefore set APP_BASE_URL to the public frontend origin.
    """
    base = settings.app_base_url.rstrip("/")
    # Mail clients cannot fetch localhost; a text wordmark stands in until there is a public origin.
    return (
        f"{base}/brand/codeforge-lockup-{variant}-email.png"
        if base.startswith("https://")
        else None
    )


def _brand(variant: str) -> str:
    """`light` is ink on paper (the header); `dark` is paper on ink (the footer)."""
    url = _logo_url(variant)
    if url:
        return (
            f'<img src="{escape(url, quote=True)}" alt="CodeForge" width="150" '
            'style="display:block;width:150px;height:auto;border:0;outline:none;text-decoration:none;">'
        )
    color = _INK if variant == "light" else _PAPER
    return f'<span style="font-family:{_SERIF};font-size:26px;letter-spacing:-0.01em;color:{color};">CodeForge</span>'


def _footer(*, to: str, reason: str) -> str:
    base = escape(settings.app_base_url.rstrip("/"), quote=True)
    link = f"font-family:{_SANS};font-size:13px;color:{_FOOT_TEXT};text-decoration:none;"
    links = " &nbsp;&middot;&nbsp; ".join(
        f'<a href="{base}{path}" style="{link}">{label}</a>'
        for label, path in (
            ("Projects", "/projects"),
            ("How it works", "/how-it-works"),
            ("Contact", "/contact"),
        )
    )
    small = f"font-family:{_SANS};font-size:12.5px;line-height:1.7;color:{_FOOT_FAINT};"
    return f"""<tr><td class="cf-gutter" style="padding:44px {_GUTTER}px 40px {_GUTTER}px;background:{_INK};">
  <a href="{base}" style="display:inline-block;text-decoration:none;">{_brand("dark")}</a>
  <p style="margin:14px 0 0;font-family:{_SERIF};font-size:17px;line-height:1.4;color:{_FOOT_TEXT};">From idea to tested API.</p>
  <p style="margin:22px 0 0;">{links}</p>
  <div style="margin:26px 0 0;height:1px;line-height:1px;font-size:0;background:{_FOOT_HAIR};">&nbsp;</div>
  <p style="margin:22px 0 0;{small}">&copy; {datetime.now(UTC).year} CodeForge. Five agents, one sandbox, you in control.</p>
  <p style="margin:12px 0 0;{small}">This email was sent to {escape(to)}. {escape(reason)}</p>
</td></tr>"""


def _html(*, title: str, preheader: str, blocks: list[Block], to: str, reason: str) -> str:
    body = "\n".join(_HTML_RENDERERS[type(block)](block) for block in blocks)
    # The preheader is the grey line an inbox shows after the subject; hidden in the message itself.
    hidden = (
        "display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;"
        "font-size:1px;line-height:1px;color:transparent;"
    )
    home = escape(settings.app_base_url.rstrip("/"), quote=True)
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{escape(title)}</title>
<style>
  /* Progressive: clients that read media queries (Apple Mail, iOS, the Gmail apps) narrow the
     side padding on phones; the rest keep the inline desktop padding, which still fits. */
  @media only screen and (max-width: 480px) {{
    .cf-gutter {{ padding-left: 24px !important; padding-right: 24px !important; }}
    .cf-title {{ font-size: 28px !important; }}
  }}
</style></head>
<body style="margin:0;padding:0;background:{_PAGE};">
<div style="{hidden}">{escape(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{_PAGE};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:{_PAPER};">
    <tr><td class="cf-gutter" style="padding:44px {_GUTTER}px 0 {_GUTTER}px;">
      <a href="{home}" style="display:inline-block;text-decoration:none;">{_brand("light")}</a>
    </td></tr>
    <tr><td class="cf-gutter" style="padding:40px {_GUTTER}px 0 {_GUTTER}px;">
      <h1 class="cf-title" style="margin:0;font-family:{_SERIF};font-size:32px;font-weight:400;line-height:1.15;letter-spacing:-0.015em;color:{_INK};">{escape(title)}</h1>
    </td></tr>
{body}
    <tr><td style="height:48px;line-height:48px;font-size:0;">&nbsp;</td></tr>
{_footer(to=to, reason=reason)}
  </table>
</td></tr>
</table>
</body>
</html>"""


def _text(*, title: str, blocks: list[Block], to: str, reason: str) -> str:
    chunks = [_TEXT_RENDERERS[type(block)](block) for block in blocks]
    footer = (
        f"--\nCodeForge · From idea to tested API.\n{settings.app_base_url.rstrip('/')}\n\n"
        f"This email was sent to {to}. {reason}"
    )
    return "\n\n".join([title, *[chunk for chunk in chunks if chunk], footer]) + "\n"


def _render(
    *, subject: str, title: str, preheader: str, blocks: list[Block], to: str, reason: str
) -> RenderedEmail:
    return RenderedEmail(
        subject=subject,
        text=_text(title=title, blocks=blocks, to=to, reason=reason),
        html=_html(title=title, preheader=preheader, blocks=blocks, to=to, reason=reason),
    )


def _hello(first_name: str) -> Para:
    name = first_name.strip()
    return Para(f"Hello {name}," if name else "Hello,")


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def _app(path: str) -> str:
    return f"{settings.app_base_url.rstrip('/')}{path}"


# --------------------------------------------------------------------------- #
# Messages
# --------------------------------------------------------------------------- #
def verification_code(*, to: str, code: str, minutes: int, first_name: str = "") -> RenderedEmail:
    return _render(
        subject=f"{code} is your CodeForge verification code",
        title="Confirm your email",
        preheader=f"Enter this code to finish creating your account. It expires in {minutes} minutes.",
        blocks=[
            _hello(first_name),
            Para("Use this code to finish creating your CodeForge account."),
            Code(code),
            Para(
                f"It expires in {minutes} minutes and works once. Enter it on the page where you signed up.",
                small=True,
            ),
            Rule(),
            Heading("Didn’t sign up?"),
            Para("You can ignore this email. No account is created until the code is entered."),
        ],
        to=to,
        reason="You’re receiving it because this address was used to sign up for CodeForge.",
    )


def password_reset(*, to: str, reset_url: str, minutes: int, first_name: str = "") -> RenderedEmail:
    return _render(
        subject="Reset your CodeForge password",
        title="Reset your password",
        preheader=f"Choose a new password. The link works once and expires in {minutes} minutes.",
        blocks=[
            _hello(first_name),
            Para(
                "We received a request to reset the password for your CodeForge account. "
                "Choose a new one below."
            ),
            Button("Choose a new password", reset_url),
            Para(
                f"The link works once and expires in {minutes} minutes. "
                "Once you set a new password, you’re signed straight in.",
                small=True,
            ),
            LinkFallback(reset_url),
            Rule(),
            Heading("Didn’t ask for this?"),
            Para(
                "Ignore this email. Your password stays the same, and the link expires on its own."
            ),
        ],
        to=to,
        reason="You’re receiving it because a password reset was requested for this address.",
    )


def welcome(*, to: str, first_name: str = "") -> RenderedEmail:
    return _render(
        subject="Your CodeForge account is ready",
        title="Welcome to CodeForge",
        preheader="Describe an API in one sentence, then watch five agents build and test it.",
        blocks=[
            _hello(first_name),
            Para(
                "Your account is ready. CodeForge turns one plain-English sentence into a working, "
                "tested CRUD REST API, and shows you every step on the way."
            ),
            Heading("Your first build"),
            Steps(
                (
                    (
                        "Describe the API",
                        "One sentence is enough: the resources, their fields and how they relate.",
                    ),
                    (
                        "Approve the plan",
                        "You check the requirements and the design before any code is written.",
                    ),
                    (
                        "Watch it built and tested",
                        "Five agents write and review the code, then its tests run in an isolated sandbox.",
                    ),
                )
            ),
            Rule(),
            Heading("What to know"),
            Bullets(
                (
                    "Runs are free. CodeForge is built entirely on free-tier models.",
                    "Generated code runs in a sandbox with no network access.",
                    "When a test fails, the code goes back to be fixed, up to three times.",
                    "Every finished API can be tried in your browser and published from its run page.",
                )
            ),
            Button("Start your first project", _app("/projects")),
        ],
        to=to,
        reason="You’re receiving it because you created a CodeForge account.",
    )


def password_changed(*, to: str, when: str, first_name: str = "") -> RenderedEmail:
    return _render(
        subject="Your CodeForge password was changed",
        title="Your password was changed",
        preheader="Every other signed-in browser has been signed out.",
        blocks=[
            _hello(first_name),
            Para("The password on your CodeForge account was just changed."),
            Facts((("When", when), ("Other sessions", "Signed out on every other browser"))),
            Rule(),
            Heading("Wasn’t you?"),
            Para("Someone else may know your password. Reset it now to lock them out."),
            Button("Reset your password", _app("/forgot-password")),
        ],
        to=to,
        reason=_SECURITY_REASON,
    )


def security_alert(*, to: str, title: str, detail: str, when: str) -> RenderedEmail:
    return _render(
        subject=f"CodeForge security alert: {title}",
        title=title,
        preheader=detail,
        blocks=[
            Para("Hello,"),
            Para(detail),
            Facts((("When", when),)),
            Rule(),
            Heading("Not expected?"),
            Para(
                "Review your account security now, and change your password if anything looks wrong."
            ),
            Button("Review account security", _app("/profile/settings")),
        ],
        to=to,
        reason=_SECURITY_REASON,
    )


def platform_alert(*, to: str, title: str, detail: str, when: str) -> RenderedEmail:
    # Monitoring already prefixes its titles with "Platform alert:"; avoid saying it twice.
    already_labelled = title.lower().startswith("platform alert")
    return _render(
        subject=f"CodeForge {title[0].lower()}{title[1:]}"
        if already_labelled
        else f"CodeForge platform alert: {title}",
        title=title,
        preheader=detail,
        blocks=[
            Para("Platform monitoring raised an alert."),
            Facts((("Detail", detail), ("When", when))),
            Button("Open monitoring", _app("/admin/monitoring")),
            Para(
                "The backend logs have the full detail. Repeat alerts for the same issue are held back for a while.",
                small=True,
            ),
        ],
        to=to,
        reason="You’re receiving it as the administrator of this CodeForge instance.",
    )


def new_sign_in(
    *, to: str, label: str, ip_address: str | None, when: str, review_url: str
) -> RenderedEmail:
    return _render(
        subject="New sign-in to your CodeForge account",
        title="A new browser signed in",
        preheader="If this was you, there’s nothing to do.",
        blocks=[
            Para("Hello,"),
            Para(
                "Your CodeForge account was just signed in to from a browser we haven’t seen before."
            ),
            Facts(
                (("Browser", label), ("IP address", ip_address or "Unavailable"), ("When", when))
            ),
            Para("If this was you, there’s nothing to do."),
            Button("Review this sign-in", review_url),
            Rule(),
            Heading("Wasn’t you?"),
            Para("Open the review page to sign out every device, then reset your password."),
        ],
        to=to,
        reason=_SECURITY_REASON,
    )


def account_deleted(
    *, to: str, when: str, first_name: str = "", projects: int = 0, runs: int = 0
) -> RenderedEmail:
    return _render(
        subject="Your CodeForge account has been deleted",
        title="Your account has been deleted",
        preheader="Everything it owned has been permanently removed.",
        blocks=[
            _hello(first_name),
            Para("Your CodeForge account and everything it owned have been permanently deleted."),
            Facts(
                (
                    ("Projects", f"{_plural(projects, 'project')} deleted"),
                    ("Runs", f"{_plural(runs, 'run')} deleted"),
                    ("Generated files", "Deleted"),
                    ("When", when),
                )
            ),
            Rule(),
            Heading("What to know"),
            Bullets(
                (
                    "This can’t be undone. Your data was deleted, not archived.",
                    "This is the last email you’ll receive from CodeForge.",
                    "You’re welcome to sign up again with this address at any time.",
                    "If you didn’t delete your account, reply to this email.",
                )
            ),
        ],
        to=to,
        reason="It confirms the deletion of the account that used this address.",
    )


def contact_message(
    *, to: str, name: str, email: str, phone: str, message: str, when: str
) -> RenderedEmail:
    facts: list[tuple[str, str]] = [("From", name), ("Email", email)]
    if phone:
        facts.append(("Phone", phone))
    facts.append(("Sent", when))
    return _render(
        subject=f"CodeForge contact — {name}",
        title=f"{name} sent a message",
        preheader=message[:140],
        blocks=[
            Para("A new message arrived through the CodeForge contact form."),
            Facts(tuple(facts)),
            Heading("Message"),
            Quote(message),
            Para(f"Reply to this email to answer {name} directly.", small=True),
        ],
        to=to,
        reason="It was sent from the contact form on the CodeForge website.",
    )


def contact_ack(*, to: str, name: str, message: str) -> RenderedEmail:
    return _render(
        subject="We received your message — CodeForge",
        title="Thanks for getting in touch",
        preheader="We’ll reply within one or two working days.",
        blocks=[
            _hello(name),
            Para(
                "Thanks for writing to CodeForge. We’ve received your message and will reply "
                "within one or two working days."
            ),
            Heading("Your message"),
            Quote(message),
            Rule(),
            Heading("What to know"),
            Bullets(
                (
                    "There’s nothing else you need to do.",
                    "To add anything, reply to this email. It reaches the same inbox.",
                )
            ),
        ],
        to=to,
        reason="This address was used on the CodeForge contact form. If that wasn’t you, you can ignore it.",
    )


def recovery_invitation(*, to: str, url: str, hours: int = 24) -> RenderedEmail:
    return _render(
        subject="Request a recovery review · CodeForge",
        title="Request a recovery review",
        preheader=f"We reviewed your message about a lost authenticator. This link expires in {hours} hours.",
        blocks=[
            Para("Hello,"),
            Para(
                "We reviewed your support message about a lost authenticator. Open the form below "
                "and enter your registered email. Your request then joins our review queue."
            ),
            Button("Request a recovery review", url),
            Para(
                f"The link works once and expires in {hours} hours. It does not unlock your account by itself.",
                small=True,
            ),
            LinkFallback(url),
            Rule(),
            Heading("Keep your account safe"),
            Bullets(
                (
                    "Never email anyone your password or recovery codes, including us.",
                    "If you didn’t contact support, ignore this email.",
                )
            ),
        ],
        to=to,
        reason="You’re receiving it because you asked CodeForge support for help with two-factor sign-in.",
    )


def recovery_approved(*, to: str, url: str, minutes: int = 15) -> RenderedEmail:
    return _render(
        subject="Recover your CodeForge authenticator",
        title="Reconnect your authenticator",
        preheader=f"Your recovery request was approved. The link expires in {minutes} minutes.",
        blocks=[
            Para("Hello,"),
            Para(
                "Your recovery request was approved. Have your password and an unused recovery code "
                "ready, then connect a new authenticator."
            ),
            Button("Recover two-factor access", url),
            Para(f"The link works once and expires in {minutes} minutes.", small=True),
            LinkFallback(url),
            Rule(),
            Heading("Didn’t ask for this?"),
            Para(
                "Don’t use the link, and contact support. Never share your password or recovery codes with anyone."
            ),
        ],
        to=to,
        reason=_SECURITY_REASON,
    )
