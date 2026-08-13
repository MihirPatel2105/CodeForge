"""Agent I/O schemas — the contract between SDLC phases.

Every inter-agent handoff is one of these models, produced through Instructor so the
LLM cannot return anything that does not validate. Specs: `docs/AGENTS.md`.

Two project rules are enforced structurally rather than by prompt text, because a
prompt can be ignored and a schema cannot:

* `Requirements.entities` is bounded to 1-2 (SRS §4 scope rule).
* `Endpoint.response_model` is required, so a design can never describe an endpoint
  that returns a raw Beanie document (CLAUDE.md §8, the predicted #1 failure mode).
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Restricted to what the generated Beanie documents are allowed to declare
# (docs/AGENTS.md, PM prompt rules).
FieldType = Literal["str", "int", "float", "bool", "datetime", "list[str]"]

CrudOperation = Literal["create", "read", "update", "delete"]

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]

Severity = Literal["blocking", "warning", "nit"]


# --------------------------------------------------------------------------- #
# Shared
# --------------------------------------------------------------------------- #


class GeneratedFile(BaseModel):
    """One file in a generated application. Content is complete and runnable as written."""

    path: str
    content: str


# --------------------------------------------------------------------------- #
# PM agent
# --------------------------------------------------------------------------- #


class EntityField(BaseModel):
    """A single attribute of an entity.

    Named `EntityField` rather than `Field` to avoid shadowing `pydantic.Field`.
    """

    name: str
    type: FieldType
    required: bool = True
    default: str | None = None


class Entity(BaseModel):
    name: str
    fields: list[EntityField] = Field(min_length=1)


class Requirements(BaseModel):
    project_name: str
    summary: str
    entities: list[Entity] = Field(min_length=1, max_length=2)
    operations: list[CrudOperation] = Field(min_length=1)
    user_stories: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Architect agent
# --------------------------------------------------------------------------- #


class IndexSpec(BaseModel):
    fields: list[str] = Field(min_length=1)
    unique: bool = False


class Collection(BaseModel):
    name: str
    entity: str  # the Requirements.entities[*].name this collection stores
    fields: list[EntityField] = Field(min_length=1)
    indexes: list[IndexSpec] = Field(default_factory=list)


class Endpoint(BaseModel):
    method: HttpMethod
    path: str
    summary: str
    request_model: str | None = None  # None for GET and DELETE
    response_model: str  # required by design; see module docstring
    status_code: int


class FileSpec(BaseModel):
    path: str
    purpose: str


class Design(BaseModel):
    collections: list[Collection] = Field(min_length=1)
    endpoints: list[Endpoint] = Field(min_length=1)
    files: list[FileSpec] = Field(min_length=1)
    notes: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Coder agent
# --------------------------------------------------------------------------- #


class CodeOutput(BaseModel):
    files: list[GeneratedFile] = Field(min_length=1)
    changelog: list[str] = Field(default_factory=list)  # populated on fix passes


# --------------------------------------------------------------------------- #
# Reviewer agent
# --------------------------------------------------------------------------- #


class Finding(BaseModel):
    severity: Severity
    file: str
    line: int | None = None
    issue: str
    fix_hint: str


class ReviewResult(BaseModel):
    findings: list[Finding] = Field(default_factory=list)
    passed: bool = True

    @model_validator(mode="after")
    def derive_passed(self) -> "ReviewResult":
        # Recomputed rather than trusted: a model that lists blocking findings and
        # still reports passed=True would silently skip the fix pass.
        self.passed = not any(f.severity == "blocking" for f in self.findings)
        return self

    @property
    def blocking(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "blocking"]


# --------------------------------------------------------------------------- #
# Tester agent
# --------------------------------------------------------------------------- #


class TestOutput(BaseModel):
    """Written by the Tester agent: test_main.py, plus conftest.py when needed."""

    files: list[GeneratedFile] = Field(min_length=1)


class TestFailure(BaseModel):
    test_name: str
    assertion: str
    traceback_tail: str


class TestResult(BaseModel):
    """Parsed from the sandbox pytest report — produced by execution, not by an LLM."""

    passed: bool
    total: int = 0
    failed: int = 0
    failures: list[TestFailure] = Field(default_factory=list)
    stdout_tail: str = ""

    @property
    def pass_ratio(self) -> float:
        # docs/ACCEPTANCE.md: runs that never executed tests record 0.0, never null.
        if self.total <= 0:
            return 0.0
        return (self.total - self.failed) / self.total
