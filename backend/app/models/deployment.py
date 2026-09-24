"""A published generated API and its server-side access credential."""

from datetime import UTC, datetime
from typing import Literal

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class Deployment(Document):
    run_id: str
    project_id: str
    user_id: str
    slot: int
    key_hash: str
    key_prefix: str
    status: Literal["active", "deleting"] = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "deployments"
        indexes = [
            IndexModel([("run_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)], unique=True),
            IndexModel([("slot", ASCENDING)], unique=True),
            IndexModel([("project_id", ASCENDING)]),
        ]
