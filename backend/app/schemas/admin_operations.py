"""Operator views with safe summaries and explicitly bounded actions."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.api import AdminRunSummary


class FailureGuidance(BaseModel):
    category: str
    stage: str
    explanation: str
    next_step: str


class AttentionItem(BaseModel):
    run: AdminRunSummary
    priority: Literal["urgent", "review", "recent"]
    reason: str
    waiting_minutes: int
    guidance: FailureGuidance | None = None


class AttentionResponse(BaseModel):
    checked_at: datetime
    total: int
    items: list[AttentionItem]


class IncidentUpdate(BaseModel):
    status: Literal["open", "acknowledged", "resolved"]
    note: str = Field(min_length=3, max_length=1000)

    @field_validator("note")
    @classmethod
    def nonempty(cls, value: str) -> str:
        if len(value.strip()) < 3:
            raise ValueError("Add a note with at least three characters.")
        return value.strip()


class IncidentNote(BaseModel):
    admin_email: str
    text: str
    at: datetime


class IncidentItem(BaseModel):
    key: str
    title: str
    count: int
    latest_at: datetime
    sample_run_id: str
    status: Literal["open", "acknowledged", "resolved"] = "open"
    notes: list[IncidentNote] = Field(default_factory=list)


class IncidentResponse(BaseModel):
    checked_at: datetime
    items: list[IncidentItem]


class AdminDeploymentItem(BaseModel):
    id: str
    run_id: str
    project_id: str
    project_name: str
    user_id: str
    user_email: str
    status: str
    created_at: datetime
    runtime_status: Literal["ready", "starting", "stopped", "missing", "unknown"] = "unknown"
    started_at: str | None = None
    memory_bytes: int | None = None
    memory_limit_bytes: int | None = None
    detail: str = "Runtime has not been checked."


class AdminDeploymentResponse(BaseModel):
    checked_at: datetime
    capacity: int
    items: list[AdminDeploymentItem]


class PeriodMetrics(BaseModel):
    runs: int = 0
    failed: int = 0
    succeeded: int = 0
    tokens: int = 0


class AdminTrends(BaseModel):
    checked_at: datetime
    days: int
    current: PeriodMetrics
    previous: PeriodMetrics


class AdminSupport(BaseModel):
    checked_at: datetime
    monthly_runs: int
    active_sessions: int
    failed_runs: int
    deployments: list[AdminDeploymentItem]
