"""REST request/response models — see `docs/STATE_AND_API.md` §3.

Every route returns one of these, never a raw Beanie `Document`. Mongo's `_id` is an
`ObjectId` and is not JSON-serialisable, so `id` is always exposed as `str`. The rule
the Reviewer enforces on generated code applies to the platform itself.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.graph.state import ApprovalPhase, RunMetrics, RunStatus
from app.schemas.agents import GeneratedFile

# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #


# Kept as data so the sign-up form and this validator cannot drift: the frontend ticks
# these off live as the user types, and the same four decide whether the request is
# accepted. The minimum stays at 8 — the reference design said 6, but relaxing an
# existing control to match a mockup would be a step backwards.
PASSWORD_RULES: tuple[tuple[str, str], ...] = (
    ("length", "at least 8 characters"),
    ("uppercase", "one uppercase letter (A-Z)"),
    ("lowercase", "one lowercase letter (a-z)"),
    ("number", "one number (0-9)"),
)


def password_failures(value: str) -> list[str]:
    """Which rules `value` does not satisfy, in the order they are shown on screen."""
    checks = {
        "length": len(value) >= 8,
        "uppercase": any(c.isupper() for c in value),
        "lowercase": any(c.islower() for c in value),
        "number": any(c.isdigit() for c in value),
    }
    return [label for key, label in PASSWORD_RULES if not checks[key]]


# Shared field rules. Enforced here as well as in the browser: the frontend filters as
# you type, but that is a courtesy the client can simply not run.
_NAME_EXTRAS = " -'\u2019"


def validated_name(value: str) -> str:
    """Letters, spaces, hyphens and apostrophes.

    `str.isalpha()` is Unicode-aware, so non-Latin alphabets and accented characters
    pass. Hyphen and apostrophe are allowed because they appear in real names and
    rejecting them would lock people out of an account over punctuation; digits and
    every other symbol are refused.
    """
    cleaned = " ".join(value.split())
    if cleaned and any(not (char.isalpha() or char in _NAME_EXTRAS) for char in cleaned):
        raise ValueError("Names use letters only — no numbers or symbols.")
    return cleaned


class RegisterRequest(BaseModel):
    # Required, because an account with no name gives the dashboard nothing to greet.
    first_name: str = Field(max_length=80)
    # Optional on purpose: plenty of people have one name, and a required surname would
    # simply lock them out.
    last_name: str = Field(default="", max_length=80)
    email: EmailStr
    password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def _letters_only(cls, value: str) -> str:
        return validated_name(value)

    @field_validator("first_name")
    @classmethod
    def _first_name_not_blank(cls, value: str) -> str:
        # Checked after trimming, so a field of spaces cannot slip past `min_length`.
        if not value:
            raise ValueError("First name is required.")
        return value

    @field_validator("password")
    @classmethod
    def _meets_complexity(cls, value: str) -> str:
        missing = password_failures(value)
        if missing:
            raise ValueError("Password needs " + ", ".join(missing) + ".")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    """The answer to a sign-up, which no longer always ends in a session.

    `access_token` is present only when the server has email verification switched off;
    otherwise the client has a code to collect first. One response model rather than two
    routes returning different shapes, so the frontend branches on the data instead of
    on which server it is talking to.
    """

    email: EmailStr
    verification_required: bool
    access_token: str | None = None
    # When the current code stops being accepted. Drives the resend countdown.
    expires_at: datetime | None = None


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)

    @field_validator("code")
    @classmethod
    def _digits_only(cls, value: str) -> str:
        # Spaces get pasted in from mail clients that break the code up for readability.
        cleaned = value.strip().replace(" ", "").replace("-", "")
        if not cleaned.isdigit():
            raise ValueError("The code is digits only.")
        return cleaned


class ResendCodeRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Always the same shape, whether or not the address has an account.

    The route it comes back from must answer identically either way — a different
    response for an unknown address turns "forgot password" into a way to check who has
    signed up. See the route's docstring for the same reasoning applied to timing.
    """

    message: str = "If that address has an account, a reset link is on its way."


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _meets_complexity(cls, value: str) -> str:
        missing = password_failures(value)
        if missing:
            raise ValueError("Password needs " + ", ".join(missing) + ".")
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _meets_complexity(cls, value: str) -> str:
        # The same four rules registration enforces. Letting an existing account move to
        # a weaker password than a new one is allowed would make the rules decorative.
        missing = password_failures(value)
        if missing:
            raise ValueError("Password needs " + ", ".join(missing) + ".")
        return value


# Typed rather than clicked: a confirmation dialog you can dismiss with one button is
# too easy to get through by reflex, and this action cannot be undone.
DELETE_CONFIRMATION = "DELETE"


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str

    @field_validator("confirmation")
    @classmethod
    def _must_be_typed_exactly(cls, value: str) -> str:
        if value.strip() != DELETE_CONFIRMATION:
            raise ValueError(f"Type {DELETE_CONFIRMATION} to confirm.")
        return value.strip()


class DeleteAccountResponse(BaseModel):
    """What was removed. Shown back to the user, and worth having in the logs: a
    deletion that silently removed nothing would otherwise look identical to one that
    worked."""

    projects_deleted: int
    runs_deleted: int
    artifacts_deleted: int


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str = ""
    last_name: str = ""
    created_at: datetime

    @property
    def display_name(self) -> str:
        """What the header greets the user by, falling back to the email for accounts
        created before names were collected."""
        full = " ".join(part for part in (self.first_name, self.last_name) if part)
        return full or self.email


# --------------------------------------------------------------------------- #
# Projects
# --------------------------------------------------------------------------- #


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Runs
# --------------------------------------------------------------------------- #


class ProjectDeleteResponse(BaseModel):
    """What the cascade actually removed.

    Reported rather than returning 204, for the same reason `DeleteAccountResponse`
    does: a deletion that silently removed nothing looks identical to one that worked.
    """

    runs_deleted: int
    artifacts_deleted: int


class RunCreate(BaseModel):
    project_id: str
    prompt: str = Field(min_length=1)
    rag_enabled: bool = True


class RunCreateResponse(BaseModel):
    """Returned immediately with 202; the graph executes in the background (FR-7)."""

    run_id: str
    status: RunStatus = "queued"


class RunSummary(BaseModel):
    """List view — omits the full state snapshot, which is large."""

    id: str
    project_id: str
    prompt: str
    status: RunStatus
    iterations: int = 0
    created_at: datetime
    updated_at: datetime


class RunResponse(BaseModel):
    id: str
    project_id: str
    prompt: str
    status: RunStatus
    state: dict[str, Any] = Field(default_factory=dict)
    metrics: RunMetrics | None = None
    created_at: datetime
    updated_at: datetime


class FileTreeResponse(BaseModel):
    run_id: str
    files: list[GeneratedFile] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Approvals
# --------------------------------------------------------------------------- #


class ApprovalRequest(BaseModel):
    phase: ApprovalPhase
    approved: bool
    note: str | None = None


class ApprovalResponse(BaseModel):
    run_id: str
    phase: ApprovalPhase
    approved: bool
    status: RunStatus  # resumed -> "running", refused -> "rejected"


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class ErrorDetail(BaseModel):
    code: str
    message: str
    run_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# --------------------------------------------------------------------------- #
# Contact
# --------------------------------------------------------------------------- #
class ContactRequest(BaseModel):
    """One message from the contact form.

    Carries no name or email. The route reads both from the authenticated account, so a
    sender cannot claim to be someone else, and the reply address is one the server has
    already verified. An earlier version accepted them in the body and pre-filled the
    form from the profile — which meant anyone could type any address into a mail our
    server would then send.
    """

    # Stored and forwarded as typed, dial code included. Optional: the form asks for it
    # only in case a reply by phone would be quicker.
    phone: str = Field(default="", max_length=24)
    message: str = Field(min_length=1, max_length=500)

    @field_validator("phone", "message")
    @classmethod
    def _trimmed(cls, value: str) -> str:
        return value.strip()

    @field_validator("phone")
    @classmethod
    def _digits_and_dial_code(cls, value: str) -> str:
        """Digits, with the dial code the form sends in front of them.

        The number field itself accepts nothing but digits; what arrives here is that
        joined to its dial code, so a leading `+` and the separating space are the only
        non-digits allowed. No letters, which is what stops the field being used as a
        second message box.
        """
        if not value:
            return value
        if not all(char.isdigit() or char in "+ -" for char in value):
            raise ValueError("Phone numbers use digits only.")
        if sum(char.isdigit() for char in value) < 8:
            raise ValueError("That phone number looks too short.")
        return value


class ContactResponse(BaseModel):
    message: str = "Thanks — your message is on its way. We reply to the address you gave."
