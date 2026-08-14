"""Agent I/O schemas — the contract between SDLC phases.

Every inter-agent handoff is one of these models, produced through Instructor so the
LLM cannot return anything that does not validate. Specs: `docs/AGENTS.md`.

Two project rules are enforced structurally rather than by prompt text, because a
prompt can be ignored and a schema cannot:

* `Requirements.entities` is bounded to 1-2 (SRS §4 scope rule).
* `Endpoint.response_model` is required, so a design can never describe an endpoint
  that returns a raw Beanie document (CLAUDE.md §8, the predicted #1 failure mode).
"""

import json
from typing import Any, Literal, get_origin

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


class AgentSchema(BaseModel):
    """Base for every agent output.

    Free-tier models frequently hand back a *stringified* JSON array where a list is
    expected — `"[{\\"name\\": ...}]"` instead of `[{...}]` — especially for deeply nested
    fields. Observed on both Groq and OpenRouter; the models' own reasoning shows them
    trying and failing to correct it, so retrying is expensive and unreliable.

    Rather than flatten every schema, decode those strings here. Be liberal in what you
    accept: the alternative is a whole run lost to a quoting mistake.
    """

    @model_validator(mode="before")
    @classmethod
    def _decode_stringified_json(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        for name, value in list(data.items()):
            if not isinstance(value, str):
                continue

            stripped = value.strip()
            if stripped.startswith(("[", "{")):
                try:
                    data[name] = json.loads(stripped)
                    continue
                except (ValueError, TypeError):
                    # Usually truncated JSON: the model hit its token ceiling mid-array.
                    # Fall through rather than crash; the chain will try another model.
                    pass

            # A list field handed one bare string. Models do this for single-item
            # fields ("notes": "Defines the Document" instead of a list). Wrap it —
            # losing a whole generation over a missing pair of brackets is absurd.
            field = cls.model_fields.get(name)
            if field is not None and get_origin(field.annotation) is list:
                if not stripped.startswith("["):
                    data[name] = [value]

        # Models reach for the shorter, more natural name. The raw dict still carries it
        # here even though it is not a declared field, so recover it rather than lose the
        # whole generation. Each pair below cost a real run during development.
        for emitted, declared in (("name", "path"), ("fix", "fix_hint")):
            if declared in cls.model_fields and not data.get(declared) and data.get(emitted):
                data[declared] = data[emitted]
        return data


class GeneratedFile(AgentSchema):
    """One file in a generated application. Content is complete and runnable as written."""

    # Descriptions are carried into the tool schema the model sees. Without them, models
    # emit "name" instead of "path" and the provider rejects the whole tool call.
    path: str = Field(description="File name including extension, e.g. 'main.py'")
    content: str = Field(description="Complete file contents, runnable as written")


# --------------------------------------------------------------------------- #
# PM agent
# --------------------------------------------------------------------------- #


class EntityField(AgentSchema):
    """A single attribute of an entity.

    Named `EntityField` rather than `Field` to avoid shadowing `pydantic.Field`.
    """

    name: str
    type: FieldType
    required: bool = True
    default: str | None = None


class Entity(AgentSchema):
    name: str
    fields: list[EntityField] = Field(min_length=1)


class Requirements(AgentSchema):
    project_name: str
    summary: str
    entities: list[Entity] = Field(min_length=1, max_length=2)
    operations: list[CrudOperation] = Field(min_length=1)
    user_stories: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Architect agent
# --------------------------------------------------------------------------- #


class Collection(AgentSchema):
    """A Mongo collection in the design.

    Deliberately flat: `fields` and `indexes` are plain string arrays rather than nested
    objects. The nested form was the single most common cause of a rejected Design —
    providers that validate tool arguments server-side reject the whole call when a model
    writes `fields` as an object, and no amount of client-side leniency can help because
    the rejection happens before Pydantic runs.

    Nothing is lost: field *types* live on `Requirements.entities`, which is what the
    Coder actually reads. This records the storage shape for the report and the Reviewer,
    not the type system.
    """

    name: str
    # Optional on purpose: models often omit it, and it is inferable from `name`. A
    # required field the model reliably forgets costs a whole generation.
    entity: str = ""
    fields: list[str] = Field(default_factory=list)
    indexes: list[str] = Field(default_factory=list)


class Endpoint(AgentSchema):
    method: HttpMethod
    path: str
    summary: str = ""  # documentation only; not worth failing a generation over
    request_model: str | None = None  # None for GET and DELETE

    # Nullable in the schema the model sees, because a 204 genuinely has no response
    # body — requiring one there was a modelling error that made every correct DELETE
    # fail validation. The real rule is enforced below, where it actually applies.
    response_model: str | None = None
    status_code: int

    @model_validator(mode="after")
    def _require_response_model_when_there_is_a_body(self) -> "Endpoint":
        if self.status_code != 204 and not self.response_model:
            raise ValueError(
                f"{self.method} {self.path} returns {self.status_code} but declares no "
                "response_model; a raw Beanie Document would leak a non-serialisable "
                "ObjectId (CLAUDE.md §8)"
            )
        return self


class FileSpec(AgentSchema):
    # Optional in the emitted schema so a provider that validates server-side accepts
    # the call; `AgentSchema` recovers it from `name` when the model uses that instead.
    path: str = ""
    purpose: str = ""


class Design(AgentSchema):
    collections: list[Collection] = Field(min_length=1)
    endpoints: list[Endpoint] = Field(min_length=1)
    files: list[FileSpec] = Field(min_length=1)
    notes: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Coder agent
# --------------------------------------------------------------------------- #


class CodeOutput(AgentSchema):
    files: list[GeneratedFile] = Field(min_length=1)
    changelog: list[str] = Field(default_factory=list)  # populated on fix passes


class SingleFileOutput(AgentSchema):
    """One file, as a flat object.

    Free-tier models are unreliable at filling a nested `list[GeneratedFile]` in a single
    tool call — Groq's gpt-oss-120b repeatedly emits `name` instead of `path`, and the
    provider rejects the whole call server-side before Instructor can re-ask. A flat
    schema removes that failure mode, so the Coder emits one file per call.
    """

    path: str = Field(description="File name including extension, e.g. 'main.py'")
    content: str = Field(description="Complete file contents, runnable as written")
    notes: list[str] = Field(default_factory=list)

    def as_generated_file(self) -> GeneratedFile:
        return GeneratedFile(path=self.path, content=self.content)


# --------------------------------------------------------------------------- #
# Reviewer agent
# --------------------------------------------------------------------------- #


class Finding(AgentSchema):
    severity: Severity
    file: str = ""
    line: int | None = None
    issue: str
    # Optional in the emitted schema because providers that validate server-side reject
    # the whole review when a model writes "fix" instead; `AgentSchema` recovers it.
    fix_hint: str = ""


class ReviewResult(AgentSchema):
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


class TestOutput(AgentSchema):
    """Written by the Tester agent: test_main.py, plus conftest.py when needed."""

    files: list[GeneratedFile] = Field(min_length=1)


class TestFailure(AgentSchema):
    test_name: str
    assertion: str
    traceback_tail: str


class TestResult(AgentSchema):
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
