import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.contact import router as contact_router
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
    # A run in flight when the process stopped has no task to resume it — the in-memory
    # registry did not survive the restart. Without this it shows `running` for ever.
    from app.graph.executor import reconcile_interrupted_runs

    await reconcile_interrupted_runs()
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


def _configure_logging() -> None:
    """Give the app's own loggers a handler.

    Uvicorn configures `uvicorn.*` and leaves the root logger alone, so until this
    existed every `logger.info` in the codebase went nowhere and every `logger.warning`
    fell through to Python's last-resort handler with no timestamp or logger name. That
    is how a swallowed failure in a background courtesy email stays invisible: the code
    is written to log it, and the log has nowhere to go.
    """
    root = logging.getLogger()
    if any(getattr(h, "_codeforge", False) for h in root.handlers):
        return

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
    handler._codeforge = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # These two are conversational at INFO and drown everything else.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("LiteLLM").setLevel(logging.WARNING)


def create_app() -> FastAPI:
    _configure_logging()
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
    app.include_router(admin_router)
    app.include_router(contact_router)
    app.include_router(projects_router)
    app.include_router(runs_router)
    app.include_router(stream_router)
    return app


app = create_app()
