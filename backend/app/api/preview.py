"""Authenticated, temporary access to a generated API inside its own sandbox."""

import json
import logging
from typing import Any

from fastapi import APIRouter

from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import ConflictError, PreviewRequestError, PreviewUnavailableError
from app.models import Run
from app.sandbox.preview import PREVIEW_TTL_SECONDS, preview_request, stop_preview
from app.sandbox.runner import SandboxUnavailableError
from app.schemas.agents import GeneratedFile
from app.schemas.api import PreviewCall, PreviewInfo, PreviewOperation, PreviewResult

logger = logging.getLogger(__name__)
router = APIRouter(tags=["preview"])
METHODS = ("get", "post", "put", "patch", "delete")


async def _files_for_user(run_id: str, user: CurrentUser) -> list[GeneratedFile]:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    if run.status != "succeeded" or not run.metrics or not run.metrics.tests_passed:
        raise ConflictError("Try API is available after a run passes all sandbox tests.")
    files = [GeneratedFile(**item) for item in (run.state.get("files") or [])]
    if not {"main.py", "database.py", "models.py", "schemas.py"} <= {f.path for f in files}:
        raise ConflictError("This run has no complete API to preview.")
    return files


async def _call(
    run_id: str, files: list[GeneratedFile], method: str, path: str, body: Any = None
) -> dict[str, Any]:
    try:
        result = await preview_request(run_id, files, method, path, body)
    except ValueError as exc:
        raise PreviewRequestError(str(exc)) from exc
    except SandboxUnavailableError as exc:
        raise PreviewUnavailableError(str(exc)) from exc
    except Exception as exc:
        logger.exception("Preview failed for run %s", run_id)
        raise PreviewUnavailableError("Preview could not start. Try again.") from exc
    if "error" in result:
        raise PreviewUnavailableError(f"Generated API could not start: {result['error']}")
    return result


def _example(schema: dict[str, Any], components: dict[str, Any], depth: int = 0) -> Any:
    if depth > 3:
        return None
    ref = schema.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
        schema = components.get(ref.rsplit("/", 1)[-1], {})
    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    variants = schema.get("anyOf") or schema.get("oneOf")
    if isinstance(variants, list):
        schema = next((item for item in variants if item.get("type") != "null"), {})
        return _example(schema, components, depth + 1)
    kind = schema.get("type")
    if kind == "object" or "properties" in schema:
        return {
            key: _example(value, components, depth + 1)
            for key, value in schema.get("properties", {}).items()
        }
    if kind == "array":
        return [_example(schema.get("items", {}), components, depth + 1)]
    if kind == "integer" or kind == "number":
        return 0
    if kind == "boolean":
        return False
    return "example@example.com" if schema.get("format") == "email" else "example"


def _operations(openapi: dict[str, Any]) -> list[PreviewOperation]:
    components = openapi.get("components", {}).get("schemas", {})
    operations = []
    for path, routes in openapi.get("paths", {}).items():
        if not isinstance(routes, dict):
            continue
        for method in METHODS:
            operation = routes.get(method)
            if not isinstance(operation, dict):
                continue
            body_schema = (
                operation.get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            operations.append(
                PreviewOperation(
                    method=method.upper(),
                    path=path,
                    summary=operation.get("summary") or "",
                    has_body=body_schema is not None,
                    example_body=_example(body_schema, components) if body_schema else None,
                )
            )
    return operations


@router.get("/runs/{run_id}/preview", response_model=PreviewInfo)
async def get_preview(run_id: str, user: CurrentUser) -> PreviewInfo:
    files = await _files_for_user(run_id, user)
    result = await _call(run_id, files, "GET", "/openapi.json")
    if result["status"] != 200:
        raise PreviewUnavailableError("Generated API did not provide its endpoint list.")
    try:
        openapi = json.loads(result["body"])
    except json.JSONDecodeError as exc:
        raise PreviewUnavailableError("Generated API returned invalid endpoint data.") from exc
    return PreviewInfo(
        operations=_operations(openapi),
        expires_after_seconds=PREVIEW_TTL_SECONDS,
        session_started=result["session_started"],
    )


@router.post("/runs/{run_id}/preview/request", response_model=PreviewResult)
async def send_preview_request(
    run_id: str, payload: PreviewCall, user: CurrentUser
) -> PreviewResult:
    files = await _files_for_user(run_id, user)
    result = await _call(run_id, files, payload.method, payload.path, payload.body)
    return PreviewResult(**result)


@router.delete("/runs/{run_id}/preview", status_code=204)
async def reset_preview(run_id: str, user: CurrentUser) -> None:
    await _files_for_user(run_id, user)
    try:
        await stop_preview(run_id)
    except Exception as exc:
        logger.exception("Could not reset preview for run %s", run_id)
        raise PreviewUnavailableError("Preview could not be reset. Try again.") from exc
