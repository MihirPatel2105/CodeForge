from datetime import UTC, datetime

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import ASCENDING, IndexModel


class PasswordResetToken(Document):
    """A live invitation to set a new password, issued from "forgot password".

    The token that goes in the email link is a high-entropy random string — unlike the
    six-digit sign-up code, this one is never typed by a person, so there is no reason to
    keep it short. Only its hash is stored, exactly as with the OTP: a leaked database
    should not hand over usable reset links.

    Deleted on use rather than flagged used, so a second click on the same link (a common
    accident with email link-previewing and Outlook's Safe Links rewriting/prefetching)
    finds nothing and fails the same way an expired link does.
    """

    user_id: str
    email: EmailStr  # kept for the "which address" question without a join
    token_hash: str
    expires_at: datetime
    # UTC-aware, not the bare `datetime.now()` other models use for a purely
    # informational timestamp: this one is diffed against `_now()` for the resend
    # cooldown, and a naive local time compared against an aware UTC one silently
    # produces a negative elapsed on any host east of UTC — the cooldown would then
    # never appear to expire.
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "password_reset_tokens"
        indexes = [
            IndexModel([("user_id", ASCENDING)]),
            # Mongo deletes an unused, expired token itself — nothing is left around
            # for a leaked backup to find later.
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
