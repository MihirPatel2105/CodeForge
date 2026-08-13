"""Sandbox execution contract — see `docs/STATE_AND_API.md` §5.

The runner is the only component that touches Docker; agents pass through these two
models and never see a container.
"""

from pydantic import BaseModel, Field

from app.schemas.agents import GeneratedFile


class SandboxRequest(BaseModel):
    run_id: str
    files: list[GeneratedFile] = Field(min_length=1)  # application code plus tests
    timeout_s: int = 120


class SandboxResult(BaseModel):
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    pytest_report: dict | None = None
    timed_out: bool = False
    duration_ms: int = 0
