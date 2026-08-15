"""The event bus — the only thing that publishes SSE events.

Agents, graph nodes and the sandbox never format an SSE payload themselves
(docs/STATE_AND_API.md §4); they call `emit()` and this module does the rest.

Two jobs, both required:

* **Live delivery.** Each connected client gets its own queue. A slow or vanished client
  must never block a run, so a full queue drops the client rather than the event.
* **Durable replay.** Every event is appended to the run document, so a client that
  reconnects with `Last-Event-ID` — or simply reloads the page — can rebuild the whole
  timeline (FR-40, FR-41). A run that finished before anyone connected is still fully
  watchable afterwards.
"""

import asyncio
import contextlib
from collections import defaultdict
from typing import Any

from app.events.schemas import BaseEvent
from app.models import Run

#: Bounded so a client that stops reading cannot grow memory without limit. A dashboard
#: this far behind has effectively disconnected; it will reconnect and replay.
QUEUE_SIZE = 256

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
_counters: dict[str, int] = defaultdict(int)
_lock = asyncio.Lock()


class Envelope:
    """One event plus the id a client resumes from."""

    __slots__ = ("event", "id")

    def __init__(self, event_id: int, event: BaseEvent) -> None:
        self.id = event_id
        self.event = event

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "event": self.event.event,
            "data": self.event.model_dump(mode="json"),
        }


async def emit(run_id: str, event: BaseEvent, *, persist: bool = True) -> Envelope:
    """Publish one event for a run.

    Never raises: an observability failure must not take down the pipeline it observes.
    """
    async with _lock:
        _counters[run_id] += 1
        envelope = Envelope(_counters[run_id], event)

    for queue in list(_subscribers.get(run_id, ())):
        try:
            queue.put_nowait(envelope)
        except asyncio.QueueFull:
            # The client is not keeping up. Drop it rather than the event; it will
            # reconnect and replay from the run document.
            _subscribers[run_id].discard(queue)

    if persist:
        with contextlib.suppress(Exception):
            await _append_to_run(run_id, envelope)

    return envelope


async def _append_to_run(run_id: str, envelope: Envelope) -> None:
    """Append atomically.

    Read-append-save would lose events: two emits a few milliseconds apart both read the
    same document and the second save overwrites the first one's append. `$push` lets the
    database do the appending, so concurrent emits cannot clobber each other.
    """
    from bson import ObjectId

    await Run.get_pymongo_collection().update_one(
        {"_id": ObjectId(run_id)},
        {"$push": {"events": envelope.to_dict()}},
    )


def subscribe(run_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZE)
    _subscribers[run_id].add(queue)
    return queue


def unsubscribe(run_id: str, queue: asyncio.Queue) -> None:
    _subscribers[run_id].discard(queue)
    if not _subscribers[run_id]:
        _subscribers.pop(run_id, None)


def subscriber_count(run_id: str) -> int:
    return len(_subscribers.get(run_id, ()))


async def replay(run_id: str, after_id: int = 0) -> list[Envelope]:
    """Every stored event after `after_id`, oldest first.

    This is what makes a reconnect seamless and a page reload cheap. It reads the run
    document rather than any in-memory buffer, so it works for a run that finished days
    ago in a different process.
    """
    run = await Run.get(run_id)
    if run is None:
        return []

    out: list[Envelope] = []
    for stored in run.events:
        event_id = int(stored.get("id", 0))
        if event_id <= after_id:
            continue
        out.append(_StoredEnvelope(event_id, stored))
    return out


class _StoredEnvelope(Envelope):
    """An event rebuilt from the database.

    Kept as the stored dict rather than re-validated into a typed event: a replayed
    timeline must survive a schema change that a historic event no longer satisfies.
    """

    __slots__ = ("_stored",)

    def __init__(self, event_id: int, stored: dict[str, Any]) -> None:
        self.id = event_id
        self._stored = stored

    def to_dict(self) -> dict[str, Any]:
        return {**self._stored, "id": self.id}


async def restore_counter(run_id: str) -> int:
    """Resume numbering after a restart so ids stay monotonic for a resumed run."""
    run = await Run.get(run_id)
    highest = max((int(e.get("id", 0)) for e in (run.events if run else [])), default=0)
    async with _lock:
        _counters[run_id] = max(_counters[run_id], highest)
    return _counters[run_id]


def reset(run_id: str | None = None) -> None:
    """Drop in-memory state. For tests, and for a run that is finished with."""
    if run_id is None:
        _subscribers.clear()
        _counters.clear()
        return
    _subscribers.pop(run_id, None)
    _counters.pop(run_id, None)
