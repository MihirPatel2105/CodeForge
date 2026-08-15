"""The SSE event bus.

Mostly offline — `persist=False` keeps the database out of it. The replay tests need a
database, because replay deliberately reads the run document rather than any in-memory
buffer.
"""

import asyncio

import pytest

from app.events import bus, format_sse
from app.events import schemas as ev


@pytest.fixture(autouse=True)
def clean_bus():
    bus.reset()
    yield
    bus.reset()


def _emit(run_id: str, event, persist: bool = False):
    return asyncio.run(bus.emit(run_id, event, persist=persist))


def test_event_ids_are_monotonic():
    """A client resumes from the last id it saw, so ids must never repeat or go backwards."""
    first = _emit("r1", ev.RunStarted(run_id="r1", prompt="p"))
    second = _emit("r1", ev.AgentStarted(agent="pm"))
    third = _emit("r1", ev.AgentCompleted(agent="pm"))
    assert [first.id, second.id, third.id] == [1, 2, 3]


def test_runs_are_numbered_independently():
    _emit("r1", ev.AgentStarted(agent="pm"))
    _emit("r1", ev.AgentStarted(agent="architect"))
    other = _emit("r2", ev.AgentStarted(agent="pm"))
    assert other.id == 1, "one run's traffic must not advance another's ids"


def test_subscriber_receives_events():
    queue = bus.subscribe("r1")
    _emit("r1", ev.AgentMessage(agent="pm", text="hello"))
    envelope = queue.get_nowait()
    assert envelope.event.text == "hello"


def test_subscribers_are_isolated_per_run():
    queue = bus.subscribe("r1")
    _emit("r2", ev.AgentMessage(agent="pm", text="other run"))
    assert queue.empty(), "a client must only see its own run"


def test_slow_client_is_dropped_rather_than_blocking_the_run():
    """A dashboard that stops reading must not stall the pipeline. The client is dropped
    and recovers by reconnecting and replaying."""
    bus.subscribe("r1")
    for _ in range(bus.QUEUE_SIZE + 5):
        _emit("r1", ev.AgentMessage(agent="coder", text="x"))
    assert bus.subscriber_count("r1") == 0


def test_unsubscribe_removes_the_client():
    queue = bus.subscribe("r1")
    assert bus.subscriber_count("r1") == 1
    bus.unsubscribe("r1", queue)
    assert bus.subscriber_count("r1") == 0


def test_emitting_with_no_subscribers_is_harmless():
    """Most events are emitted before anyone opens the dashboard."""
    envelope = _emit("nobody-listening", ev.RunStarted(run_id="x", prompt="p"))
    assert envelope.id == 1


# --------------------------------------------------------------------------- #
# Wire format
# --------------------------------------------------------------------------- #


def test_wire_format_carries_id_event_and_data():
    envelope = _emit("r1", ev.LoopIteration(iteration=1, trigger="reviewer", blocking_findings=2))
    wire = format_sse(envelope.event, envelope.id)
    assert wire.startswith("id: 1\n")
    assert "event: loop.iteration\n" in wire
    assert wire.endswith("\n\n"), "an SSE frame ends with a blank line"


def test_loop_event_carries_everything_the_dashboard_needs():
    """The UI renders the loop moment without a follow-up request (docs/UI_BRIEF.md §4.2)."""
    envelope = _emit(
        "r1",
        ev.LoopIteration(iteration=2, trigger="tester", blocking_findings=0, failed_tests=3),
    )
    data = envelope.to_dict()["data"]
    assert data["iteration"] == 2
    assert data["trigger"] == "tester"
    assert data["failed_tests"] == 3


# --------------------------------------------------------------------------- #
# Replay — needs the database, since it reads the run document
# --------------------------------------------------------------------------- #


def test_replay_returns_events_after_the_given_id():
    """This is what makes reconnect seamless and a page reload cheap.

    Self-contained in one event loop: Beanie binds its client to the loop that
    initialised it, so borrowing the TestClient's connection from a fresh `asyncio.run`
    raises CollectionWasNotInitialized.
    """

    async def scenario():
        from app.db import connect, disconnect
        from app.models import Run

        await connect()
        run = Run(project_id="p", user_id="u", prompt="books api")
        await run.insert()
        run_id = str(run.id)

        try:
            await bus.emit(run_id, ev.RunStarted(run_id=run_id, prompt="books api"))
            await bus.emit(run_id, ev.AgentStarted(agent="pm"))
            await bus.emit(run_id, ev.AgentCompleted(agent="pm"))

            everything = await bus.replay(run_id)
            after_first = await bus.replay(run_id, after_id=1)
            return everything, after_first
        finally:
            await run.delete()
            await disconnect()

    everything, after_first = asyncio.run(scenario())
    assert len(everything) == 3
    assert [e.id for e in after_first] == [2, 3]


def test_replayed_events_keep_their_payload():
    """A reloaded dashboard rebuilds the timeline from these, so the content must survive
    the round trip to the database."""

    async def scenario():
        from app.db import connect, disconnect
        from app.models import Run

        await connect()
        run = Run(project_id="p", user_id="u", prompt="x")
        await run.insert()
        try:
            await bus.emit(
                str(run.id),
                ev.LoopIteration(iteration=1, trigger="reviewer", blocking_findings=2),
            )
            return [e.to_dict() for e in await bus.replay(str(run.id))]
        finally:
            await run.delete()
            await disconnect()

    stored = asyncio.run(scenario())
    assert stored[0]["event"] == "loop.iteration"
    assert stored[0]["data"]["blocking_findings"] == 2


def test_replay_of_an_unknown_run_is_empty():
    async def scenario():
        from app.db import connect, disconnect

        await connect()
        try:
            return await bus.replay("6a7e00000000000000000000")
        finally:
            await disconnect()

    assert asyncio.run(scenario()) == []
