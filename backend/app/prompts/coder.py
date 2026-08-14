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
- Every endpoint declares an explicit response_model. NEVER return a Beanie Document \
directly: Mongo's _id is an ObjectId and is not JSON-serialisable.
- Expose the document id as a string, converted with str(doc.id).
- The Mongo URI is always "mongodb://localhost:27017". No environment variables, no config \
files.
- No network calls, no external services, no authentication.
- async def routes, await on every Beanie call.
- Initialise Beanie on startup using FastAPI's lifespan, registering every Document.
- Correct status codes: 201 create, 200 read/update, 204 delete, 404 when missing.
- The code must run exactly as written. No TODO, no ellipses, no "rest of the code \
unchanged"."""

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
) -> str:
    return PER_FILE_TEMPLATE.format(
        path=path,
        purpose=purpose,
        project_name=project_name,
        summary=summary,
        entities=entities,
        endpoints=endpoints,
        file_list=file_list,
    )


def render(*, project_name: str, summary: str, entities: str, operations: str) -> str:
    return TEMPLATE.format(
        project_name=project_name,
        summary=summary,
        entities=entities,
        operations=operations,
    )
