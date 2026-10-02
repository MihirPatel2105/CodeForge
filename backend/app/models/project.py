from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel


class Project(Document):
    user_id: str  # owner; every query is scoped by this (NFR-3)
    name: str
    description: str = ""
    archived: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "projects"
        indexes = [
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("user_id", ASCENDING), ("_id", DESCENDING)]),
        ]
