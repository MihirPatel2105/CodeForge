"""One-time MFA recovery codes stored separately for atomic consumption."""

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class RecoveryCode(Document):
    user_id: str
    code_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "recovery_codes"
        indexes = [
            IndexModel([("code_hash", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
        ]
