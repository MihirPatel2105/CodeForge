"""Durable record of every state-changing administrator action."""

from datetime import UTC, datetime
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel


class AdminAuditLog(Document):
    admin_user_id: str
    admin_email: str
    action: str
    target_type: str
    target_id: str
    reason: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "admin_audit_logs"
        indexes = [
            IndexModel([("created_at", DESCENDING)]),
            IndexModel([("action", ASCENDING)]),
            IndexModel([("target_id", ASCENDING)]),
        ]
