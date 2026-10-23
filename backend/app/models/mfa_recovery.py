"""Admin-reviewed MFA recovery; only hashed, scoped bearer tokens are persisted."""

from datetime import UTC, datetime
from typing import Literal

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class MfaRecovery(Document):
    user_id: str
    status: Literal[
        "inviting",
        "invited",
        "pending",
        "sending",
        "approved",
        "verifying",
        "setup",
        "completing",
        "completed",
        "rejected",
    ] = "pending"
    token_hash: str | None = None
    token_version: int
    secret_encrypted: str | None = None
    attempts: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime

    class Settings:
        name = "mfa_recoveries"
        indexes = [
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("token_hash", ASCENDING)], sparse=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
