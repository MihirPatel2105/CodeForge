"""Operator acknowledgements and bounded internal notes for grouped failures."""

from datetime import UTC, datetime
from typing import Literal

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.schemas.admin_operations import IncidentNote


class AdminIncident(Document):
    key: str
    status: Literal["open", "acknowledged", "resolved"] = "open"
    observed_at: datetime
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    notes: list[IncidentNote] = Field(default_factory=list)

    class Settings:
        name = "admin_incidents"
        indexes = [IndexModel([("key", ASCENDING)], unique=True)]
