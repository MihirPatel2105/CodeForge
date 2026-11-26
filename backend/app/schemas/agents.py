"""Agent I/O schemas — the contract between SDLC phases.

Every inter-agent handoff is one of these models, produced through Instructor so the
LLM cannot return anything that does not validate. Specs: `docs/AGENTS.md`.

Two project rules are enforced structurally rather than by prompt text, because a
prompt can be ignored and a schema cannot:

* `Requirements.entities` is bounded to 1-2 (SRS §4 scope rule).
* `Endpoint.response_model` is required, so a design can never describe an endpoint
  that returns a raw Beanie document (CLAUDE.md §8, the predicted #1 failure mode).
"""

import ast
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


def _duplicates_document_id(source: str) -> bool:
    """Catch `id=str(doc.id), **doc.model_dump()` before the route reaches pytest."""
    import ast

    def excludes_id(node: ast.AST) -> bool:
        if isinstance(node, (ast.Set, ast.List, ast.Tuple)):
            return any(isinstance(item, ast.Constant) and item.value == "id" for item in node.elts)
        if isinstance(node, ast.Dict):
            return any(
                isinstance(key, ast.Constant)
                and key.value == "id"
                and isinstance(value, ast.Constant)
                and (value.value is True or value.value is Ellipsis)
                for key, value in zip(node.keys, node.values, strict=True)
            )
        return False

    tree = ast.parse(source)
    for call in ast.walk(tree):
        if not isinstance(call, ast.Call):
            continue
        id_arg = next((kw for kw in call.keywords if kw.arg == "id"), None)
        if id_arg is None or not isinstance(id_arg.value, ast.Call):
            continue
        string_call = id_arg.value
        if (
            not isinstance(string_call.func, ast.Name)
            or string_call.func.id != "str"
            or len(string_call.args) != 1
            or not isinstance(string_call.args[0], ast.Attribute)
            or string_call.args[0].attr != "id"
        ):
            continue
        document = string_call.args[0].value
        for unpack in (kw.value for kw in call.keywords if kw.arg is None):
            if (
                not isinstance(unpack, ast.Call)
                or not isinstance(unpack.func, ast.Attribute)
                or unpack.func.attr != "model_dump"
                or ast.dump(unpack.func.value) != ast.dump(document)
            ):
                continue
            id_is_excluded = any(
                kw.arg == "exclude" and excludes_id(kw.value) for kw in unpack.keywords
            )
            if not id_is_excluded:
                return True
    return False


_ROUTE_DECORATORS = frozenset({"get", "post", "put", "patch", "delete"})


def _normalise_route_path(path: str) -> str:
    return path.rstrip("/") or "/"


def _collection_base(path: str) -> str | None:
    """`/contacts/{contact_id}` -> `/contacts`; None when the path has no item segment."""
    head, separator, _ = path.partition("/{")
    if not separator or not head.strip("/"):
        return None
    return _normalise_route_path(head)


def _missing_list_routes(routes: list[tuple[str, str]]) -> list[str]:
    """Collection paths that have item routes but no `GET` list route, in first-seen order.

    A collection is only usable — by a client, or by the downloaded admin UI, which
    discovers collections from their list routes — when its records can be listed.
    """
    listed = {
        _normalise_route_path(path)
        for method, path in routes
        if method == "GET" and "{" not in path
    }
    bases = dict.fromkeys(base for _, path in routes if (base := _collection_base(path)))
    return [base for base in bases if base not in listed]


def _router_prefixes(tree: ast.AST) -> dict[str, str]:
    """`{"router": "/contacts"}` for each `router = APIRouter(prefix="/contacts")`."""
    prefixes: dict[str, str] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
            continue
        func = node.value.func
        name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", None)
        if name != "APIRouter":
            continue
        prefix = next(
            (
                kw.value.value
                for kw in node.value.keywords
                if kw.arg == "prefix"
                and isinstance(kw.value, ast.Constant)
                and isinstance(kw.value.value, str)
            ),
            "",
        )
        for target in node.targets:
            if isinstance(target, ast.Name):
                prefixes[target.id] = prefix
    return prefixes


def _declared_routes(source: str) -> list[tuple[str, str]]:
    """`(METHOD, path)` for every `@app.get(...)`-style route decorator in `source`.

    Applies a prefix declared on `APIRouter(prefix=...)` in the same module. A prefix
    added elsewhere, at `include_router`, is unknown here; such routes then look like
    `/{id}` with no collection segment and are skipped rather than guessed at.
    """
    tree = ast.parse(source)
    prefixes = _router_prefixes(tree)
    routes: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        for decorator in node.decorator_list:
            if (
                not isinstance(decorator, ast.Call)
                or not isinstance(decorator.func, ast.Attribute)
                or decorator.func.attr not in _ROUTE_DECORATORS
                or not isinstance(decorator.func.value, ast.Name)
                or not decorator.args
                or not isinstance(decorator.args[0], ast.Constant)
                or not isinstance(decorator.args[0].value, str)
            ):
                continue
            prefix = prefixes.get(decorator.func.value.id, "")
            routes.append((decorator.func.attr.upper(), prefix + decorator.args[0].value))
    return routes


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


def _is_pytest_module(path: str) -> bool:
    """Whether pytest would collect `path` as a test module.

    `conftest.py` is support code and legitimately defines no tests, so it is excluded.
    """
    name = path.rsplit("/", 1)[-1]
    return name.startswith("test_") and name.endswith(".py")


def _defines_a_test(source: str) -> bool:
    """Whether the module defines at least one function pytest would collect.

    Walks the tree rather than scanning text, so a `test_` mentioned in a comment or a
    string never counts, and methods on a `TestFoo` class do.
    """
    import ast

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return False
    return any(
        isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.name.startswith("test")
        for node in ast.walk(tree)
    )


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


def _is_list_model(model: str) -> bool:
    return model.replace(" ", "").lower().startswith("list[")


def _as_list_route(endpoint: Endpoint) -> Endpoint:
    """A collection GET naming a single-record model returns a list of it.

    The Coder copies the design's response_model verbatim, and a list route typed as
    one record either fails at runtime or — worse for the admin UI, which only treats a
    route returning an array as a collection — hides the collection entirely.
    """
    model = endpoint.response_model
    if (
        endpoint.method != "GET"
        or "{" in endpoint.path
        or _normalise_route_path(endpoint.path) == "/"
        or not model
        or _is_list_model(model)
    ):
        return endpoint
    return endpoint.model_copy(update={"response_model": f"list[{model}]"})


def _list_route_position(endpoints: list[Endpoint], base: str) -> int:
    """Just after the collection's own routes (e.g. `POST /contacts`), else before its
    first item route — so the design still reads collection by collection."""
    collection_routes = [
        i for i, e in enumerate(endpoints) if _normalise_route_path(e.path) == base
    ]
    if collection_routes:
        return collection_routes[-1] + 1
    return next(i for i, e in enumerate(endpoints) if _collection_base(e.path) == base)


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

    @model_validator(mode="after")
    def _add_missing_list_routes(self) -> "Design":
        """Give every collection with item routes its `GET` list route.

        Observed live: a contacts design had create, get, update and delete but no
        `GET /contacts`. Every downstream agent follows the design exactly, so the
        generated app passed all its tests and still could not list a single record —
        and the downloaded admin UI, which discovers collections from list routes,
        showed none. The route is fully determined by the design, so it is added here
        rather than spending a re-ask (and free-tier quota) on it.
        """
        missing = _missing_list_routes([(e.method, e.path) for e in self.endpoints])
        endpoints = list(self.endpoints)
        for base in missing:
            item_model = self._item_response_model(base)
            if item_model is None:
                raise ValueError(
                    f"{base} has item routes but no GET {base} list route, and no response "
                    f"model to build one from. Add GET {base} returning list[<read schema>]."
                )
            listing = Endpoint(
                method="GET",
                path=base,
                summary=f"List all {base.rsplit('/', 1)[-1]}",
                response_model=f"list[{item_model}]",
                status_code=200,
            )
            endpoints.insert(_list_route_position(endpoints, base), listing)
        self.endpoints = [_as_list_route(e) for e in endpoints]
        return self

    def _item_response_model(self, base: str) -> str | None:
        """The read schema for one record: the item GET's, else the create route's.

        Nothing else qualifies — a 200 DELETE's `MessageResponse` is not a record.
        """
        for method, is_item in (("GET", True), ("POST", False)):
            for e in self.endpoints:
                path_matches = (
                    _collection_base(e.path) == base
                    if is_item
                    else _normalise_route_path(e.path) == base
                )
                if (
                    e.method == method
                    and path_matches
                    and ("{" in e.path) == is_item
                    and e.response_model
                    and not _is_list_model(e.response_model)
                ):
                    return e.response_model
        return None


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

    Kept to exactly the two fields that are actually consumed. There was a third,
    `notes`, optional and read by nothing: Groq validates tool arguments server-side and
    demands every declared property regardless of whether it has a default, so a model
    that omitted it had its entire call rejected. Observed live 2026-08-19: a complete,
    correct 8-test suite was discarded with "missing properties: 'notes'" — a perfect
    generation thrown away over a field no code ever read. Every property here is one
    more thing a free-tier model can omit, so this schema stays minimal.
    """

    path: str = Field(description="File name including extension, e.g. 'main.py'")
    content: str = Field(
        description=(
            "Complete file contents. Raw source only: no markdown fences, no filename header"
        )
    )

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

        if _duplicates_document_id(self.content):
            raise ValueError(
                f"{self.path} duplicates document id: `id=str(doc.id)` and "
                "`**doc.model_dump()` pass id twice. Name response fields explicitly "
                "or use `doc.model_dump(exclude={'id'})`."
            )

        missing_lists = _missing_list_routes(_declared_routes(self.content))
        if missing_lists:
            wanted = ", ".join(f"GET {base}" for base in missing_lists)
            raise ValueError(
                f"{self.path} has item routes but no list route. Add {wanted} returning a "
                "list of the response schema, so every record can be listed."
            )

        # Truncation does not always produce a syntax error. A file cut off after its
        # imports still parses perfectly and yields a suite pytest collects zero tests
        # from — which reads downstream as "the code failed its tests" rather than "the
        # Tester wrote nothing". Observed live 2026-08-19: a test_main.py consisting of
        # exactly `from fastapi.testclient import TestClient` passed this validator and
        # the sandbox reported "no tests ran in 0.09s".
        if _is_pytest_module(self.path) and not _defines_a_test(self.content):
            raise ValueError(
                f"{self.path} contains no test functions. Return a complete suite in which "
                "every test is a `def test_...` function; if the file was cut short, write "
                "fewer tests rather than a truncated one."
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
