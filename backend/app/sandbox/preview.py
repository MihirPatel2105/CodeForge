"""Short-lived, network-isolated API previews for completed runs."""

import asyncio
import base64
import json
import time
from typing import Any

from app.sandbox.runner import (
    MEM_LIMIT,
    NANO_CPUS,
    PIDS_LIMIT,
    SANDBOX_IMAGE,
    SandboxUnavailableError,
    _tar_bytes,
)
from app.schemas.agents import GeneratedFile

PREVIEW_TTL_SECONDS = 900
MAX_PREVIEW_CONTAINERS = 2
RESULT_PREFIX = "CODEFORGE_PREVIEW_RESULT="
_locks: dict[str, asyncio.Lock] = {}


def validate_request(method: str, path: str, body: Any) -> None:
    if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
        raise ValueError("Choose GET, POST, PUT, PATCH, or DELETE.")
    if not path.startswith("/") or path.startswith("//") or "://" in path or "\\" in path:
        raise ValueError("Enter an API path beginning with /.")
    if ".." in path.split("?")[0].split("/") or len(path) > 300:
        raise ValueError("The API path is invalid or too long.")
    if len(json.dumps(body).encode()) > 16_384:
        raise ValueError("The JSON request body must be under 16 KB.")


def _preview_name(run_id: str) -> str:
    return f"codeforge-preview-{run_id}"


def _request_blocking(
    run_id: str, files: list[GeneratedFile], method: str, path: str, body: Any
) -> dict[str, Any]:
    try:
        import docker
        from docker.errors import DockerException, NotFound
    except ImportError as exc:  # pragma: no cover
        raise SandboxUnavailableError("Docker SDK is not installed") from exc

    try:
        client = docker.from_env(timeout=12)
        client.ping()
    except DockerException as exc:
        raise SandboxUnavailableError("Docker is not reachable") from exc

    container = None
    created = False
    try:
        try:
            container = client.containers.get(_preview_name(run_id))
            container.reload()
            if container.labels.get("codeforge.preview") != "true":
                container = None
                raise SandboxUnavailableError("Preview container name is unavailable.")
            if container.status != "running":
                container.remove(force=True)
                container = None
        except NotFound:
            pass

        if container is None:
            active = client.containers.list(filters={"label": "codeforge.preview=true"})
            if len(active) >= MAX_PREVIEW_CONTAINERS:
                raise SandboxUnavailableError("Preview capacity is full. Try again shortly.")
            container = client.containers.create(
                SANDBOX_IMAGE,
                name=_preview_name(run_id),
                labels={"codeforge.preview": "true", "codeforge.run_id": run_id},
                entrypoint="/usr/local/bin/preview_entrypoint.sh",
                network_mode="none",
                mem_limit=MEM_LIMIT,
                nano_cpus=NANO_CPUS,
                pids_limit=PIDS_LIMIT,
                working_dir="/app",
                detach=True,
                auto_remove=True,
            )
            created = True
            container.put_archive("/app", _tar_bytes(files))
            container.start()
            for _ in range(60):
                if (
                    container.exec_run(["test", "-f", "/tmp/codeforge-preview-ready"]).exit_code
                    == 0
                ):
                    break
                time.sleep(0.5)
            else:
                raise SandboxUnavailableError("Preview did not start. Try again.")

        payload = base64.b64encode(
            json.dumps({"method": method, "path": path, "body": body}).encode()
        ).decode()
        started = time.monotonic()
        result = container.exec_run(
            ["timeout", "20s", "python", "/usr/local/bin/preview_request.py", payload],
            workdir="/app",
        )
        output = result.output.decode(errors="replace")
        line = next(
            (line for line in reversed(output.splitlines()) if line.startswith(RESULT_PREFIX)), None
        )
        if result.exit_code != 0 or line is None:
            raise SandboxUnavailableError("Preview request failed inside the sandbox.")
        response = json.loads(line[len(RESULT_PREFIX) :])
        response["duration_ms"] = int((time.monotonic() - started) * 1000)
        response["session_started"] = created
        return response
    except Exception:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                pass
        raise
    finally:
        client.close()


async def preview_request(
    run_id: str, files: list[GeneratedFile], method: str, path: str, body: Any = None
) -> dict[str, Any]:
    validate_request(method, path, body)
    lock = _locks.setdefault(run_id, asyncio.Lock())
    async with lock:
        return await asyncio.to_thread(_request_blocking, run_id, files, method, path, body)


def _stop_blocking(run_id: str) -> None:
    import docker
    from docker.errors import NotFound

    client = docker.from_env(timeout=12)
    try:
        try:
            container = client.containers.get(_preview_name(run_id))
        except NotFound:
            return
        if container.labels.get("codeforge.preview") != "true":
            raise SandboxUnavailableError("Preview container name is unavailable.")
        container.remove(force=True)
    finally:
        client.close()


async def stop_preview(run_id: str) -> None:
    lock = _locks.setdefault(run_id, asyncio.Lock())
    async with lock:
        await asyncio.to_thread(_stop_blocking, run_id)
