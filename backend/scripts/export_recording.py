"""Export one finished run as an offline replay recording for the demo fallback.

    PYTHONPATH=. python scripts/export_recording.py --run-id <id> --slug books-loop \
        --title "Books API with a review loop"

The live demo depends on free provider quota, which can run out without warning. A
recording is a *real* run — its stored events, final files and per-pass file history —
written to `frontend/lib/recordings/<slug>.json`, where `/replay/<slug>` plays it through
the same reducer and panels as the live dashboard with no backend, database or LLM call.

Read-only: it opens its own client instead of `app.db.connect()`, which also creates
indexes, so exporting never writes to the platform database.
"""

import argparse
import asyncio
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bson import ObjectId
from gridfs.asynchronous import AsyncGridFSBucket
from pymongo import AsyncMongoClient

from app.config import settings
from app.db.artifacts import unzip_tree
from app.schemas.artifacts import ARTIFACT_BUCKET

#: Bumped when the shape changes, so the frontend can refuse a file it cannot play.
RECORDING_VERSION = 1

#: The slug becomes both a file name and a URL segment.
SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$")

RECORDINGS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "recordings"

TERMINAL_EVENTS = {"run.completed", "run.failed"}


def _latest_attempt(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror the live stream: a retried run keeps its history but not its old ending."""
    restarted = max(
        (index for index, event in enumerate(events) if event["event"] == "run.retried"),
        default=-1,
    )
    return [
        event
        for index, event in enumerate(events)
        if not (event["event"] in TERMINAL_EVENTS and index < restarted)
    ]


def _validate(run: dict[str, Any], slug: str, title: str) -> None:
    if not SLUG_PATTERN.match(slug):
        raise ValueError(f"slug {slug!r} must be 1-60 lowercase letters, digits or hyphens")
    if not title.strip():
        raise ValueError("title must not be empty")
    if run.get("status") != "succeeded":
        raise ValueError(f"only a succeeded run can be recorded; this one is {run.get('status')}")


def _as_utc(value: datetime) -> datetime:
    # PyMongo returns naive UTC; serialising that without an offset makes the browser
    # read it as local time.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _latest_per_iteration(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One archive per pass; a pass archived twice (e.g. after a retry) keeps the later."""
    by_iteration = {
        v["iteration"]: {"iteration": v["iteration"], "files": dict(v["files"])} for v in history
    }
    return [by_iteration[iteration] for iteration in sorted(by_iteration)]


def _refuse_owner_leaks(recording: dict[str, Any], run: dict[str, Any]) -> None:
    """The file is published, so no field — today's or a future event's — may name the owner."""
    serialised = json.dumps(recording)
    for key in ("user_id", "project_id"):
        value = run.get(key)
        if value and str(value) in serialised:
            raise ValueError(f"the recording would publish the run's {key} (owner data)")


def build_recording(
    run: dict[str, Any],
    history: list[dict[str, Any]],
    *,
    slug: str,
    title: str,
) -> dict[str, Any]:
    """Shape a raw run document and its file history into a replay recording.

    `history` holds one `{"iteration": int, "files": {path: content}}` per archived pass,
    oldest archive first. Ownership fields are deliberately left out — and checked for —
    because the file is committed and served publicly.
    """
    _validate(run, slug, title)
    events = _latest_attempt([stored["data"] for stored in run.get("events", [])])
    if not events or events[-1]["event"] != "run.completed":
        raise ValueError("the run's event log does not end with run.completed")

    state = run.get("state") or {}
    generated = (state.get("files") or []) + (state.get("test_files") or [])
    recording = {
        "version": RECORDING_VERSION,
        "slug": slug,
        "title": title.strip(),
        "source_run_id": str(run["_id"]),
        "recorded_at": _as_utc(run["created_at"]).isoformat(),
        "prompt": run["prompt"],
        "events": events,
        "files": {item["path"]: item["content"] for item in generated},
        "history": _latest_per_iteration(history),
    }
    _refuse_owner_leaks(recording, run)
    return recording


async def _load(run_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not ObjectId.is_valid(run_id):
        raise ValueError(f"{run_id!r} is not a run id")
    client = AsyncMongoClient(settings.mongo_uri, serverSelectionTimeoutMS=15_000)
    try:
        database = client[settings.mongo_db]
        run = await database.runs.find_one({"_id": ObjectId(run_id)})
        if run is None:
            raise ValueError(f"no run with id {run_id}")
        bucket = AsyncGridFSBucket(database, bucket_name=ARTIFACT_BUCKET)
        history: list[dict[str, Any]] = []
        archives = bucket.find(
            {"metadata.run_id": run_id, "metadata.kind": "file_tree"}, sort=[("uploadDate", 1)]
        )
        async for record in archives:
            stream = await bucket.open_download_stream(record._id)
            files = unzip_tree(await stream.read())
            history.append(
                {
                    "iteration": (record.metadata or {}).get("iteration", 0),
                    "files": {item.path: item.content for item in files},
                }
            )
        return run, history
    finally:
        await client.close()


async def main() -> Path:
    parser = argparse.ArgumentParser(description="Export one finished run as a replay recording.")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--out-dir", type=Path, default=RECORDINGS_DIR)
    args = parser.parse_args()

    run, history = await _load(args.run_id)
    recording = build_recording(run, history, slug=args.slug, title=args.title)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    out_path = args.out_dir / f"{recording['slug']}.json"
    out_path.write_text(
        json.dumps(recording, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return out_path


if __name__ == "__main__":
    try:
        written = asyncio.run(main())
    except ValueError as error:
        raise SystemExit(f"export_recording: {error}") from None
    print(f"wrote {written}")
