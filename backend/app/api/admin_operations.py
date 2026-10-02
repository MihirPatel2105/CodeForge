"""Actionable admin queues, deployment inventory, support and incident tracking."""

import asyncio
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Query

from app.api.admin import _audit, _get_user, _identity_maps, _run_summaries
from app.core.admin_guidance import failure_guidance
from app.core.deps import AdminUser
from app.core.exceptions import NotFoundError, PreviewUnavailableError
from app.db.mongo import aggregate_rows, get_database
from app.models import AdminIncident, Deployment, LoginSession, Run
from app.sandbox.deployment import MAX_ACTIVE_DEPLOYMENTS, destroy_deployment, inspect_deployments
from app.schemas.admin_operations import (
    AdminDeploymentItem,
    AdminDeploymentResponse,
    AdminSupport,
    AdminTrends,
    AttentionItem,
    AttentionResponse,
    IncidentItem,
    IncidentResponse,
    IncidentUpdate,
    PeriodMetrics,
)
from app.schemas.api import AdminActionRequest, AdminActionResponse

router = APIRouter(prefix="/admin", tags=["admin"])
FAILED = ["failed_llm", "failed_sandbox", "failed_max_loops"]


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@router.get("/attention", response_model=AttentionResponse)
async def attention(admin: AdminUser) -> AttentionResponse:
    del admin
    now = datetime.now(UTC)
    match = {
        "$or": [
            {"status": "awaiting_approval"},
            {"status": {"$in": ["queued", "running"]}},
            {"status": {"$in": FAILED}, "updated_at": {"$gte": now - timedelta(days=7)}},
        ]
    }
    total = await Run.find(match).count()
    # Active work always precedes terminal failures, so a failure burst cannot hide it.
    active = (
        await Run.find({"status": {"$in": ["queued", "running", "awaiting_approval"]}})
        .sort(Run.updated_at)
        .limit(100)
        .to_list()
    )
    failed = (
        await Run.find({"status": {"$in": FAILED}, "updated_at": {"$gte": now - timedelta(days=7)}})
        .sort(-Run.updated_at)
        .limit(max(0, 100 - len(active)) or 1)
        .to_list()
        if len(active) < 100
        else []
    )
    runs = active + failed
    summaries = await _run_summaries(runs)
    items = []
    for run, summary in zip(runs, summaries, strict=True):
        minutes = max(0, int((now - utc(run.updated_at)).total_seconds() / 60))
        approval = run.status == "awaiting_approval"
        stalled = run.status in {"queued", "running"} and minutes >= 15
        items.append(
            AttentionItem(
                run=summary,
                waiting_minutes=minutes,
                priority="urgent"
                if stalled or (approval and minutes >= 30)
                else "review"
                if approval
                else "recent",
                reason="No recorded update for at least 15 minutes; inspect progress."
                if stalled
                else "Waiting for the project owner’s decision."
                if approval
                else "Recent failure needs review."
                if run.status in FAILED
                else "Workflow is active.",
                guidance=failure_guidance(run),
            )
        )
    order = {"urgent": 0, "review": 1, "recent": 2}
    items.sort(key=lambda item: (order[item.priority], -item.waiting_minutes))
    return AttentionResponse(checked_at=now, total=total, items=items)


async def deployment_items(
    deployments: list[Deployment], inspect: bool = True
) -> list[AdminDeploymentItem]:
    runs = (
        await Run.find({"_id": {"$in": [ObjectId(d.run_id) for d in deployments]}}).to_list()
        if deployments
        else []
    )
    emails, projects = await _identity_maps(runs)
    runtime = await inspect_deployments([str(d.id) for d in deployments]) if inspect else {}
    return [
        AdminDeploymentItem(
            id=str(d.id),
            run_id=d.run_id,
            project_id=d.project_id,
            project_name=projects.get(d.project_id, "Deleted project"),
            user_id=d.user_id,
            user_email=emails.get(d.user_id, "Deleted account"),
            status=d.status,
            created_at=d.created_at,
            **runtime.get(str(d.id), {}),
        )
        for d in deployments
    ]


@router.get("/deployments", response_model=AdminDeploymentResponse)
async def deployments(admin: AdminUser) -> AdminDeploymentResponse:
    del admin
    items = await Deployment.find_all().sort(-Deployment.created_at).to_list()
    return AdminDeploymentResponse(
        checked_at=datetime.now(UTC),
        capacity=MAX_ACTIVE_DEPLOYMENTS,
        items=await deployment_items(items),
    )


@router.post("/deployments/{deployment_id}/stop", response_model=AdminActionResponse)
async def stop_deployment(
    deployment_id: str, body: AdminActionRequest, admin: AdminUser
) -> AdminActionResponse:
    try:
        deployment = await Deployment.get(deployment_id)
    except (InvalidId, ValueError):
        deployment = None
    if deployment is None:
        raise NotFoundError("Published API not found.")
    if len(body.reason.strip()) < 3:
        from app.core.exceptions import ConflictError

        raise ConflictError("Add a reason before stopping an API.")
    await _audit(
        admin,
        action="deployment.stop_requested",
        target_type="deployment",
        target_id=deployment_id,
        reason=body.reason,
        details={"run_id": deployment.run_id},
    )
    deployment.status = "deleting"
    await deployment.save()
    try:
        await destroy_deployment(deployment_id)
    except Exception:
        raise PreviewUnavailableError(
            "Could not stop the published API. Retry cleanup after Docker recovers."
        ) from None
    await deployment.delete()
    await _audit(
        admin,
        action="deployment.stopped",
        target_type="deployment",
        target_id=deployment_id,
        reason=body.reason,
    )
    return AdminActionResponse(message="Published API stopped and its runtime data removed.")


@router.get("/users/{user_id}/support", response_model=AdminSupport)
async def support(user_id: str, admin: AdminUser) -> AdminSupport:
    del admin
    user = await _get_user(user_id)
    uid = str(user.id)
    now = datetime.now(UTC)
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly, sessions, failed, published = await asyncio.gather(
        Run.find({"user_id": uid, "created_at": {"$gte": month}}).count(),
        LoginSession.find(
            {
                "user_id": uid,
                "revoked_at": None,
                "expires_at": {"$gt": now},
                "token_version": user.token_version,
            }
        ).count(),
        Run.find({"user_id": uid, "status": {"$in": FAILED}}).count(),
        Deployment.find(Deployment.user_id == uid).to_list(),
    )
    return AdminSupport(
        checked_at=now,
        monthly_runs=monthly,
        active_sessions=sessions,
        failed_runs=failed,
        deployments=await deployment_items(published, inspect=False),
    )


async def incident_groups() -> list[IncidentItem]:
    start = datetime.now(UTC) - timedelta(days=7)
    rows = await aggregate_rows(
        "runs",
        [
            {"$match": {"status": {"$in": FAILED}, "updated_at": {"$gte": start}}},
            {"$sort": {"updated_at": -1}},
            {
                "$group": {
                    "_id": {
                        "status": "$status",
                        "date": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$updated_at",
                                "timezone": "UTC",
                            }
                        },
                    },
                    "count": {"$sum": 1},
                    "latest_at": {"$first": "$updated_at"},
                    "run_id": {"$first": "$_id"},
                }
            },
            {"$sort": {"latest_at": -1}},
        ],
    )
    keys = [f"{row['_id']['status']}:{row['_id']['date']}" for row in rows]
    records = {r.key: r for r in await AdminIncident.find({"key": {"$in": keys}}).to_list()}
    titles = {
        "failed_llm": "Model request failures",
        "failed_sandbox": "Sandbox failures",
        "failed_max_loops": "Repair limit reached",
    }
    items = []
    for row in rows:
        key = f"{row['_id']['status']}:{row['_id']['date']}"
        record = records.get(key)
        status = record.status if record else "open"
        # A later failure reopens an acknowledged/resolved group; prior notes stay visible.
        if record and utc(row["latest_at"]) > utc(record.observed_at):
            status = "open"
        items.append(
            IncidentItem(
                key=key,
                title=f"{titles[row['_id']['status']]} · {row['_id']['date']}",
                count=row["count"],
                latest_at=row["latest_at"],
                sample_run_id=str(row["run_id"]),
                status=status,
                notes=record.notes if record else [],
            )
        )
    return items


@router.get("/incidents", response_model=IncidentResponse)
async def incidents(admin: AdminUser) -> IncidentResponse:
    del admin
    return IncidentResponse(checked_at=datetime.now(UTC), items=await incident_groups())


@router.patch("/incidents/{key}", response_model=AdminActionResponse)
async def update_incident(key: str, body: IncidentUpdate, admin: AdminUser) -> AdminActionResponse:
    item = next((item for item in await incident_groups() if item.key == key), None)
    if item is None:
        raise NotFoundError("Incident group not found.")
    now = datetime.now(UTC)
    await get_database()["admin_incidents"].update_one(
        {"key": key},
        {
            "$set": {"status": body.status, "observed_at": item.latest_at, "updated_at": now},
            "$push": {
                "notes": {
                    "$each": [{"admin_email": admin.email, "text": body.note, "at": now}],
                    "$slice": -30,
                }
            },
        },
        upsert=True,
    )
    await _audit(
        admin,
        action=f"incident.{body.status}",
        target_type="incident",
        target_id=key,
        reason=body.note[:240],
        details={"failures": item.count},
    )
    return AdminActionResponse(message="Incident updated.")


@router.get("/trends", response_model=AdminTrends)
async def trends(admin: AdminUser, days: int = Query(default=7, ge=1, le=90)) -> AdminTrends:
    del admin
    now = datetime.now(UTC)
    boundary = now - timedelta(days=days)
    start = boundary - timedelta(days=days)
    rows = await aggregate_rows(
        "runs",
        [
            {"$match": {"created_at": {"$gte": start, "$lte": now}}},
            {
                "$group": {
                    "_id": {"$cond": [{"$gte": ["$created_at", boundary]}, "current", "previous"]},
                    "runs": {"$sum": 1},
                    "failed": {"$sum": {"$cond": [{"$in": ["$status", FAILED]}, 1, 0]}},
                    "succeeded": {"$sum": {"$cond": [{"$eq": ["$status", "succeeded"]}, 1, 0]}},
                    "tokens": {"$sum": {"$ifNull": ["$metrics.tokens_total", 0]}},
                }
            },
        ],
    )
    values = {row.pop("_id"): PeriodMetrics(**row) for row in rows}
    return AdminTrends(
        checked_at=now,
        days=days,
        current=values.get("current", PeriodMetrics()),
        previous=values.get("previous", PeriodMetrics()),
    )
