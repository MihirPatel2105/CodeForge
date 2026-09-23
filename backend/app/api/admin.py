"""Authenticated operations, quality measurement and audited admin actions."""

import asyncio
import csv
import io
import math
import re
import time
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Query, Response

from app.config import settings
from app.core.deps import AdminUser, is_admin_user
from app.core.exceptions import ConflictError, NotFoundError
from app.db.artifacts import list_artifacts, read_artifact
from app.db.mongo import get_database
from app.events import events
from app.graph import executor
from app.graph.metrics import score_run
from app.graph.state import RunMetrics, RunStatus, new_run_state
from app.models import AdminAuditLog, Project, Run, User
from app.schemas.api import (
    AdminActionRequest,
    AdminActionResponse,
    AdminAlert,
    AdminAuditEntry,
    AdminAuditPage,
    AdminBreakdownItem,
    AdminDailyMetric,
    AdminMonitoringResponse,
    AdminOverviewResponse,
    AdminOverviewTotals,
    AdminPageInfo,
    AdminProjectSummary,
    AdminProviderStatus,
    AdminProviderUsage,
    AdminQualityResponse,
    AdminRagQuality,
    AdminRunDetail,
    AdminRunPage,
    AdminRunSummary,
    AdminServiceStatus,
    AdminSystemHealthResponse,
    AdminUserDetail,
    AdminUserLimitsRequest,
    AdminUserPage,
    AdminUserSummary,
)
from app.schemas.artifacts import ArtifactListResponse, artifact_download_filename

router = APIRouter(prefix="/admin", tags=["admin"])

_ACTIVE_STATUSES = ["queued", "running", "awaiting_approval"]
_FAILED_STATUSES = ["failed_max_loops", "failed_sandbox", "failed_llm"]
_TERMINAL_STATUSES = {
    "succeeded",
    "failed_max_loops",
    "failed_sandbox",
    "failed_llm",
    "rejected",
    "cancelled",
}
_RATE_LIMIT = re.compile(r"\b429\b|rate.?limit|quota|resource.?exhausted", re.I)


async def _empty() -> list:
    return []


async def _get_run(run_id: str) -> Run:
    try:
        run = await Run.get(run_id)
    except (InvalidId, ValueError):
        raise NotFoundError("Run not found") from None
    if run is None:
        raise NotFoundError("Run not found")
    return run


async def _get_user(user_id: str) -> User:
    try:
        user = await User.get(user_id)
    except (InvalidId, ValueError):
        raise NotFoundError("User not found") from None
    if user is None:
        raise NotFoundError("User not found")
    return user


async def _identity_maps(runs: list[Run]) -> tuple[dict[str, str], dict[str, str]]:
    """Resolve labels in two batch reads instead of querying once per table row."""
    user_ids = {run.user_id for run in runs}
    project_ids = {run.project_id for run in runs}
    users, projects = await asyncio.gather(
        User.find({"_id": {"$in": [ObjectId(value) for value in user_ids]}}).to_list()
        if user_ids
        else _empty(),
        Project.find({"_id": {"$in": [ObjectId(value) for value in project_ids]}}).to_list()
        if project_ids
        else _empty(),
    )
    return (
        {str(user.id): user.email for user in users},
        {str(project.id): project.name for project in projects},
    )


async def _run_summaries(runs: list[Run]) -> list[AdminRunSummary]:
    emails, projects = await _identity_maps(runs)
    summaries: list[AdminRunSummary] = []
    for run in runs:
        metrics = run.metrics
        summaries.append(
            AdminRunSummary(
                id=str(run.id),
                project_id=run.project_id,
                project_name=projects.get(run.project_id, "Deleted project"),
                user_id=run.user_id,
                user_email=emails.get(run.user_id, "deleted@invalid.local"),
                prompt=run.prompt,
                status=run.status,
                is_live=executor.is_running(str(run.id)),
                iterations=run.iterations,
                acceptance_level=metrics.acceptance_level if metrics else None,
                test_pass_ratio=metrics.test_pass_ratio if metrics else None,
                provider_fallbacks=metrics.provider_fallbacks if metrics else 0,
                end_to_end_ms=metrics.end_to_end_ms if metrics else None,
                created_at=run.created_at,
                updated_at=run.updated_at,
            )
        )
    return summaries


async def _user_summary(user: User) -> AdminUserSummary:
    uid = str(user.id)
    project_count, run_count, succeeded_runs, latest = await asyncio.gather(
        Project.find(Project.user_id == uid).count(),
        Run.find(Run.user_id == uid).count(),
        Run.find(Run.user_id == uid, Run.status == "succeeded").count(),
        Run.find(Run.user_id == uid).sort(-Run.updated_at).limit(1).to_list(),
    )
    return AdminUserSummary(
        id=uid,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=is_admin_user(user),
        project_count=project_count,
        run_count=run_count,
        succeeded_runs=succeeded_runs,
        created_at=user.created_at,
        last_activity_at=latest[0].updated_at if latest else None,
        email_verified=user.email_verified,
        is_suspended=user.is_suspended,
        suspended_at=user.suspended_at,
        suspended_reason=user.suspended_reason,
        project_limit=user.project_limit,
        monthly_run_limit=user.monthly_run_limit,
    )


def _page_info(page: int, page_size: int, total: int) -> AdminPageInfo:
    return AdminPageInfo(
        page=page,
        page_size=page_size,
        total=total,
        pages=max(1, math.ceil(total / page_size)),
    )


def _date_filters(date_from: datetime | None, date_to: datetime | None) -> dict[str, Any]:
    values: dict[str, Any] = {}
    if date_from:
        values["$gte"] = date_from
    if date_to:
        values["$lte"] = date_to
    return {"created_at": values} if values else {}


async def _audit(
    admin: User,
    *,
    action: str,
    target_type: str,
    target_id: str,
    reason: str,
    details: dict[str, Any] | None = None,
) -> None:
    await AdminAuditLog(
        admin_user_id=str(admin.id),
        admin_email=admin.email,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        details=details or {},
    ).insert()


def _percentage(count: int, total: int) -> float:
    return round((count / total) * 100, 1) if total else 0.0


def _average(values: list[int | float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def _breakdown(counter: Counter[str], denominator: int) -> list[AdminBreakdownItem]:
    return [
        AdminBreakdownItem(
            label=label,
            count=count,
            percentage=_percentage(count, denominator),
        )
        for label, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


@router.get("/overview", response_model=AdminOverviewResponse)
async def overview(admin: AdminUser) -> AdminOverviewResponse:
    del admin
    (
        users,
        projects,
        runs,
        active_status_runs,
        awaiting,
        succeeded,
        failed,
        l5,
        fallbacks,
        recent,
    ) = await asyncio.gather(
        User.find_all().count(),
        Project.find_all().count(),
        Run.find_all().count(),
        Run.find({"status": {"$in": _ACTIVE_STATUSES}}).to_list(),
        Run.find(Run.status == "awaiting_approval").count(),
        Run.find(Run.status == "succeeded").count(),
        Run.find({"status": {"$in": _FAILED_STATUSES}}).count(),
        Run.find({"metrics.acceptance_level": "L5"}).count(),
        Run.find({"metrics.provider_fallbacks": {"$gt": 0}}).count(),
        Run.find_all().sort(-Run.created_at).limit(10).to_list(),
    )
    active_ids = {str(run.id) for run in active_status_runs} | executor.active_run_ids()
    return AdminOverviewResponse(
        totals=AdminOverviewTotals(
            users=users,
            projects=projects,
            runs=runs,
            active_runs=len(active_ids),
            awaiting_approval=awaiting,
            succeeded_runs=succeeded,
            failed_runs=failed,
            l5_runs=l5,
            runs_with_provider_fallbacks=fallbacks,
        ),
        recent_runs=await _run_summaries(recent),
    )


@router.get("/runs", response_model=AdminRunPage)
async def list_runs(
    admin: AdminUser,
    status: RunStatus | None = None,
    q: str = Query(default="", max_length=200),
    rag_enabled: bool | None = None,
    acceptance_level: str | None = Query(default=None, pattern=r"^L[0-5]$"),
    failure_category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> AdminRunPage:
    del admin
    filters: dict[str, Any] = {}
    if status:
        filters["status"] = status
    if q.strip():
        filters["prompt"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    if rag_enabled is not None:
        filters["metrics.rag_enabled"] = rag_enabled
    if acceptance_level:
        filters["metrics.acceptance_level"] = acceptance_level
    if failure_category:
        filters["metrics.failure_category"] = failure_category
    filters.update(_date_filters(date_from, date_to))
    query = Run.find(filters) if filters else Run.find_all()
    total = await query.count()
    runs = await query.sort(-Run.created_at).skip((page - 1) * page_size).limit(page_size).to_list()
    return AdminRunPage(
        items=await _run_summaries(runs),
        pagination=_page_info(page, page_size, total),
    )


def _csv_response(filename: str, rows: list[list[Any]]) -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/runs/export.csv")
async def export_runs(
    admin: AdminUser, date_from: datetime | None = None, date_to: datetime | None = None
) -> Response:
    del admin
    filters = _date_filters(date_from, date_to)
    runs = (
        await (Run.find(filters) if filters else Run.find_all())
        .sort(-Run.created_at)
        .limit(5000)
        .to_list()
    )
    summaries = await _run_summaries(runs)
    rows: list[list[Any]] = [
        [
            "run_id",
            "project",
            "user",
            "status",
            "acceptance",
            "test_pass_ratio",
            "tokens",
            "created_at",
        ]
    ]
    for item, run in zip(summaries, runs, strict=True):
        rows.append(
            [
                item.id,
                item.project_name,
                item.user_email,
                item.status,
                item.acceptance_level or "",
                item.test_pass_ratio if item.test_pass_ratio is not None else "",
                run.metrics.tokens_total if run.metrics else 0,
                item.created_at.isoformat(),
            ]
        )
    return _csv_response("codeforge-runs.csv", rows)


@router.get("/runs/{run_id}", response_model=AdminRunDetail)
async def get_run(run_id: str, admin: AdminUser) -> AdminRunDetail:
    del admin
    run = await _get_run(run_id)
    summary = (await _run_summaries([run]))[0]
    return AdminRunDetail(run=summary, state=run.state, events=run.events)


@router.post("/runs/{run_id}/retry", response_model=AdminActionResponse)
async def retry_run(
    run_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    source = await _get_run(run_id)
    if source.status not in _TERMINAL_STATUSES:
        raise ConflictError("Only a finished run can be retried")
    project = await Project.get(source.project_id)
    user = await User.get(source.user_id)
    if project is None or user is None or user.is_suspended:
        raise ConflictError("The original project owner is unavailable")
    retried = Run(
        project_id=source.project_id, user_id=source.user_id, prompt=source.prompt, status="queued"
    )
    await retried.insert()
    retried_id = str(retried.id)
    state = new_run_state(
        run_id=retried_id,
        project_id=source.project_id,
        user_id=source.user_id,
        thread_id=retried_id,
        user_prompt=source.prompt,
        rag_enabled=bool((source.state or {}).get("rag_enabled", True)),
    )
    retried.state = {**state, "started_at": state["started_at"].isoformat(), "retried_from": run_id}
    await retried.save()
    await executor.start_run(retried)
    await _audit(
        admin,
        action="run.retried",
        target_type="run",
        target_id=retried_id,
        reason=payload.reason,
        details={"source_run_id": run_id},
    )
    return AdminActionResponse(message=f"Retry started as run {retried_id}.")


@router.get("/runs/{run_id}/artifacts", response_model=ArtifactListResponse)
async def admin_run_artifacts(run_id: str, admin: AdminUser) -> ArtifactListResponse:
    del admin
    await _get_run(run_id)
    return await list_artifacts(run_id)


@router.get("/runs/{run_id}/artifacts/{file_id}")
async def admin_download_artifact(run_id: str, file_id: str, admin: AdminUser) -> Response:
    del admin
    run = await _get_run(run_id)
    artifacts = await list_artifacts(run_id)
    artifact = next((item for item in artifacts.artifacts if item.file_id == file_id), None)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    project = await Project.get(run.project_id)
    filename = artifact_download_filename(
        project.name if project else "codeforge", artifact.kind, artifact.iteration
    )
    return Response(
        content=await read_artifact(file_id),
        media_type={
            "file_tree": "application/zip",
            "sandbox_log": "text/plain",
            "pytest_report": "application/json",
        }[artifact.kind],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/runs/{run_id}/cancel", response_model=AdminActionResponse)
async def cancel_run(
    run_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    run = await _get_run(run_id)
    was_live = executor.is_running(run_id)
    if not was_live and run.status in _TERMINAL_STATUSES:
        raise ConflictError("This run has already finished")

    status_before = run.status
    had_active_task = executor.cancel(run_id)
    finished_at = datetime.now(UTC)
    run.status = "cancelled"
    run.state = {
        **(run.state or {}),
        "status": "cancelled",
        "finished_at": finished_at.isoformat(),
    }
    run.metrics = score_run(run.state, status="cancelled")
    run.updated_at = finished_at
    await run.save()
    if not had_active_task:
        await events.run_failed(run_id, "cancelled", f"cancelled by admin: {payload.reason}")

    await _audit(
        admin,
        action="run.cancelled",
        target_type="run",
        target_id=run_id,
        reason=payload.reason,
        details={"status_before": status_before, "had_active_task": had_active_task},
    )
    return AdminActionResponse(message="Run cancelled and audit entry recorded.")


@router.get("/users", response_model=AdminUserPage)
async def list_users(
    admin: AdminUser,
    q: str = Query(default="", max_length=120),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> AdminUserPage:
    del admin
    term = q.strip()
    if term:
        safe = re.escape(term)
        filters: dict[str, Any] = {
            "$or": [
                {"email": {"$regex": safe, "$options": "i"}},
                {"first_name": {"$regex": safe, "$options": "i"}},
                {"last_name": {"$regex": safe, "$options": "i"}},
            ]
        }
    else:
        filters = {}
    filters.update(_date_filters(date_from, date_to))
    query = User.find(filters) if filters else User.find_all()
    total = await query.count()
    users = (
        await query.sort(-User.created_at).skip((page - 1) * page_size).limit(page_size).to_list()
    )
    return AdminUserPage(
        items=list(await asyncio.gather(*(_user_summary(user) for user in users))),
        pagination=_page_info(page, page_size, total),
    )


@router.get("/users/export.csv")
async def export_users(admin: AdminUser) -> Response:
    del admin
    users = await User.find_all().sort(-User.created_at).limit(5000).to_list()
    summaries = await asyncio.gather(*(_user_summary(user) for user in users))
    rows: list[list[Any]] = [
        [
            "user_id",
            "email",
            "name",
            "verified",
            "suspended",
            "projects",
            "runs",
            "succeeded",
            "created_at",
        ]
    ]
    rows.extend(
        [
            [
                item.id,
                item.email,
                " ".join(filter(None, [item.first_name, item.last_name])),
                item.email_verified,
                item.is_suspended,
                item.project_count,
                item.run_count,
                item.succeeded_runs,
                item.created_at.isoformat(),
            ]
            for item in summaries
        ]
    )
    return _csv_response("codeforge-users.csv", rows)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(user_id: str, admin: AdminUser) -> AdminUserDetail:
    del admin
    user = await _get_user(user_id)
    uid = str(user.id)
    projects, runs, all_runs = await asyncio.gather(
        Project.find(Project.user_id == uid).sort(-Project.created_at).to_list(),
        Run.find(Run.user_id == uid).sort(-Run.created_at).limit(25).to_list(),
        Run.find(Run.user_id == uid).to_list(),
    )
    run_counts = Counter(run.project_id for run in all_runs)
    return AdminUserDetail(
        user=await _user_summary(user),
        projects=[
            AdminProjectSummary(
                id=str(project.id),
                name=project.name,
                description=project.description,
                run_count=run_counts[str(project.id)],
                created_at=project.created_at,
            )
            for project in projects
        ],
        recent_runs=await _run_summaries(runs),
    )


@router.post("/users/{user_id}/suspend", response_model=AdminActionResponse)
async def suspend_user(
    user_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    user = await _get_user(user_id)
    if str(user.id) == str(admin.id) or is_admin_user(user):
        raise ConflictError("The administrator account cannot be suspended")
    if user.is_suspended:
        raise ConflictError("This account is already suspended")
    user.is_suspended = True
    user.suspended_at = datetime.now(UTC)
    user.suspended_reason = payload.reason
    user.token_version += 1
    await user.save()
    await _audit(
        admin, action="user.suspended", target_type="user", target_id=user_id, reason=payload.reason
    )
    return AdminActionResponse(message="Account suspended and every session revoked.")


@router.post("/users/{user_id}/restore", response_model=AdminActionResponse)
async def restore_user(
    user_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    user = await _get_user(user_id)
    if not user.is_suspended:
        raise ConflictError("This account is not suspended")
    user.is_suspended = False
    user.suspended_at = None
    user.suspended_reason = None
    await user.save()
    await _audit(
        admin, action="user.restored", target_type="user", target_id=user_id, reason=payload.reason
    )
    return AdminActionResponse(message="Account restored. The user can sign in again.")


@router.post("/users/{user_id}/verify-email", response_model=AdminActionResponse)
async def verify_user_email(
    user_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    user = await _get_user(user_id)
    if user.email_verified:
        raise ConflictError("This email is already verified")
    user.email_verified = True
    await user.save()
    await _audit(
        admin,
        action="user.email_verified",
        target_type="user",
        target_id=user_id,
        reason=payload.reason,
    )
    return AdminActionResponse(message="Email marked as verified.")


@router.post("/users/{user_id}/limits", response_model=AdminActionResponse)
async def set_user_limits(
    user_id: str, payload: AdminUserLimitsRequest, admin: AdminUser
) -> AdminActionResponse:
    user = await _get_user(user_id)
    before = {"project_limit": user.project_limit, "monthly_run_limit": user.monthly_run_limit}
    user.project_limit = payload.project_limit
    user.monthly_run_limit = payload.monthly_run_limit
    await user.save()
    await _audit(
        admin,
        action="user.limits_updated",
        target_type="user",
        target_id=user_id,
        reason=payload.reason,
        details={
            "before": before,
            "after": {
                "project_limit": payload.project_limit,
                "monthly_run_limit": payload.monthly_run_limit,
            },
        },
    )
    return AdminActionResponse(message="Usage limits updated.")


@router.post("/users/{user_id}/revoke-sessions", response_model=AdminActionResponse)
async def revoke_user_sessions(
    user_id: str, payload: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    user = await _get_user(user_id)
    if str(user.id) == str(admin.id):
        raise ConflictError("Use account settings to sign out your own sessions")
    previous_version = user.token_version
    user.token_version += 1
    await user.save()
    await _audit(
        admin,
        action="user.sessions_revoked",
        target_type="user",
        target_id=user_id,
        reason=payload.reason,
        details={"token_version_before": previous_version},
    )
    return AdminActionResponse(message="Every session for this user has been revoked.")


@router.get("/quality", response_model=AdminQualityResponse)
async def quality(admin: AdminUser) -> AdminQualityResponse:
    del admin
    documents = (
        await get_database()["runs"].find({"metrics": {"$ne": None}}, {"metrics": 1}).to_list()
    )
    measured = [RunMetrics.model_validate(document["metrics"]) for document in documents]
    eligible = [metric for metric in measured if metric.exclusion_reason is None]

    acceptance = Counter(metric.acceptance_level for metric in eligible)
    failures = Counter(
        metric.failure_category for metric in eligible if metric.failure_category is not None
    )
    exclusions = Counter(
        metric.exclusion_reason for metric in measured if metric.exclusion_reason is not None
    )

    rag_comparison: list[AdminRagQuality] = []
    for rag_enabled in (True, False):
        group = [metric for metric in eligible if metric.rag_enabled is rag_enabled]
        rag_comparison.append(
            AdminRagQuality(
                rag_enabled=rag_enabled,
                runs=len(group),
                l5_rate=_percentage(
                    sum(metric.acceptance_level == "L5" for metric in group), len(group)
                ),
                generation_success_rate=_percentage(
                    sum(metric.generation_succeeded for metric in group), len(group)
                ),
                average_test_pass_ratio=_average(
                    [metric.test_pass_ratio * 100 for metric in group]
                ),
                average_iterations=_average([metric.iterations for metric in group]),
                average_duration_ms=round(
                    _average([metric.end_to_end_ms for metric in group if metric.end_to_end_ms])
                ),
            )
        )

    blocking = sum(metric.blocking_findings_total for metric in eligible)
    fixed = sum(metric.findings_fixed for metric in eligible)
    durations = [metric.end_to_end_ms for metric in eligible if metric.end_to_end_ms]
    token_counts = [metric.tokens_total for metric in eligible if metric.tokens_total]
    return AdminQualityResponse(
        measured_runs=len(measured),
        eligible_runs=len(eligible),
        excluded_runs=len(measured) - len(eligible),
        generation_success_rate=_percentage(
            sum(metric.generation_succeeded for metric in eligible), len(eligible)
        ),
        test_pass_rate=_percentage(sum(metric.tests_passed for metric in eligible), len(eligible)),
        average_test_pass_ratio=_average([metric.test_pass_ratio * 100 for metric in eligible]),
        average_iterations=_average([metric.iterations for metric in eligible]),
        average_duration_ms=round(_average(durations)),
        average_tokens=round(_average(token_counts)),
        review_fix_rate=_percentage(fixed, blocking),
        provider_fallbacks=sum(metric.provider_fallbacks for metric in eligible),
        acceptance_levels=_breakdown(acceptance, len(eligible)),
        failure_categories=_breakdown(failures, len(eligible)),
        exclusions=_breakdown(exclusions, len(measured)),
        rag_comparison=rag_comparison,
    )


async def _database_status() -> AdminServiceStatus:
    started = time.perf_counter()
    try:
        await get_database().command({"ping": 1})
    except Exception as exc:  # noqa: BLE001 - status endpoint must report, not fail
        return AdminServiceStatus(
            name="MongoDB",
            status="unavailable",
            detail=f"Database ping failed: {type(exc).__name__}",
        )
    return AdminServiceStatus(
        name="MongoDB",
        status="healthy",
        detail="Platform database accepted a live ping.",
        latency_ms=round((time.perf_counter() - started) * 1000),
    )


async def _sandbox_status() -> AdminServiceStatus:
    def ping() -> str:
        import docker

        client = docker.from_env()
        try:
            client.ping()
            return "Docker daemon accepted a live ping."
        finally:
            client.close()

    started = time.perf_counter()
    try:
        detail = await asyncio.to_thread(ping)
    except Exception as exc:  # noqa: BLE001 - degradation is the response
        return AdminServiceStatus(
            name="Sandbox",
            status="unavailable",
            detail=f"Docker daemon is unreachable: {type(exc).__name__}",
        )
    return AdminServiceStatus(
        name="Sandbox",
        status="healthy",
        detail=detail,
        latency_ms=round((time.perf_counter() - started) * 1000),
    )


@router.get("/system-health", response_model=AdminSystemHealthResponse)
async def system_health(admin: AdminUser) -> AdminSystemHealthResponse:
    del admin
    database_status, sandbox_status, recent_runs = await asyncio.gather(
        _database_status(),
        _sandbox_status(),
        Run.find_all().sort(-Run.updated_at).limit(100).to_list(),
    )

    services = [
        AdminServiceStatus(
            name="API",
            status="healthy",
            detail="Authenticated admin request completed inside the backend process.",
        ),
        database_status,
        sandbox_status,
        AdminServiceStatus(
            name="Email",
            status="healthy" if settings.email_verification_enabled else "degraded",
            detail=(
                "SMTP credentials are configured."
                if settings.email_verification_enabled
                else "SMTP is not configured; verification and mail delivery are disabled."
            ),
        ),
        AdminServiceStatus(
            name="Langfuse",
            status=(
                "unknown"
                if settings.langfuse_public_key and settings.langfuse_secret_key
                else "degraded"
            ),
            detail=(
                "Tracing credentials are configured; this check does not spend a trace."
                if settings.langfuse_public_key and settings.langfuse_secret_key
                else "Tracing credentials are not configured."
            ),
        ),
    ]

    provider_config = {
        "groq": bool(settings.groq_api_key),
        "openrouter": bool(settings.openrouter_api_key),
        "mistral": bool(settings.mistral_api_key),
    }
    observations: dict[str, dict[str, Any]] = {
        provider: {
            "attempts": 0,
            "successes": 0,
            "failures": 0,
            "rate_limits": 0,
            "last": None,
        }
        for provider in provider_config
    }
    for run in recent_runs:
        for attempt in (run.state or {}).get("llm_attempts") or []:
            model = str(attempt.get("model", ""))
            provider = model.split("/", 1)[0].lower()
            if provider not in observations:
                continue
            observed = observations[provider]
            observed["attempts"] += 1
            if attempt.get("ok"):
                observed["successes"] += 1
            else:
                observed["failures"] += 1
                if _RATE_LIMIT.search(str(attempt.get("error", ""))):
                    observed["rate_limits"] += 1
            if observed["last"] is None or run.updated_at > observed["last"]:
                observed["last"] = run.updated_at

    providers: list[AdminProviderStatus] = []
    for provider, configured in provider_config.items():
        observed = observations[provider]
        if not configured:
            status = "unavailable"
        elif observed["attempts"] == 0:
            status = "unknown"
        elif observed["successes"] == 0:
            status = "unavailable"
        elif observed["failures"] or observed["rate_limits"]:
            status = "degraded"
        else:
            status = "healthy"
        providers.append(
            AdminProviderStatus(
                name=provider,
                status=status,
                configured=configured,
                recent_attempts=observed["attempts"],
                recent_successes=observed["successes"],
                recent_failures=observed["failures"],
                recent_rate_limits=observed["rate_limits"],
                last_observed_at=observed["last"],
            )
        )

    return AdminSystemHealthResponse(
        checked_at=datetime.now(UTC),
        services=services,
        providers=providers,
    )


@router.get("/audit-log", response_model=AdminAuditPage)
async def audit_log(
    admin: AdminUser,
    action: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> AdminAuditPage:
    del admin
    filters: dict[str, Any] = {"action": action} if action else {}
    filters.update(_date_filters(date_from, date_to))
    query = AdminAuditLog.find(filters) if filters else AdminAuditLog.find_all()
    total = await query.count()
    entries = (
        await query.sort(-AdminAuditLog.created_at)
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list()
    )
    items = [
        AdminAuditEntry(
            id=str(entry.id),
            admin_email=entry.admin_email,
            action=entry.action,
            target_type=entry.target_type,
            target_id=entry.target_id,
            reason=entry.reason,
            details=entry.details,
            created_at=entry.created_at,
        )
        for entry in entries
    ]
    return AdminAuditPage(items=items, pagination=_page_info(page, page_size, total))


@router.get("/audit-log/export.csv")
async def export_audit_log(admin: AdminUser) -> Response:
    del admin
    entries = await AdminAuditLog.find_all().sort(-AdminAuditLog.created_at).limit(10000).to_list()
    rows: list[list[Any]] = [
        ["timestamp", "administrator", "action", "target_type", "target_id", "reason"]
    ]
    rows.extend(
        [
            [
                entry.created_at.isoformat(),
                entry.admin_email,
                entry.action,
                entry.target_type,
                entry.target_id,
                entry.reason,
            ]
            for entry in entries
        ]
    )
    return _csv_response("codeforge-audit-log.csv", rows)


@router.get("/monitoring", response_model=AdminMonitoringResponse)
async def monitoring(
    admin: AdminUser, days: int = Query(default=30, ge=7, le=90)
) -> AdminMonitoringResponse:
    del admin
    now = datetime.now(UTC)
    start = now - timedelta(days=days - 1)
    runs = await Run.find({"created_at": {"$gte": start}}).to_list()
    dates = {
        (start + timedelta(days=offset)).date().isoformat(): AdminDailyMetric(
            date=(start + timedelta(days=offset)).date().isoformat()
        )
        for offset in range(days)
    }
    provider_counters: dict[str, dict[str, int]] = {}
    total_tokens = 0
    failed = 0
    for run in runs:
        key = (
            (run.created_at if run.created_at.tzinfo else run.created_at.replace(tzinfo=UTC))
            .date()
            .isoformat()
        )
        daily = dates.setdefault(key, AdminDailyMetric(date=key))
        daily.runs += 1
        if run.status == "succeeded":
            daily.succeeded += 1
        if run.status in _FAILED_STATUSES:
            daily.failed += 1
            failed += 1
        tokens = run.metrics.tokens_total if run.metrics else 0
        daily.tokens += tokens
        total_tokens += tokens
        attempts = list((run.state or {}).get("llm_attempts") or [])
        providers_seen: list[str] = []
        for attempt in attempts:
            provider = str(attempt.get("model", "unknown")).split("/", 1)[0].lower()
            counter = provider_counters.setdefault(
                provider, {"attempts": 0, "successes": 0, "failures": 0, "tokens": 0}
            )
            counter["attempts"] += 1
            counter["successes" if attempt.get("ok") else "failures"] += 1
            providers_seen.append(provider)
        if providers_seen and tokens:
            provider_counters[providers_seen[-1]]["tokens"] += tokens

    database = get_database()
    artifact_doc = (
        await database["artifacts.files"]
        .aggregate([{"$group": {"_id": None, "bytes": {"$sum": "$length"}}}])
        .to_list(1)
    )
    artifact_bytes = int(artifact_doc[0]["bytes"]) if artifact_doc else 0
    database_bytes = 0
    for collection in ("users", "projects", "runs", "admin_audit_logs"):
        try:
            stats = await database.command({"collStats": collection})
            database_bytes += int(stats.get("size", 0))
        except Exception:  # noqa: BLE001 - restricted Atlas roles may deny collStats
            pass

    failure_rate = _percentage(failed, len(runs))
    alerts: list[AdminAlert] = []
    if (
        len(runs) >= settings.admin_failure_alert_min_runs
        and failure_rate >= settings.admin_failure_alert_percent
    ):
        alerts.append(
            AdminAlert(
                severity="critical",
                title="Elevated run failure rate",
                detail=f"{failure_rate}% of runs failed during the selected {days}-day period.",
            )
        )
    if not settings.email_verification_enabled:
        alerts.append(
            AdminAlert(
                severity="warning",
                title="Email delivery is disabled",
                detail=(
                    "SMTP is not configured, so verification and security "
                    "notifications cannot be delivered."
                ),
            )
        )
    if not alerts:
        alerts.append(
            AdminAlert(
                severity="info",
                title="No active platform alerts",
                detail="Failure rate and configured services are within the current thresholds.",
            )
        )

    providers = [
        AdminProviderUsage(provider=name, **values)
        for name, values in sorted(provider_counters.items())
    ]
    return AdminMonitoringResponse(
        generated_at=now,
        period_days=days,
        total_storage_bytes=artifact_bytes + database_bytes,
        artifact_storage_bytes=artifact_bytes,
        database_storage_bytes=database_bytes,
        total_tokens=total_tokens,
        estimated_cost_usd=0.0,
        failure_rate=failure_rate,
        daily=[dates[key] for key in sorted(dates)],
        providers=providers,
        alerts=alerts,
    )
