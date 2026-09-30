from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.mongo import get_database

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(request: Request) -> JSONResponse:
    """Check dependencies required to accept authenticated work."""
    checks: dict[str, str] = {}
    try:
        await get_database().command("ping")
        checks["mongodb"] = "ok"
    except Exception:
        checks["mongodb"] = "unavailable"
    if settings.redis_url:
        try:
            await request.app.state.redis.ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "unavailable"
    status = "ok" if all(value == "ok" for value in checks.values()) else "unavailable"
    return JSONResponse(
        {"status": status, "checks": checks}, status_code=200 if status == "ok" else 503
    )
