"""Persistent, network-isolated containers for published generated APIs."""

import asyncio
import base64
import json
import time
from typing import Any

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
_locks: dict[str, asyncio.Lock] = {}


def _name(deployment_id: str) -> str:
    return f"codeforge-deployment-{deployment_id}"


def _client():
    try:
        import docker
        from docker.errors import DockerException
    except ImportError as exc:  # pragma: no cover
        raise SandboxUnavailableError("Docker SDK is not installed") from exc
    try:
        client = docker.from_env(timeout=12)
        client.ping()
        return client
    except DockerException as exc:
        raise SandboxUnavailableError("Docker is not reachable") from exc


def _owned(item: Any, deployment_id: str) -> bool:
    labels = item.attrs.get("Labels") or item.attrs.get("Config", {}).get("Labels") or {}
    return labels.get("codeforge.deployment_id") == deployment_id


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
        except NotFound:
            container = client.containers.create(
                SANDBOX_IMAGE,
                name=_name(deployment_id),
                labels={"codeforge.deployment_id": deployment_id},
                entrypoint="/usr/local/bin/deployment_entrypoint.sh",
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
                return
            time.sleep(0.5)
        raise SandboxUnavailableError("Published API did not start. Try again.")
    finally:
        client.close()


def _execute_blocking(deployment_id: str, method: str, path: str, body: Any) -> dict[str, Any]:
    client = _client()
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
            container.remove(force=True)
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
    deployment_id: str, files: list[GeneratedFile], method: str, path: str, body: Any
) -> dict[str, Any]:
    validate_request(method, path, body)
    lock = _locks.setdefault(deployment_id, asyncio.Lock())
    async with lock:
        await asyncio.to_thread(_ensure_blocking, deployment_id, files)
        return await asyncio.to_thread(_execute_blocking, deployment_id, method, path, body)


async def destroy_deployment(deployment_id: str) -> None:
    lock = _locks.setdefault(deployment_id, asyncio.Lock())
    async with lock:
        await asyncio.to_thread(_destroy_blocking, deployment_id)
