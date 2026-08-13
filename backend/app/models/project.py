from datetime import datetime

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class Project(Document):
    user_id: str  # owner; every query is scoped by this (NFR-3)
    name: str
    description: str = ""
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "projects"
        indexes = [IndexModel([("user_id", ASCENDING)])]
