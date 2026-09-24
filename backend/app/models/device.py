from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class Device(Document):
    user_id: str
    device_hash: str
    label: str
    ip_address: str | None = None
    first_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "devices"
        indexes = [IndexModel([("user_id", ASCENDING), ("device_hash", ASCENDING)], unique=True)]
