"""Publish a tested API behind CodeForge's authenticated, bounded gateway."""

import hashlib
import json
import logging
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from bson.errors import InvalidId
from fastapi import APIRouter, Header, Request, Response, status
from fastapi.responses import JSONResponse
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.core.deps import CurrentUser, get_owned
from app.core.exceptions import (
    AuthError,
    ConflictError,
    NotFoundError,
    PreviewRequestError,
    PreviewUnavailableError,
    PublishedResponseInvalidError,
    PublishedResponseTooLargeError,
    RateLimitError,
    UsageLimitError,
)
from app.db.mongo import get_database
from app.models import Deployment, Run, User
from app.sandbox.deployment import (
    MAX_ACTIVE_DEPLOYMENTS,
    destroy_deployment,
    ensure_deployment,
    execute_deployment,
)
from app.sandbox.runner import SandboxUnavailableError
from app.schemas.agents import GeneratedFile
from app.schemas.api import DeploymentCreated, DeploymentHealth, DeploymentInfo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["deployments"])
GATEWAY_RATE_PER_MINUTE = 60
MAX_BODY_BYTES = 16_384


def _api_key() -> str:
    return "cf_live_" + secrets.token_urlsafe(32)


def _key_hash(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def _info(deployment: Deployment) -> DeploymentInfo:
    return DeploymentInfo(
        id=str(deployment.id),
        run_id=deployment.run_id,
        url=(f"{settings.api_public_base_url.rstrip('/')}/api/v1/deployments/{deployment.id}"),
        key_prefix=deployment.key_prefix,
        status=deployment.status,
        created_at=deployment.created_at,
    )


async def _owned_run(run_id: str, user: CurrentUser) -> Run:
    run = await get_owned(Run, run_id, str(user.id), "Run")
    if run.status != "succeeded" or not run.metrics or not run.metrics.tests_passed:
        raise ConflictError("Publish is available after a run passes all sandbox tests.")
    return run


def _files(run: Run) -> list[GeneratedFile]:
    files = [GeneratedFile(**item) for item in (run.state.get("files") or [])]
    if not {"main.py", "database.py", "models.py", "schemas.py"} <= {f.path for f in files}:
        raise ConflictError("This run has no complete API to publish.")
    return files


async def _for_run(run_id: str, user: CurrentUser) -> Deployment:
    await get_owned(Run, run_id, str(user.id), "Run")
    deployment = await Deployment.find_one(
        Deployment.run_id == run_id, Deployment.user_id == str(user.id)
    )
    if deployment is None:
        raise NotFoundError("This run has no published API.")
    return deployment


async def _is_active(deployment_id: str) -> bool:
    deployment = await Deployment.get(deployment_id)
    return deployment is not None and deployment.status == "active"


@router.post(
    "/runs/{run_id}/deployment",
    response_model=DeploymentCreated,
    status_code=status.HTTP_201_CREATED,
)
async def publish_run(run_id: str, user: CurrentUser) -> DeploymentCreated:
    run = await _owned_run(run_id, user)
    files = _files(run)
    if await Deployment.find_one(Deployment.run_id == run_id):
        raise ConflictError("This run is already published.")
    if await Deployment.find(Deployment.user_id == str(user.id)).count():
        raise UsageLimitError("Unpublish your current API before publishing another.")
    api_key = _api_key()
    deployment = None
    for slot in range(MAX_ACTIVE_DEPLOYMENTS):
        candidate = Deployment(
            run_id=run_id,
            project_id=run.project_id,
            user_id=str(user.id),
            slot=slot,
            key_hash=_key_hash(api_key),
            key_prefix=api_key[:16],
            status="starting",
        )
        try:
            await candidate.insert()
            deployment = candidate
            break
        except DuplicateKeyError:
            if await Deployment.find_one(Deployment.run_id == run_id):
                raise ConflictError("This run is already published.") from None
            if await Deployment.find_one(Deployment.user_id == str(user.id)):
                raise UsageLimitError(
                    "Unpublish your current API before publishing another."
                ) from None
    if deployment is None:
        raise UsageLimitError("Hosting capacity is full. Try again later.")
    try:
        await ensure_deployment(str(deployment.id), files)
    except Exception as exc:
        logger.exception("Could not start published API for run %s", run_id)
        deployment.status = "deleting"
        await Deployment.get_pymongo_collection().update_one(
            {"_id": deployment.id}, {"$set": {"status": "deleting"}}
        )
        try:
            await destroy_deployment(str(deployment.id))
        except Exception:
            logger.exception("Could not clean up failed published API %s", deployment.id)
        else:
            await deployment.delete()
        raise PreviewUnavailableError("Could not start the published API.") from exc
    activated = await Deployment.get_pymongo_collection().update_one(
        {"_id": deployment.id, "status": "starting"}, {"$set": {"status": "active"}}
    )
    if not activated.matched_count:
        await destroy_deployment(str(deployment.id))
        raise ConflictError("Publishing was cancelled. Refresh the API status.")
    deployment.status = "active"
    return DeploymentCreated(**_info(deployment).model_dump(), api_key=api_key)


@router.get("/runs/{run_id}/deployment", response_model=DeploymentInfo)
async def get_deployment(run_id: str, user: CurrentUser) -> DeploymentInfo:
    return _info(await _for_run(run_id, user))


@router.post("/runs/{run_id}/deployment/check", response_model=DeploymentHealth)
async def check_deployment(run_id: str, user: CurrentUser) -> DeploymentHealth:
    deployment = await _for_run(run_id, user)
    if deployment.status != "active":
        raise ConflictError("Wait until this API finishes its current operation.")
    run = await get_owned(Run, run_id, str(user.id), "Run")
    await _check_rate(str(deployment.id))
    started = time.monotonic()
    ready = False
    try:
        result = await execute_deployment(
            str(deployment.id),
            _files(run),
            "GET",
            "/openapi.json",
            None,
            is_active=lambda: _is_active(str(deployment.id)),
        )
        _validated_response(result)
        schema = json.loads(result["body"])
        ready = (
            result["status"] == 200
            and isinstance(schema, dict)
            and isinstance(schema.get("paths"), dict)
        )
    except Exception:
        logger.warning("Published API health check failed for %s", deployment.id, exc_info=True)
    now = datetime.now(UTC)
    usage = await get_database().deployment_rate_limits.find_one(
        {"_id": f"{deployment.id}:{int(now.timestamp()) // 60}"}
    )
    return DeploymentHealth(
        ready=ready,
        checked_at=now,
        duration_ms=int((time.monotonic() - started) * 1000),
        requests_this_minute=min((usage or {}).get("count", 0), GATEWAY_RATE_PER_MINUTE),
        request_limit=GATEWAY_RATE_PER_MINUTE,
        detail="The hosted API answered successfully. External access depends on your backend URL."
        if ready
        else "The hosted API could not answer. Check your Docker host and try again.",
    )


@router.post("/runs/{run_id}/deployment/rotate-key", response_model=DeploymentCreated)
async def rotate_deployment_key(run_id: str, user: CurrentUser) -> DeploymentCreated:
    deployment = await _for_run(run_id, user)
    if deployment.status != "active":
        raise ConflictError("This API is being unpublished.")
    api_key = _api_key()
    key_hash = _key_hash(api_key)
    rotated = await Deployment.get_pymongo_collection().update_one(
        {"_id": deployment.id, "status": "active"},
        {"$set": {"key_hash": key_hash, "key_prefix": api_key[:16]}},
    )
    if not rotated.matched_count:
        raise ConflictError("This API is being unpublished.")
    deployment.key_hash = key_hash
    deployment.key_prefix = api_key[:16]
    return DeploymentCreated(**_info(deployment).model_dump(), api_key=api_key)


@router.delete("/runs/{run_id}/deployment", status_code=204)
async def unpublish_run(run_id: str, user: CurrentUser) -> None:
    deployment = await _for_run(run_id, user)
    deployment.status = "deleting"
    await Deployment.get_pymongo_collection().update_one(
        {"_id": deployment.id}, {"$set": {"status": "deleting"}}
    )
    try:
        await destroy_deployment(str(deployment.id))
    except Exception as exc:
        logger.exception("Could not remove published API %s", deployment.id)
        raise PreviewUnavailableError("Could not unpublish this API. Try again.") from exc
    await deployment.delete()


async def _check_rate(deployment_id: str) -> dict[str, str]:
    now = datetime.now(UTC)
    bucket = f"{deployment_id}:{int(now.timestamp()) // 60}"
    usage = await get_database().deployment_rate_limits.find_one_and_update(
        {"_id": bucket},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"expires_at": now + timedelta(minutes=2)},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if usage["count"] > GATEWAY_RATE_PER_MINUTE:
        raise RateLimitError("This API reached its 60 requests per minute limit.")
    return {
        "X-RateLimit-Limit": str(GATEWAY_RATE_PER_MINUTE),
        "X-RateLimit-Remaining": str(max(0, GATEWAY_RATE_PER_MINUTE - usage["count"])),
        "X-RateLimit-Reset": str((int(now.timestamp()) // 60 + 1) * 60),
    }


def _validated_response(result: dict[str, Any]) -> None:
    if "error" in result or result.get("status", 500) >= 500:
        raise PreviewUnavailableError("Generated API could not process the request.")
    if result.get("truncated"):
        raise PublishedResponseTooLargeError(
            "API response exceeded the size limit. Request fewer records or use pagination."
        )
    if result.get("status") in {204, 304}:
        return
    if result.get("content_type", "").split(";", 1)[0].strip().lower() == "application/json":
        try:
            json.loads(result["body"])
        except (KeyError, ValueError, TypeError) as exc:
            raise PublishedResponseInvalidError(
                "Generated API returned an invalid JSON response."
            ) from exc


async def _read_json(request: Request) -> Any:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        raise PreviewRequestError("Request body must be under 16 KB.")
    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > MAX_BODY_BYTES:
            raise PreviewRequestError("Request body must be under 16 KB.")
    if not chunks:
        return None
    if request.headers.get("content-type", "").split(";", 1)[0].strip() != "application/json":
        raise PreviewRequestError("Send JSON with Content-Type: application/json.")
    try:
        return json.loads(chunks)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PreviewRequestError("Request body must be valid JSON.") from exc


@router.api_route(
    "/api/v1/deployments/{deployment_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def call_deployment(
    deployment_id: str,
    path: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    token = authorization.removeprefix("Bearer ") if authorization else ""
    if not token.startswith("cf_live_") or len(token) > 128:
        raise AuthError("A valid published API key is required.")
    try:
        deployment = await Deployment.get(deployment_id)
    except (InvalidId, ValueError, TypeError):
        deployment = None
    if (
        deployment is None
        or deployment.status != "active"
        or not secrets.compare_digest(_key_hash(token), deployment.key_hash)
    ):
        raise AuthError("A valid published API key is required.")
    owner = await User.get(deployment.user_id)
    if owner is None or owner.is_suspended:
        raise AuthError("This published API is unavailable.")

    try:
        rate_headers = await _check_rate(deployment_id)
    except RateLimitError as exc:
        now = int(datetime.now(UTC).timestamp())
        reset = (now // 60 + 1) * 60
        return JSONResponse(
            status_code=429,
            content={"error": {"code": exc.code, "message": exc.message, "run_id": None}},
            headers={
                "Retry-After": str(reset - now),
                "X-RateLimit-Limit": str(GATEWAY_RATE_PER_MINUTE),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset),
                "Cache-Control": "no-store",
            },
        )
    body = await _read_json(request)
    run = await Run.get(deployment.run_id)
    if run is None or run.user_id != deployment.user_id or run.project_id != deployment.project_id:
        raise PreviewUnavailableError("The published API source is unavailable.")
    api_path = "/" + path
    if request.url.query:
        api_path += "?" + request.url.query
    try:
        result = await execute_deployment(
            deployment_id,
            _files(run),
            request.method,
            api_path,
            body,
            is_active=lambda: _is_active(deployment_id),
        )
    except ValueError as exc:
        raise PreviewRequestError(str(exc)) from exc
    except SandboxUnavailableError as exc:
        raise PreviewUnavailableError(
            "Published API is unavailable or busy. Try again shortly."
        ) from exc
    except Exception as exc:
        logger.exception("Published API %s failed", deployment_id)
        raise PreviewUnavailableError("Published API could not answer. Try again.") from exc
    _validated_response(result)
    generated_type = result["content_type"].split(";", 1)[0].strip().lower()
    return Response(
        content="" if result["status"] in {204, 304} else result["body"],
        status_code=result["status"],
        media_type="application/json" if generated_type == "application/json" else "text/plain",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", **rate_headers},
    )
