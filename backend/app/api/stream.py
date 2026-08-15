"""Server-Sent Events endpoint — see `docs/STATE_AND_API.md` §4.

One stream per run. A client reconnects with `Last-Event-ID` and gets everything it
missed before the live feed resumes, so a dropped connection is invisible in the
timeline (FR-40).

SSE rather than WebSockets: the traffic is one-way, it survives proxies, and the browser
reconnects on its own.
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, Request
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, get_owned
from app.events import HEARTBEAT, bus
from app.models import Run

router = APIRouter(tags=["stream"])

#: Proxies close a stream that goes quiet. A run can easily spend 90 seconds inside one
#: agent, so the heartbeat has to be well under any sane idle timeout.
HEARTBEAT_SECONDS = 15


def _frame(envelope) -> str:
    """Render a stored or live envelope as one SSE frame."""
    stored = envelope.to_dict()
    import json

    return f"id: {stored['id']}\nevent: {stored['event']}\ndata: {json.dumps(stored['data'])}\n\n"


async def _event_stream(request: Request, run_id: str, last_event_id: int) -> AsyncIterator[str]:
    # Subscribe before replaying, so an event emitted during the replay is queued rather
    # than lost between the two.
    queue = bus.subscribe(run_id)
    sent = last_event_id

    try:
        for envelope in await bus.replay(run_id, after_id=sent):
            sent = max(sent, envelope.id)
            yield _frame(envelope)

        while True:
            if await request.is_disconnected():
                break
            try:
                envelope = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except TimeoutError:
                yield HEARTBEAT
                continue

            # Fill any gap before delivering. An event emitted just before this client
            # subscribed can be persisted just after the replay read its snapshot, so it
            # reaches neither path — observed live, with agent.started vanishing from an
            # otherwise complete stream.
            if envelope.id > sent + 1:
                for missed in await bus.replay(run_id, after_id=sent):
                    if missed.id >= envelope.id:
                        break
                    sent = max(sent, missed.id)
                    yield _frame(missed)

            if envelope.id <= sent:
                continue  # already delivered by a replay
            sent = envelope.id
            yield _frame(envelope)
    finally:
        bus.unsubscribe(run_id, queue)


def _parse_last_event_id(value: str | None) -> int:
    """A malformed or absent header just means "send everything" — never a 400."""
    if not value:
        return 0
    with contextlib.suppress(ValueError):
        return int(value)
    return 0


@router.get("/runs/{run_id}/stream")
async def stream_run(
    run_id: str,
    request: Request,
    user: CurrentUser,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
) -> StreamingResponse:
    """Live events for a run, resumable from `Last-Event-ID`."""
    run = await get_owned(Run, run_id, str(user.id), "Run")

    return StreamingResponse(
        _event_stream(request, str(run.id), _parse_last_event_id(last_event_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Nginx buffers streamed responses by default, which holds every event until
            # the run ends — the opposite of the point.
            "X-Accel-Buffering": "no",
        },
    )
