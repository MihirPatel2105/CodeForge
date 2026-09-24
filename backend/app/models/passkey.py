"""Passkey credentials and short-lived, single-use authentication challenges."""

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class PasskeyCredential(Document):
    user_id: str
    credential_id: str
    public_key: str
    sign_count: int = 0
    label: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_used_at: datetime | None = None

    class Settings:
        name = "passkey_credentials"
        indexes = [
            IndexModel([("credential_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
        ]


class PasskeyChallenge(Document):
    challenge_id: str
    challenge: str
    purpose: str
    user_id: str | None = None
    expires_at: datetime
    attempts: int = 0
    token_version: int | None = None

    class Settings:
        name = "passkey_challenges"
        indexes = [
            IndexModel([("challenge_id", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
            IndexModel([("user_id", ASCENDING)]),
        ]
