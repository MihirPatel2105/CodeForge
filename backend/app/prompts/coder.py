"""Coder agent prompt — one file per call.

The rules below are the ones from docs/GENERATED_APP.md §2 that matter most for a single
file. The graph calls `run_file` once per file in the Design.
"""

VERSION = "coder_v1"

SYSTEM = """You are the Coder agent in an automated SDLC pipeline. You write complete, \
runnable FastAPI applications backed by MongoDB via Beanie.

Hard rules — violating any of these makes the output useless:
- Use `from pymongo import AsyncMongoClient` for the database client. NEVER import motor \
or AsyncIOMotorClient: Beanie 2.x dropped motor and it is NOT installed in the runtime.
- Every endpoint declares an explicit response_model, EXCEPT a 204 No Content endpoint: \
FastAPI raises "Status code 204 must not have a response body" if you give one, so a 204 \
route must set response_model=None (or omit response_model entirely) and return nothing. \
For every other endpoint, NEVER return a Beanie Document directly: Mongo's _id is an \
ObjectId and is not JSON-serialisable.
- Expose the document id as a string, converted with str(doc.id).
- A field that may be absent must be typed Optional, never given a bare None default: \
write `created_at: date | None = None`, NEVER `created_at: date = None`. Pydantic v2 \
raises a validation error the moment None reaches a non-optional field.
- Invent NOTHING. Implement exactly the fields in the entity list and exactly the \
endpoints in the design — no created_at, no updated_at, no extra helper routes unless \
they are listed. A schema field that has no matching field on the Beanie Document is a \
defect: it serialises an attribute that does not exist.
- An update request schema must NEVER contain the id field: the id comes from the path.
- In an update request schema EVERY field is optional, because a partial update sends \
only what changed. Type each one `T | None = None` — `title: str | None = None`, \
`publish_date: datetime | None = None`. Writing `publish_date: datetime = None` is the \
same defect as above and is the single most common way a generated update schema fails.
- The Mongo URI is always "mongodb://localhost:27017". No environment variables, no config \
files.
- No network calls, no external services, no authentication.
- async def routes, await on every Beanie call.
- Initialise Beanie on startup using FastAPI's lifespan, registering every Document.
- Correct status codes: 201 create, 200 read/update, 204 delete, 404 when missing.
- The code must run exactly as written. No TODO, no ellipses, no "rest of the code \
unchanged".
- The content field holds RAW PYTHON SOURCE ONLY. Do not wrap it in markdown fences, and \
do not put the filename at the top. A line like '''database.py opens a string that is never \
closed and makes the whole file fail to parse."."""

TEMPLATE = """Write ONE complete Python file named main.py implementing this API.

Project: {project_name}
Summary: {summary}

Entities:
{entities}

Operations: {operations}

The single file must contain the Beanie Document models, the Pydantic request/response \
models, the lifespan that initialises Beanie, and every route. Return it as one file with \
path "main.py"."""


PER_FILE_TEMPLATE = """Write ONE file of this application: **{path}**

Purpose of this file: {purpose}

Project: {project_name}
Summary: {summary}

Entities:
{entities}

Endpoints (the whole application; implement only the parts belonging to {path}):
{endpoints}

The application is split across these files, so import from the others rather than
duplicating them:
{file_list}
{reference}
Return only {path}, complete and runnable."""


def render_file(
    *,
    path: str,
    purpose: str,
    project_name: str,
    summary: str,
    entities: str,
    endpoints: str,
    file_list: str,
    reference: str = "",
) -> str:
    return PER_FILE_TEMPLATE.format(
        path=path,
        purpose=purpose,
        project_name=project_name,
        summary=summary,
        entities=entities,
        endpoints=endpoints,
        file_list=file_list,
        reference=f"\n{reference}\n" if reference else "",
    )


def render(*, project_name: str, summary: str, entities: str, operations: str) -> str:
    return TEMPLATE.format(
        project_name=project_name,
        summary=summary,
        entities=entities,
        operations=operations,
    )


FIX_TEMPLATE = """This file has problems that must be fixed.

File: {path}

Current contents:
```python
{current}
```
{siblings}
Problems to fix:
{problems}

{reference}
Rewrite {path} so those problems are gone. Change only what the problems require — keep \
everything else byte-identical. Return the complete file, not a diff."""


def render_fix(
    *, path: str, current: str, problems: str, siblings: str = "", reference: str = ""
) -> str:
    """Fix-pass prompt.

    Carries only the failing findings and this one file, never the accumulated history:
    a fix pass that re-sends everything blows the free-tier token budget and buries the
    signal the model needs (docs/AGENTS.md §4).

    `siblings` is a deliberate, narrow exception: the project's contract files
    (database.py, models.py, schemas.py — never main.py, never the full tree). Without
    them a fix pass can only guess at names/types another file already defined, and a
    live run (2026-08-18) showed exactly that: three fix passes in a row each introduced
    a *new* cross-file name or type mismatch instead of converging, because the model was
    inventing plausible names it couldn't check.
    """
    siblings_block = (
        f"\nThe project's other files already define these names and types — reference "
        f"them exactly as written, do not invent different ones:\n```python\n{siblings}\n"
        f"```\n"
        if siblings
        else ""
    )
    return FIX_TEMPLATE.format(
        path=path,
        current=current,
        problems=problems,
        siblings=siblings_block,
        reference=f"\n{reference}\n" if reference else "",
    )
