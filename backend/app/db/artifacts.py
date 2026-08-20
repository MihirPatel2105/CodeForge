"""Artifact storage in GridFS.

Artifacts are the durable record of a run: the generated tree, the sandbox log, the test
report. They live in GridFS rather than the run document because a file tree plus full
logs comfortably exceeds Mongo's 16 MB limit, and they are fetched rarely and whole.

The naming and metadata contract is `app/schemas/artifacts.py`; this module is the only
thing that reads or writes the bucket.
"""

import io
import json
import zipfile
from pathlib import Path

from app.db.mongo import get_bucket
from app.schemas.agents import GeneratedFile, TestResult
from app.schemas.artifacts import (
    ArtifactKind,
    ArtifactListResponse,
    ArtifactMetadata,
    ArtifactRef,
    artifact_filename,
)
from app.schemas.sandbox import SandboxResult


async def store_artifact(
    *,
    run_id: str,
    kind: ArtifactKind,
    payload: bytes,
    iteration: int = 0,
    content_type: str = "application/octet-stream",
) -> ArtifactRef:
    bucket = get_bucket()
    filename = artifact_filename(run_id, kind, iteration)
    metadata = ArtifactMetadata(
        run_id=run_id, kind=kind, iteration=iteration, content_type=content_type
    )

    file_id = await bucket.upload_from_stream(
        filename, payload, metadata=metadata.model_dump(mode="json")
    )
    return ArtifactRef(
        file_id=str(file_id),  # ObjectId is not JSON-serialisable
        filename=filename,
        kind=kind,
        iteration=iteration,
        length=len(payload),
        created_at=metadata.created_at,
    )


def zip_tree(files: list[GeneratedFile]) -> bytes:
    """Zip a file tree in memory.

    Paths are flattened to their basename: generated apps are a flat tree, and a stored
    path like `../../etc/passwd` must not be reproducible on extraction.
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for generated in files:
            archive.writestr(Path(generated.path).name, generated.content)
    return buffer.getvalue()


async def store_run_artifacts(
    *,
    run_id: str,
    files: list[GeneratedFile],
    test_files: list[GeneratedFile] | None = None,
    sandbox: SandboxResult | None = None,
    tests: TestResult | None = None,
    iteration: int = 0,
) -> list[ArtifactRef]:
    """Persist everything worth keeping from one execution.

    Keyed by iteration so a later fix pass cannot overwrite the evidence from an earlier
    one — Phase 6 needs the per-iteration diff, and Phase 8 needs the history.
    """
    refs: list[ArtifactRef] = []

    tree = list(files) + list(test_files or [])
    if tree:
        refs.append(
            await store_artifact(
                run_id=run_id,
                kind="file_tree",
                payload=zip_tree(tree),
                iteration=iteration,
                content_type="application/zip",
            )
        )

    if sandbox is not None:
        log = f"$ pytest\n--- stdout ---\n{sandbox.stdout}\n--- stderr ---\n{sandbox.stderr}"
        refs.append(
            await store_artifact(
                run_id=run_id,
                kind="sandbox_log",
                payload=log.encode(),
                iteration=iteration,
                content_type="text/plain",
            )
        )

    if tests is not None:
        refs.append(
            await store_artifact(
                run_id=run_id,
                kind="pytest_report",
                payload=json.dumps(tests.model_dump(mode="json"), indent=2).encode(),
                iteration=iteration,
                content_type="application/json",
            )
        )

    return refs


async def list_artifacts(run_id: str) -> ArtifactListResponse:
    bucket = get_bucket()
    refs: list[ArtifactRef] = []

    cursor = bucket.find({"metadata.run_id": run_id})
    async for record in cursor:
        metadata = record.metadata or {}
        refs.append(
            ArtifactRef(
                file_id=str(record._id),
                filename=record.filename,
                kind=metadata.get("kind", "file_tree"),
                iteration=metadata.get("iteration", 0),
                length=record.length,
                created_at=record.upload_date,
            )
        )

    refs.sort(key=lambda r: (r.iteration, r.kind))
    return ArtifactListResponse(run_id=run_id, artifacts=refs)


async def read_artifact(file_id: str) -> bytes:
    from bson import ObjectId

    bucket = get_bucket()
    stream = await bucket.open_download_stream(ObjectId(file_id))
    return await stream.read()


async def delete_run_artifacts(run_ids: list[str]) -> int:
    """Remove every stored artifact belonging to these runs. Returns the file count.

    GridFS is a separate pair of collections from `runs`, so deleting a run does not
    take its artifacts with it. Without this, closing an account would leave the zipped
    file trees behind, owned by a run id that no longer resolves to anything.
    """
    if not run_ids:
        return 0

    bucket = get_bucket()
    deleted = 0
    # `find` then delete one by one: GridFS has no bulk delete, because every file is
    # a document plus its chunks.
    async for record in bucket.find({"metadata.run_id": {"$in": run_ids}}):
        await bucket.delete(record["_id"])
        deleted += 1
    return deleted
