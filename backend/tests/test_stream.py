"""The SSE endpoint's replay, gap-filling and header handling.

`_event_stream` is exercised directly rather than through the live HTTP endpoint: the
default TestClient reads a response to completion before returning, and this stream is
deliberately open-ended (heartbeats keep it alive), so calling the endpoint for the 200
case would hang the test suite. Direct calls give the same coverage without that risk;
the endpoint itself is exercised for its error paths, which return before any streaming
starts.

Fully offline — no LLM calls, no Docker.
"""

import asyncio

import pytest

from app.api.stream import _event_stream, _frame, _parse_last_event_id
from app.events import HEARTBEAT, bus
from app.events import schemas as ev
from app.events.bus import Envelope


class FakeRequest:
    """A `Request` stand-in whose disconnection can be scripted.

    `is_disconnected()` is called once per trip around the stream's while-loop.
    `disconnect_after=N` keeps it connected for the first N checks, then disconnects.
    `None` means never disconnect (the test ends the generator itself).
    """

    def __init__(self, disconnect_after: int | None = None) -> None:
        self._calls = 0
        self._disconnect_after = disconnect_after

    async def is_disconnected(self) -> bool:
        self._calls += 1
        if self._disconnect_after is None:
            return False
        return self._calls > self._disconnect_after


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #


def test_parses_a_valid_header():
    assert _parse_last_event_id("42") == 42


def test_malformed_header_defaults_to_zero():
    """A client sending garbage must get everything, not a 400."""
    assert _parse_last_event_id("not-a-number") == 0


def test_missing_header_defaults_to_zero():
    assert _parse_last_event_id(None) == 0


def test_frame_has_id_event_and_a_trailing_blank_line():
    envelope = Envelope(5, ev.RunStarted(run_id="r1", prompt="p"))
    wire = _frame(envelope)
    assert wire.startswith("id: 5\n")
    assert "event: run.started\n" in wire
    assert wire.endswith("\n\n"), "SSE frames are terminated by a blank line"


# --------------------------------------------------------------------------- #
# The generator
# --------------------------------------------------------------------------- #


async def _with_run(coro_factory):
    """Run `coro_factory(run_id)` against a throwaway run, cleaning up after."""
    from app.db import connect, disconnect
    from app.models import Run

    await connect()
    run = Run(project_id="p", user_id="u", prompt="x")
    await run.insert()
    try:
        return await coro_factory(str(run.id))
    finally:
        await run.delete()
        await disconnect()


def test_generator_ends_cleanly_on_disconnect_with_nothing_to_send():
    async def scenario(run_id: str):
        request = FakeRequest(disconnect_after=0)
        gen = _event_stream(request, run_id, 0)
        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()

    asyncio.run(_with_run(scenario))


def test_last_event_id_skips_what_the_client_already_has():
    async def scenario(run_id: str):
        await bus.emit(run_id, ev.RunStarted(run_id=run_id, prompt="x"))  # id 1
        await bus.emit(run_id, ev.AgentStarted(agent="pm"))  # id 2
        await bus.emit(run_id, ev.AgentCompleted(agent="pm"))  # id 3

        request = FakeRequest(disconnect_after=0)
        gen = _event_stream(request, run_id, last_event_id=2)
        frames = [frame async for frame in gen]
        return frames

    frames = asyncio.run(_with_run(scenario))
    assert len(frames) == 1
    assert "id: 3" in frames[0]


def test_live_event_is_delivered_after_the_initial_replay():
    async def scenario(run_id: str):
        request = FakeRequest()
        gen = _event_stream(request, run_id, 0)

        # The queue is empty at this point, so the generator's `queue.get()` will not
        # resolve until something is emitted. Drive it as a task and let one tick pass
        # so `subscribe()` and the (empty) initial replay run before we emit.
        task = asyncio.ensure_future(gen.__anext__())
        await asyncio.sleep(0)
        emitted = await bus.emit(run_id, ev.AgentMessage(agent="pm", text="hello"))

        frame = await task
        return emitted.id, frame

    emitted_id, frame = asyncio.run(_with_run(scenario))
    assert f"id: {emitted_id}" in frame
    assert "hello" in frame


def test_gap_is_backfilled_before_the_out_of_order_event():
    """The bug this pins: an event persisted but never delivered to this subscriber's
    queue — for instance because it arrived just before the client subscribed and was
    written to the database just after the initial replay read its snapshot. The next
    live event then carries an id further ahead than expected, and the generator must
    fetch what it missed before delivering it.
    """

    async def scenario(run_id: str):
        request = FakeRequest()
        gen = _event_stream(request, run_id, 0)

        task = asyncio.ensure_future(gen.__anext__())
        await asyncio.sleep(0)
        first = await bus.emit(run_id, ev.RunStarted(run_id=run_id, prompt="x"))
        frame_first = await task
        assert f"id: {first.id}" in frame_first

        # Persisted directly, bypassing emit's queue fan-out: this event exists in the
        # database but was never delivered to our subscriber, simulating the race.
        async with bus._lock:
            bus._counters[run_id] += 1
            missed_id = bus._counters[run_id]
        await bus._append_to_run(run_id, Envelope(missed_id, ev.AgentStarted(agent="pm")))

        # The next event this subscriber actually receives live — several ids ahead.
        following = await bus.emit(run_id, ev.AgentCompleted(agent="pm"))
        assert following.id == missed_id + 1

        # One call surfaces the back-filled frame...
        frame_missed = await gen.__anext__()
        # ...and the next surfaces the event that was genuinely queued.
        frame_following = await gen.__anext__()
        return missed_id, following.id, frame_missed, frame_following

    missed_id, following_id, frame_missed, frame_following = asyncio.run(_with_run(scenario))
    assert f"id: {missed_id}" in frame_missed
    assert "agent.started" in frame_missed
    assert f"id: {following_id}" in frame_following
    assert "agent.completed" in frame_following


def test_heartbeat_is_sent_while_the_queue_is_idle():
    async def scenario(run_id: str):
        request = FakeRequest(disconnect_after=1)
        gen = _event_stream(request, run_id, 0)
        return await gen.__anext__()

    import app.api.stream as stream_module

    original = stream_module.HEARTBEAT_SECONDS
    stream_module.HEARTBEAT_SECONDS = 0.05
    try:
        frame = asyncio.run(_with_run(scenario))
    finally:
        stream_module.HEARTBEAT_SECONDS = original

    assert frame == HEARTBEAT


# --------------------------------------------------------------------------- #
# Endpoint error paths — safe to hit through the real HTTP layer because they
# return before any streaming begins.
# --------------------------------------------------------------------------- #


def test_stream_requires_authentication(client):
    response = client.get("/runs/000000000000000000000000/stream")
    assert response.status_code == 401


def test_stream_of_an_unknown_run_is_404(client, registered_user):
    response = client.get(
        "/runs/000000000000000000000000/stream", headers=registered_user["headers"]
    )
    assert response.status_code == 404


def test_stream_requires_ownership(client, registered_user):
    project = client.post(
        "/projects", json={"name": "P"}, headers=registered_user["headers"]
    ).json()
    run_id = client.post(
        "/runs",
        json={"project_id": project["id"], "prompt": "x"},
        headers=registered_user["headers"],
    ).json()["run_id"]

    other = client.post(
        "/auth/register", json={"email": "stream-other@example.com", "password": "secret12345"}
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    response = client.get(f"/runs/{run_id}/stream", headers=other_headers)
    assert response.status_code == 404
