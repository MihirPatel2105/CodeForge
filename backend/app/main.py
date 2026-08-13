from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.runs import router as runs_router
from app.api.toy import router as toy_router
from app.core.exceptions import CodeForgeError
from app.db import connect, disconnect


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await connect()
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
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(runs_router)
    app.include_router(toy_router)  # Phase 3 only; removed when the graph lands
    return app


app = create_app()
