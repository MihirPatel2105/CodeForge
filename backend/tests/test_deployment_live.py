"""Opt-in isolated publication smoke tests; never touch existing publications."""

import asyncio
import os
from uuid import uuid4

import pytest

from app.api.deployments import _validated_response
from app.core.exceptions import PublishedResponseTooLargeError
from app.sandbox import deployment
from app.sandbox.runner import SandboxUnavailableError
from app.schemas.agents import GeneratedFile

pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_LIVE_DEPLOYMENT"), reason="set RUN_LIVE_DEPLOYMENT=1 with Docker available"
)


def test_publication_serves_requests_and_preserves_data_on_recreation(monkeypatch):
    monkeypatch.setattr(
        deployment, "SANDBOX_IMAGE", os.getenv("DEPLOYMENT_TEST_IMAGE", "codeforge-sandbox:latest")
    )
    deployment_id = f"test-publish-{uuid4().hex}"
    files = [
        GeneratedFile(
            path="main.py",
            content="""from fastapi import FastAPI
from pymongo import MongoClient
app = FastAPI()
db = MongoClient("mongodb://localhost:27017").publish_smoke
@app.post("/items")
def create(item: dict):
    db.items.insert_one(dict(item))
    return item
@app.get("/items")
def items():
    return list(db.items.find({}, {"_id": 0}))
@app.get("/large")
def large():
    return {"data": "x" * 100001}
""",
        )
    ]

    async def scenario():
        try:
            await deployment.ensure_deployment(deployment_id, files)
            created = await deployment.execute_deployment(
                deployment_id, files, "POST", "/items", {"name": "saved"}
            )
            assert created["status"] == 200
            _validated_response(created)
            client = deployment._client()
            try:
                container = client.containers.get(deployment._name(deployment_id))
                assert container.attrs["HostConfig"]["NetworkMode"] == "none"
                assert not container.attrs["HostConfig"]["PortBindings"]
                assert container.attrs["HostConfig"]["ReadonlyRootfs"] is True
                assert container.attrs["HostConfig"]["CapDrop"] == ["ALL"]
                assert "no-new-privileges:true" in container.attrs["HostConfig"]["SecurityOpt"]
                container.remove(force=True, v=True)
                # Recreate a pre-hardening container without touching its named data volume.
                legacy = client.containers.create(
                    deployment.SANDBOX_IMAGE,
                    name=deployment._name(deployment_id),
                    labels={"codeforge.deployment_id": deployment_id},
                    network_mode="none",
                    volumes={deployment._name(deployment_id): {"bind": "/data/db", "mode": "rw"}},
                )
                assert not legacy.attrs["HostConfig"]["ReadonlyRootfs"]
            finally:
                client.close()
            restored = await deployment.execute_deployment(
                deployment_id, files, "GET", "/items", None
            )
            assert restored["status"] == 200
            assert "saved" in restored["body"]
            large = await deployment.execute_deployment(deployment_id, files, "GET", "/large", None)
            assert large["truncated"] is True
            with pytest.raises(PublishedResponseTooLargeError):
                _validated_response(large)
        finally:
            await deployment.destroy_deployment(deployment_id)

    asyncio.run(scenario())


def test_publication_rejects_a_broken_application(monkeypatch):
    monkeypatch.setattr(
        deployment, "SANDBOX_IMAGE", os.getenv("DEPLOYMENT_TEST_IMAGE", "codeforge-sandbox:latest")
    )
    deployment_id = f"test-broken-{uuid4().hex}"

    async def scenario():
        try:
            with pytest.raises(SandboxUnavailableError, match="startup"):
                await deployment.ensure_deployment(
                    deployment_id,
                    [GeneratedFile(path="main.py", content="raise RuntimeError('broken')\n")],
                )
        finally:
            await deployment.destroy_deployment(deployment_id)

    asyncio.run(scenario())
