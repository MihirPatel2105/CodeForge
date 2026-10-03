"""Database-backed admission reservations work across concurrent API workers."""

from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.core.exceptions import SecurityServiceError, UsageLimitError
from app.db import get_database
from app.models import Project, Run, User

ACTIVE_STATUSES = ["queued", "running", "awaiting_approval"]


async def _reserve_count(key: str, owner: str, initial: int, limit: int) -> None:
    collection = get_database().usage_buckets
    try:
        await collection.update_one(
            {"_id": key}, {"$setOnInsert": {"user_id": owner, "count": initial}}, upsert=True
        )
    except DuplicateKeyError:
        pass  # A concurrent initializer won; its counter is authoritative.
    reserved = await collection.find_one_and_update(
        {"_id": key, "count": {"$lt": limit}},
        {"$inc": {"count": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if reserved is None:
        raise UsageLimitError("You've reached the current limit. Please try again later.")


async def release_count(key: str) -> None:
    await get_database().usage_buckets.update_one(
        {"_id": key, "count": {"$gt": 0}}, {"$inc": {"count": -1}}
    )


async def reserve_project(user: User) -> str:
    owner = str(user.id)
    key = f"projects:{owner}"
    count = await Project.find(Project.user_id == owner).count()
    limit = user.project_limit if user.project_limit is not None else settings.default_project_limit
    await _reserve_count(key, owner, count, limit)
    return key


async def _take_slot(run_id: str, owner: str) -> None:
    collection = get_database().run_admissions
    for account_slot in range(settings.max_active_runs_per_user):
        for global_slot in range(settings.max_active_runs_global):
            try:
                await collection.insert_one(
                    {
                        "_id": run_id,
                        "user_id": owner,
                        "account_slot": account_slot,
                        "global_slot": global_slot,
                        "created_at": datetime.now(UTC),
                    }
                )
                return
            except DuplicateKeyError:
                if await collection.find_one({"_id": run_id}):
                    return
    raise UsageLimitError("Too many active runs. Finish or cancel a run before starting another.")


async def _reconcile_slots() -> None:
    db = get_database()
    # Terminal runs release capacity; an abandoned pre-insert reservation gets five
    # minutes to finish. Cleanup never removes a reservation for an active run.
    for admission in await db.run_admissions.find().to_list(None):
        run = await db.runs.find_one({"_id": ObjectId(admission["_id"])}, {"status": 1})
        created = admission["created_at"].replace(tzinfo=UTC)
        if (run and run["status"] not in ACTIVE_STATUSES and not admission.get("executing")) or (
            run is None and created < datetime.now(UTC) - timedelta(minutes=5)
        ):
            await db.run_admissions.delete_one(
                {"_id": admission["_id"], "created_at": admission["created_at"]}
            )
    # Existing runs from before this upgrade also occupy capacity.
    for run in await db.runs.find({"status": {"$in": ACTIVE_STATUSES}}).to_list(None):
        await _take_slot(str(run["_id"]), run["user_id"])


async def reserve_run(run: Run, user: User) -> str:
    await _reconcile_slots()
    owner = str(user.id)
    run_id = str(run.id)
    await _take_slot(run_id, owner)
    now = datetime.now(UTC)
    month = datetime(now.year, now.month, 1, tzinfo=UTC)
    key = f"runs:{owner}:{month:%Y-%m}"
    try:
        initial = await Run.find({"user_id": owner, "created_at": {"$gte": month}}).count()
        limit = (
            user.monthly_run_limit
            if user.monthly_run_limit is not None
            else settings.default_monthly_run_limit
        )
        await _reserve_count(key, owner, initial, limit)
    except BaseException:
        await get_database().run_admissions.delete_one({"_id": run_id})
        raise
    return key


async def confirm_run_admission(run_id: str) -> None:
    if await get_database().run_admissions.find_one({"_id": run_id}) is None:
        raise SecurityServiceError("Run admission expired. Please try again.")


async def mark_execution(run_id: str, executing: bool) -> None:
    await get_database().run_admissions.update_one(
        {"_id": run_id}, {"$set": {"executing": executing}}
    )
