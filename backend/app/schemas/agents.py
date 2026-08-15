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

        # Case drift, then aliases — in that order, because a model that capitalises
        # `Path` also capitalises `Fix`, and matching the alias first would miss it.
        # Observed `{"Path": ..., "Content": ...}` from a Coder call, which failed
        # validation on both required fields at once.
        lowered = {k.lower(): k for k in data if isinstance(k, str)}

        for declared in cls.model_fields:
            if declared in data:
                continue
            source = lowered.get(declared.lower())
            if source is not None and source != declared:
                data[declared] = data[source]

        # Models also reach for the shorter, more natural word. The raw dict still carries
        # it even though it is not a declared field, so recover it rather than lose the
        # whole generation. Each pair below cost a real run during development.
        for emitted, declared in (("name", "path"), ("fix", "fix_hint")):
            if declared not in cls.model_fields or data.get(declared):
                continue
            source = lowered.get(emitted)
            if source is not None:
                data[declared] = data[source]
        return data


def _parses(source: str) -> bool:
    import ast

    try:
        ast.parse(source)
    except SyntaxError:
        return False
    return True


def _strip_fences(source: str) -> str:
    """Remove a wrapping ```python ... ``` block."""
    lines = source.strip().splitlines()
    if lines and lines[0].lstrip().startswith("```"):
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        return "\n".join(lines) + "\n"
    return source


def _strip_banner(source: str) -> str:
    """Remove an unterminated `'''filename.py` or `\"\"\"filename.py` opener."""
    lines = source.splitlines()
    if not lines:
        return source
    first = lines[0].strip()
    if first.startswith(("'''", '"""')):
        body = first[3:].strip()
        # A banner is a bare filename, not the start of a real docstring.
        if body and body.endswith(".py") and " " not in body:
            return "\n".join(lines[1:]) + "\n"
    return source


class GeneratedFile(AgentSchema):
    """One file in a generated application. Content is complete and runnable as written."""

    # Descriptions are carried into the tool schema the model sees. Without them, models
    # emit "name" instead of "path" and the provider rejects the whole tool call.
    path: str = Field(description="File name including extension, e.g. 'main.py'")
    content: str = Field(description="Complete file contents, runnable as written")

    @model_validator(mode="after")
    def _repair_wrapped_source(self) -> "GeneratedFile":
        """Undo two ways models wrap source in the content field.

        Observed in 5 of 10 generated trees: the model opens with a filename banner —
        `\'\'\'database.py` — that is never closed, so the file fails to parse at line 1
        even though the code below it is fine. Markdown fences are the same mistake in
        a different costume.

        Lives here rather than on `SingleFileOutput` so every path benefits: fresh
        generations, files replayed from the database, and artifacts alike.

        A repair is kept only if it turns unparseable source into parseable source, so
        this can never damage a file that was already correct.
        """
        if self.path.endswith(".py") and not _parses(self.content):
            for candidate in (_strip_fences(self.content), _strip_banner(self.content)):
                if candidate != self.content and _parses(candidate):
                    self.content = candidate
                    break
        return self


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


#: The generated-app file structure is fixed by docs/GENERATED_APP.md §1. The Architect
#: describes it; it does not get to invent it.
CANONICAL_FILES = ("database.py", "models.py", "schemas.py", "main.py")


class Design(AgentSchema):
    collections: list[Collection] = Field(min_length=1)
    endpoints: list[Endpoint] = Field(min_length=1)
    files: list[FileSpec] = Field(min_length=1)
    notes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _normalise_files(self) -> "Design":
        """Repair the file list before the Coder iterates it.

        Two failures seen in real runs, both caused by `FileSpec.path` being optional —
        which it has to be, because providers that validate server-side reject the call
        when a required field is missing:

        * every path came back empty, so each Coder call invented its own filename and
          the tree ended up with `database.py` twice and no `models.py`;
        * duplicates silently overwrote earlier files.

        Empty entries are dropped, duplicates collapsed, and an empty result falls back
        to the canonical four files.
        """
        seen: set[str] = set()
        cleaned: list[FileSpec] = []
        for spec in self.files:
            path = spec.path.strip()
            if not path or path in seen:
                continue
            seen.add(path)
            cleaned.append(FileSpec(path=path, purpose=spec.purpose))

        if not cleaned:
            cleaned = [FileSpec(path=p, purpose="") for p in CANONICAL_FILES]

        self.files = cleaned
        return self


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
    content: str = Field(
        description=(
            "Complete file contents. Raw source only: no markdown fences, no filename header"
        )
    )
    notes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _repair_then_require_valid_python(self) -> "SingleFileOutput":
        """Repair wrapped source, then refuse anything that still will not compile.

        Deliberately strict here and lenient on `GeneratedFile`. This model exists only
        at *generation* time, so raising makes Instructor re-ask with the syntax error
        attached, and failing that the chain drops to a rung with a larger token budget —
        which is exactly what a truncated file needs. `GeneratedFile` stays permissive so
        already-stored trees remain loadable for analysis and replay.
        """
        if not self.path.endswith(".py"):
            return self

        if not _parses(self.content):
            for candidate in (_strip_fences(self.content), _strip_banner(self.content)):
                if candidate != self.content and _parses(candidate):
                    self.content = candidate
                    break

        if not _parses(self.content):
            raise ValueError(
                f"{self.path} is not valid Python. Return the complete file; if it was cut "
                "short, write a shorter implementation rather than a truncated one."
            )
        return self

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
