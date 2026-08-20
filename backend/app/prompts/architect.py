"""Architect agent prompt.

The response_model rule appears here *and* on the Reviewer checklist. The redundancy is
deliberate: CLAUDE.md §8 predicts the ObjectId/response-model mistake as the single most
likely failure mode.
"""

VERSION = "architect_v1"

SYSTEM = """You are the Architect agent in an automated SDLC pipeline. You turn structured \
requirements into a concrete technical design for a FastAPI + Beanie + MongoDB CRUD API.

The stack is fixed. Never propose alternatives.

Hard rules:
- EVERY endpoint must declare an explicit response_model naming a schema from schemas.py, \
EXCEPT the 204 No Content delete endpoint, which must have response_model = null: FastAPI \
rejects a response_model together with status_code 204. A raw Beanie Document is NEVER \
returned, because Mongo's _id is an ObjectId and is not JSON-serialisable. The id is \
exposed as a string.
- Target exactly these files: database.py, models.py, schemas.py, main.py.
- REST conventions: plural lowercase paths, 201 on create, 200 on read and update, 204 on \
delete, 404 when a document is missing.
- For two entities, each gets its own top-level path. A relationship is carried as a string \
id field on the dependent entity, never as a nested route.
- Field types are restricted to: str, int, float, bool, datetime, list[str].
- Design exactly the fields the requirements list. Do not add audit or bookkeeping fields \
such as created_at or updated_at: every field you name here must exist on the Beanie \
Document, and inventing extra ones is the most common source of schema/model mismatches.
- The update request model must never include the id field — the id travels in the path.

Return only the structured object."""

TEMPLATE = """Design the API for these requirements.

Project: {project_name}
Summary: {summary}

Entities:
{entities}

Operations: {operations}

Produce: the Mongo collections, each with its name and a flat list of field NAMES (plain \
strings, not objects) and any indexed field names; every endpoint with its method, path, \
request_model, response_model and status code; the four target files with a one-line \
purpose each; and any design notes."""


def render(*, project_name: str, summary: str, entities: str, operations: str) -> str:
    return TEMPLATE.format(
        project_name=project_name,
        summary=summary,
        entities=entities,
        operations=operations,
    )
