"""REST request/response models — see `docs/STATE_AND_API.md` §3.

Every route returns one of these, never a raw Beanie `Document`. Mongo's `_id` is an
`ObjectId` and is not JSON-serialisable, so `id` is always exposed as `str`. The rule
the Reviewer enforces on generated code applies to the platform itself.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.graph.state import ApprovalPhase, RunMetrics, RunStatus
from app.schemas.agents import GeneratedFile

# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime


# --------------------------------------------------------------------------- #
# Projects
# --------------------------------------------------------------------------- #


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Runs
# --------------------------------------------------------------------------- #


class RunCreate(BaseModel):
    project_id: str
    prompt: str = Field(min_length=1)
    rag_enabled: bool = True


class RunCreateResponse(BaseModel):
    """Returned immediately with 202; the graph executes in the background (FR-7)."""

    run_id: str
    status: RunStatus = "queued"


class RunSummary(BaseModel):
    """List view — omits the full state snapshot, which is large."""

    id: str
    project_id: str
    prompt: str
    status: RunStatus
    iterations: int = 0
    created_at: datetime
    updated_at: datetime


class RunResponse(BaseModel):
    id: str
    project_id: str
    prompt: str
    status: RunStatus
    state: dict[str, Any] = Field(default_factory=dict)
    metrics: RunMetrics | None = None
    created_at: datetime
    updated_at: datetime


class FileTreeResponse(BaseModel):
    run_id: str
    files: list[GeneratedFile] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Approvals
# --------------------------------------------------------------------------- #


class ApprovalRequest(BaseModel):
    phase: ApprovalPhase
    approved: bool
    note: str | None = None


class ApprovalResponse(BaseModel):
    run_id: str
    phase: ApprovalPhase
    approved: bool
    status: RunStatus  # resumed -> "running", refused -> "rejected"


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class ErrorDetail(BaseModel):
    code: str
    message: str
    run_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
