"""Artifact storage contract — GridFS bucket for run outputs.

See `docs/STATE_AND_API.md` §2. Artifacts are the durable record of a run: the generated
file tree, the sandbox logs, and the pytest report. They live in GridFS rather than in the
run document because a file tree plus full logs comfortably exceeds Mongo's 16 MB document
limit, and because they are fetched rarely and whole.

The bucket itself is opened in `db/`; this module defines only the naming and metadata
contract, so producers and consumers agree without importing each other.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ARTIFACT_BUCKET = "artifacts"

ArtifactKind = Literal[
    "file_tree",  # zipped generated application + tests
    "sandbox_log",  # combined stdout/stderr from the container
    "pytest_report",  # structured test report as JSON
]

# Extension per kind, so a downloaded artifact opens in the right application.
ARTIFACT_SUFFIX: dict[str, str] = {
    "file_tree": ".zip",
    "sandbox_log": ".log",
    "pytest_report": ".json",
}


class ArtifactMetadata(BaseModel):
    """Stored as the GridFS file's `metadata` document. Every artifact is scoped to a run
    and to the loop iteration that produced it, so successive fix passes do not overwrite
    each other's evidence."""

    run_id: str
    kind: ArtifactKind
    iteration: int = 0
    content_type: str = "application/octet-stream"
    created_at: datetime = Field(default_factory=datetime.now)


class ArtifactRef(BaseModel):
    """Returned by the API; `file_id` is the GridFS id rendered as a string, never an
    ObjectId (docs/GENERATED_APP.md rule 2 applies to the platform too)."""

    file_id: str
    filename: str
    kind: ArtifactKind
    iteration: int = 0
    length: int = 0
    created_at: datetime


class ArtifactListResponse(BaseModel):
    run_id: str
    artifacts: list[ArtifactRef] = Field(default_factory=list)


def artifact_filename(run_id: str, kind: ArtifactKind, iteration: int = 0) -> str:
    """Deterministic name so an artifact can be located from a run id alone."""
    return f"{run_id}/{kind}_iter{iteration}{ARTIFACT_SUFFIX[kind]}"
