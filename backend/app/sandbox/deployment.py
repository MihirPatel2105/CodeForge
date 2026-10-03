"""Persistent, network-isolated containers for published generated APIs."""

import asyncio
import base64
import hashlib
import json
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.sandbox.policy import is_hardened
from app.sandbox.preview import RESULT_PREFIX, validate_request
from app.sandbox.runner import (
    MEM_LIMIT,
    NANO_CPUS,
    PIDS_LIMIT,
    SANDBOX_IMAGE,
    SandboxUnavailableError,
    _tar_bytes,
)
from app.schemas.agents import GeneratedFile

MAX_ACTIVE_DEPLOYMENTS = 2
QUEUE_TIMEOUT_SECONDS = 2
_locks: dict[str, asyncio.Lock] = {}


def _name(deployment_id: str) -> str:
    return f"codeforge-deployment-{deployment_id}"


def _client(timeout: int = 12):
    try:
        import docker
        from docker.errors import DockerException
    except ImportError as exc:  # pragma: no cover
        raise SandboxUnavailableError("Docker SDK is not installed") from exc
    try:
        client = docker.from_env(timeout=timeout)
        client.ping()
        return client
    except DockerException as exc:
        raise SandboxUnavailableError("Docker is not reachable") from exc


def _owned(item: Any, deployment_id: str) -> bool:
    labels = item.attrs.get("Labels") or item.attrs.get("Config", {}).get("Labels") or {}
    return labels.get("codeforge.deployment_id") == deployment_id


def _ready_marker(container: Any) -> str:
    # Readiness must be checked again after every restart, including on older images.
    started_at = container.attrs.get("State", {}).get("StartedAt", "")
    return "/tmp/codeforge-api-ready-" + hashlib.sha256(started_at.encode()).hexdigest()[:16]


def _ensure_blocking(deployment_id: str, files: list[GeneratedFile]) -> None:
    from docker.errors import NotFound

    client = _client()
    container = None
    try:
        try:
            volume = client.volumes.get(_name(deployment_id))
            if not _owned(volume, deployment_id):
                raise SandboxUnavailableError("Deployment volume name is unavailable.")
        except NotFound:
            volume = client.volumes.create(
                name=_name(deployment_id),
                labels={"codeforge.deployment_id": deployment_id},
            )

        try:
            container = client.containers.get(_name(deployment_id))
            if not _owned(container, deployment_id):
                raise SandboxUnavailableError("Deployment container name is unavailable.")
            container.reload()
            if not is_hardened(container):
                # Named database volumes survive removal; only disposable volumes go.
                container.remove(force=True, v=True)
                container = None
        except NotFound:
            container = None
        if container is None:
            container = client.containers.create(
                SANDBOX_IMAGE,
                name=_name(deployment_id),
                labels={"codeforge.deployment_id": deployment_id},
                entrypoint="/usr/local/bin/deployment_entrypoint.sh",
                cap_drop=["ALL"],
                security_opt=["no-new-privileges:true"],
                read_only=True,
                tmpfs={"/tmp": "rw,noexec,nosuid,nodev,size=64m,mode=1777"},
                network_mode="none",
                mem_limit=MEM_LIMIT,
                nano_cpus=NANO_CPUS,
                pids_limit=PIDS_LIMIT,
                working_dir="/app",
                volumes={volume.name: {"bind": "/data/db", "mode": "rw"}},
                restart_policy={"Name": "unless-stopped"},
                detach=True,
            )
            container.put_archive("/app", _tar_bytes(files))

        if container.status != "running":
            container.start()
        for _ in range(60):
            container.reload()
            if container.status != "running":
                break
            if container.exec_run(["test", "-f", "/tmp/codeforge-deployment-ready"]).exit_code == 0:
                marker = _ready_marker(container)
                if container.exec_run(["test", "-f", marker]).exit_code != 0:
                    result = _execute_blocking(deployment_id, "GET", "/openapi.json", None)
                    if result.get("status") != 200 or result.get("truncated") or "error" in result:
                        raise SandboxUnavailableError("Published API could not complete startup.")
                    try:
                        schema = json.loads(result["body"])
                        if not isinstance(schema, dict) or not isinstance(
                            schema.get("paths"), dict
                        ):
                            raise ValueError("Invalid API schema")
                    except (KeyError, ValueError, TypeError) as exc:
                        raise SandboxUnavailableError(
                            "Published API could not complete startup."
                        ) from exc
                    if container.exec_run(["touch", marker]).exit_code != 0:
                        raise SandboxUnavailableError("Published API could not complete startup.")
                return
            time.sleep(0.5)
        raise SandboxUnavailableError("Published API did not start. Try again.")
    finally:
        client.close()


def _execute_blocking(deployment_id: str, method: str, path: str, body: Any) -> dict[str, Any]:
    client = _client(timeout=30)
    try:
        container = client.containers.get(_name(deployment_id))
        if not _owned(container, deployment_id):
            raise SandboxUnavailableError("Deployment container name is unavailable.")
        payload = base64.b64encode(
            json.dumps({"method": method, "path": path, "body": body}).encode()
        ).decode()
        result = container.exec_run(
            ["timeout", "20s", "python", "/usr/local/bin/preview_request.py", payload],
            workdir="/app",
        )
        line = next(
            (
                line
                for line in reversed(result.output.decode(errors="replace").splitlines())
                if line.startswith(RESULT_PREFIX)
            ),
            None,
        )
        if result.exit_code != 0 or line is None:
            raise SandboxUnavailableError("Published API did not answer this request.")
        return json.loads(line[len(RESULT_PREFIX) :])
    finally:
        client.close()


def _destroy_blocking(deployment_id: str) -> None:
    from docker.errors import NotFound

    client = _client()
    try:
        try:
            container = client.containers.get(_name(deployment_id))
            if not _owned(container, deployment_id):
                raise SandboxUnavailableError("Deployment container name is unavailable.")
            container.remove(force=True, v=True)
        except NotFound:
            pass
        try:
            volume = client.volumes.get(_name(deployment_id))
            if not _owned(volume, deployment_id):
                raise SandboxUnavailableError("Deployment volume name is unavailable.")
            volume.remove(force=True)
        except NotFound:
            pass
    finally:
        client.close()


async def ensure_deployment(deployment_id: str, files: list[GeneratedFile]) -> None:
    lock = _locks.setdefault(deployment_id, asyncio.Lock())
    async with lock:
        await asyncio.to_thread(_ensure_blocking, deployment_id, files)


async def execute_deployment(
    deployment_id: str,
    files: list[GeneratedFile],
    method: str,
    path: str,
    body: Any,
    *,
    is_active: Callable[[], Awaitable[bool]] | None = None,
) -> dict[str, Any]:
    validate_request(method, path, body)
    lock = _locks.setdefault(deployment_id, asyncio.Lock())
    try:
        await asyncio.wait_for(lock.acquire(), timeout=QUEUE_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        raise SandboxUnavailableError("This API is busy. Try again shortly.") from exc
    try:
        if is_active is not None and not await is_active():
            raise SandboxUnavailableError("This API is no longer published.")
        # A cancelled HTTP request must not release the lock while its Docker work runs.
        work = asyncio.create_task(
            asyncio.to_thread(_request_blocking, deployment_id, files, method, path, body)
        )
        try:
            return await asyncio.shield(work)
        except asyncio.CancelledError:
            await work
            raise
    finally:
        lock.release()


def _request_blocking(
    deployment_id: str, files: list[GeneratedFile], method: str, path: str, body: Any
) -> dict[str, Any]:
    _ensure_blocking(deployment_id, files)
    return _execute_blocking(deployment_id, method, path, body)


async def destroy_deployment(deployment_id: str) -> None:
    lock = _locks.setdefault(deployment_id, asyncio.Lock())
    async with lock:
        await asyncio.to_thread(_destroy_blocking, deployment_id)


def _inspect_blocking(deployment_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Read only labelled CodeForge containers; never start an API during inspection."""
    from docker.errors import NotFound

    client = _client()
    results = {}
    try:
        for deployment_id in deployment_ids:
            try:
                container = client.containers.get(_name(deployment_id))
                if not _owned(container, deployment_id):
                    results[deployment_id] = {
                        "runtime_status": "unknown",
                        "detail": "Runtime ownership could not be verified.",
                    }
                    continue
                container.reload()
                running = container.status == "running"
                ready = (
                    running
                    and container.exec_run(["test", "-f", _ready_marker(container)]).exit_code == 0
                )
                stats = container.stats(stream=False) if running else {}
                memory = stats.get("memory_stats", {})
                results[deployment_id] = {
                    "runtime_status": "ready" if ready else "starting" if running else "stopped",
                    "started_at": container.attrs.get("State", {}).get("StartedAt")
                    if running
                    else None,
                    "memory_bytes": memory.get("usage"),
                    "memory_limit_bytes": memory.get("limit"),
                    "detail": "Runtime is running and its startup marker is present."
                    if ready
                    else "Runtime has not completed startup."
                    if running
                    else "Runtime is stopped.",
                }
            except NotFound:
                results[deployment_id] = {
                    "runtime_status": "missing",
                    "detail": "No runtime container was found.",
                }
            except Exception:
                results[deployment_id] = {
                    "runtime_status": "unknown",
                    "detail": "Runtime inspection is temporarily unavailable.",
                }
    finally:
        client.close()
    return results


async def inspect_deployments(deployment_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not deployment_ids:
        return {}
    try:
        return await asyncio.to_thread(_inspect_blocking, deployment_ids)
    except Exception:
        return {
            key: {
                "runtime_status": "unknown",
                "detail": "Docker could not be inspected. Check system health.",
            }
            for key in deployment_ids
        }
