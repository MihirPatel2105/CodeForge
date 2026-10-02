"""Publication readiness and bounded request queues without a real Docker daemon."""

import asyncio
from threading import Event
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.sandbox import deployment
from app.sandbox.runner import SandboxUnavailableError


def test_startup_requires_a_working_application():
    client = MagicMock()
    container = client.containers.get.return_value
    container.attrs = {"Config": {"Labels": {"codeforge.deployment_id": "startup"}}}
    container.status = "running"
    client.volumes.get.return_value.attrs = {"Labels": {"codeforge.deployment_id": "startup"}}
    container.exec_run.side_effect = [MagicMock(exit_code=0), MagicMock(exit_code=1)]
    with (
        patch.object(deployment, "_client", return_value=client),
        patch.object(
            deployment, "_execute_blocking", return_value={"status": 500, "body": "failed"}
        ),
        pytest.raises(SandboxUnavailableError, match="startup"),
    ):
        deployment._ensure_blocking("startup", [])
    assert not any(call.args[0][0] == "touch" for call in container.exec_run.call_args_list)
    client.close.assert_called_once()


def test_restart_invalidates_application_readiness():
    container = MagicMock()
    container.attrs = {"State": {"StartedAt": "first-start"}}
    first = deployment._ready_marker(container)
    container.attrs["State"]["StartedAt"] = "second-start"
    assert deployment._ready_marker(container) != first


def test_busy_queue_does_not_execute_another_request():
    async def scenario():
        lock = asyncio.Lock()
        await lock.acquire()
        with (
            patch.dict(deployment._locks, {"busy": lock}),
            patch.object(deployment, "QUEUE_TIMEOUT_SECONDS", 0.01),
            patch.object(deployment, "_request_blocking") as request,
            pytest.raises(SandboxUnavailableError, match="busy"),
        ):
            await deployment.execute_deployment("busy", [], "GET", "/items", None)
        request.assert_not_called()
        lock.release()

    asyncio.run(scenario())


def test_unpublished_request_cannot_recreate_the_container():
    async def scenario():
        with patch.object(deployment, "_request_blocking") as request:
            with pytest.raises(SandboxUnavailableError, match="no longer published"):
                await deployment.execute_deployment(
                    "deleted",
                    [],
                    "GET",
                    "/items",
                    None,
                    is_active=AsyncMock(return_value=False),
                )
            request.assert_not_called()

    asyncio.run(scenario())


def test_cancelled_request_retains_lock_until_docker_finishes():
    entered, finish = Event(), Event()

    def blocking(*args):
        entered.set()
        assert finish.wait(2)
        return {"status": 200}

    async def scenario():
        lock = asyncio.Lock()
        with (
            patch.dict(deployment._locks, {"cancel": lock}),
            patch.object(deployment, "_request_blocking", side_effect=blocking),
        ):
            task = asyncio.create_task(
                deployment.execute_deployment("cancel", [], "GET", "/items", None)
            )
            assert await asyncio.to_thread(entered.wait, 2)
            task.cancel()
            await asyncio.sleep(0)
            assert lock.locked()
            finish.set()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert not lock.locked()

    asyncio.run(scenario())
