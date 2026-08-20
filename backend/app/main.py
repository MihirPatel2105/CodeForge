import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.runs import router as runs_router
from app.api.stream import router as stream_router
from app.config import settings
from app.core.exceptions import CodeForgeError
from app.db import connect, disconnect

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await connect()
    if not settings.email_verification_enabled:
        # Verification failing open is a deliberate choice (see `config.py`), but a
        # security control that is off must never be off quietly.
        logger.warning(
            "SMTP is not configured — sign-up will NOT verify email addresses. "
            "Set SMTP_USER and SMTP_PASSWORD in .env to switch verification on."
        )
    yield
    await disconnect()


async def codeforge_error_handler(request: Request, exc: CodeForgeError) -> JSONResponse:
    """Single place where a typed exception becomes the documented error body
    (docs/STATE_AND_API.md §3)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "run_id": exc.run_id}},
    )


def create_app() -> FastAPI:
    app = FastAPI(title="CodeForge", lifespan=lifespan)
    app.add_exception_handler(CodeForgeError, codeforge_error_handler)
    # The frontend authenticates with a bearer token, not cookies, so credentials don't
    # need to cross the boundary — only the Authorization header does.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(runs_router)
    app.include_router(stream_router)
    return app


app = create_app()
