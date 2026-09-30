"""Small, server-side checks for failures that need operator attention."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI

from app.config import settings
from app.core.email import send_platform_alert_email
from app.db import get_database

logger = logging.getLogger(__name__)
POLL_SECONDS = 300
ALERT_COOLDOWN_SECONDS = 3600


async def current_alerts(app: FastAPI) -> dict[str, str]:
    alerts: dict[str, str] = {}
    try:
        database = get_database()
        await database.command("ping")
        since = datetime.now(UTC) - timedelta(hours=1)
        total = await database["runs"].count_documents({"created_at": {"$gte": since}})
        if total >= settings.admin_failure_alert_min_runs:
            failed = await database["runs"].count_documents(
                {
                    "created_at": {"$gte": since},
                    "status": {"$in": ["failed_max_loops", "failed_sandbox", "failed_llm"]},
                }
            )
            rate = round(100 * failed / total, 1)
            if rate >= settings.admin_failure_alert_percent:
                alerts["run_failure_rate"] = (
                    f"{failed} of {total} runs failed in the last hour ({rate}%)."
                )
    except Exception:
        alerts["mongodb"] = "The CodeForge database is unavailable."

    if settings.redis_url:
        try:
            await app.state.redis.ping()
        except Exception:
            alerts["redis"] = "Redis is unavailable; protected public requests may fail."
    return alerts


async def monitor_loop(app: FastAPI) -> None:
    """Log changes and mail the configured operator at most once per hour per alert."""
    last_sent: dict[str, datetime] = {}
    while True:
        await asyncio.sleep(POLL_SECONDS)
        try:
            alerts = await current_alerts(app)
            for key, detail in alerts.items():
                logger.error("Platform alert %s: %s", key, detail)
                if not settings.admin_email or not settings.email_verification_enabled:
                    continue
                now = datetime.now(UTC)
                if (
                    key in last_sent
                    and (now - last_sent[key]).total_seconds() < ALERT_COOLDOWN_SECONDS
                ):
                    continue
                if app.state.redis is not None and "redis" not in alerts:
                    claimed = await app.state.redis.set(
                        f"codeforge:operator-alert:{key}", "1", ex=ALERT_COOLDOWN_SECONDS, nx=True
                    )
                    if not claimed:
                        continue
                await send_platform_alert_email(
                    to=settings.admin_email, title=f"Platform alert: {key}", detail=detail
                )
                last_sent[key] = now
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Operator monitoring check failed")
