"""Retry policy and graph recovery, without providers or a database."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.graph import recovery


def state(**changes):
    value = {
        "run_id": "run-1",
        "user_id": "user-1",
        "project_id": "project-1",
        "requirements": {"ok": True},
        "design": {"files": [{"path": "main.py"}]},
        "files": [{"path": "main.py", "content": "saved code"}],
        "review": None,
        "test_files": [],
        "tests": None,
        "errors": [{"agent": "reviewer", "code": "llm_exhausted"}],
        "approvals": {"pm": {"approved": True}, "architect": {"approved": True}},
        "loop_count": 2,
        "loop_history": [{"trigger": "reviewer"}, {"trigger": "tester"}],
        "status": "failed_llm",
        "finished_at": "2026-10-13T10:00:00Z",
    }
    return {**value, **changes}


def test_reviewer_retry_keeps_code_approvals_and_loop_budgets():
    saved = state()
    assert recovery.retry_stage(saved) == "reviewer"
    patch = recovery.retry_update(saved, "reviewer", 1)
    restored = {**saved, **patch}
    assert restored["files"] == [{"path": "main.py", "content": "saved code"}]
    assert restored["approvals"] == {"pm": {"approved": True}, "architect": {"approved": True}}
    assert restored["loop_count"] == 2
    assert len(restored["loop_history"]) == 2
    assert restored["finished_at"] is None
    assert restored["status"] == "running"
    assert restored["stage_retries"] == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"errors": [{"agent": "reviewer", "code": "ValueError"}]},
        {"review": {"passed": False}},
        {"approvals": {"pm": {"approved": True}}},
        {"stage_retries": 3},
        {"status": "failed_max_loops"},
        {"status": "succeeded"},
        {"status": "cancelled"},
    ],
)
def test_ineligible_failures_are_not_recoverable(changes):
    assert recovery.retry_stage(state(**changes)) is None


def test_partial_coder_can_recover_only_before_any_repair_loop():
    saved = state(
        files=[],
        errors=[{"agent": "coder", "code": "llm_exhausted"}],
        loop_history=[],
        loop_count=0,
    )
    assert recovery.retry_stage(saved) == "coder"
    assert recovery.retry_stage({**saved, "loop_history": [{"trigger": "reviewer"}]}) is None


def test_architect_recovery_requires_fresh_design_approval():
    saved = state(design=None, errors=[{"agent": "architect", "code": "llm_exhausted"}])
    assert recovery.retry_stage(saved) == "architect"
    patch = recovery.retry_update(saved, "architect", 1)
    assert patch["approvals"] == {"pm": {"approved": True}}
    assert patch["review"] is None and patch["tests"] is None


def test_recovered_provider_error_does_not_allow_retrying_a_later_unrelated_failure():
    saved = state(review={"passed": True}, errors=[{"agent": "reviewer", "code": "llm_exhausted"}])
    assert recovery.retry_stage(saved) is None


def test_stream_reload_reaches_latest_attempt_instead_of_old_failure(monkeypatch):
    from app.api.stream import _event_stream
    from app.events import bus
    from app.events.schemas import RunFailed, RunRetried, RunStarted

    history = [
        bus.Envelope(1, RunStarted(run_id="r", prompt="API")),
        bus.Envelope(2, RunFailed(status="failed_llm", reason="provider")),
        bus.Envelope(3, RunRetried(agent="reviewer", attempt=1)),
        bus.Envelope(4, RunFailed(status="failed_llm", reason="still unavailable")),
    ]

    async def replay(*args, **kwargs):
        return history

    monkeypatch.setattr(bus, "replay", replay)

    async def read():
        return [frame async for frame in _event_stream(SimpleNamespace(), "r", 0)]

    frames = asyncio.run(read())
    assert any('"run.retried"' in frame for frame in frames)
    assert len([frame for frame in frames if '"run.failed"' in frame]) == 1
    assert '"still unavailable"' in frames[-1]


@pytest.mark.parametrize("failed_stage", ["reviewer", "tester"])
def test_real_graph_recovery_skips_earlier_agents_and_preserves_loop_history(
    monkeypatch, failed_stage
):
    from langgraph.checkpoint.memory import InMemorySaver

    from app.events import bus, events
    from app.graph import build, executor, nodes
    from app.schemas.agents import Design, GeneratedFile, Requirements, ReviewResult, TestResult

    trace, emitted = [], []
    requirements = Requirements(
        project_name="API",
        summary="Contacts",
        entities=[{"name": "Contact", "fields": [{"name": "name", "type": "str"}]}],
        operations=["read"],
    )
    design = Design(
        collections=[{"name": "contacts", "fields": ["name"]}],
        endpoints=[
            {
                "method": "GET",
                "path": "/contacts",
                "response_model": "ContactRead",
                "status_code": 200,
            }
        ],
        files=[{"path": "main.py"}],
    )

    async def pm(s):
        trace.append("pm")
        return {"requirements": requirements}

    async def architect(s):
        trace.append("architect")
        return {"design": design}

    async def coder(s):
        trace.append("coder")
        return {"files": [GeneratedFile(path="main.py", content="saved code")]}

    async def reviewer(s):
        trace.append("reviewer")
        if s.get("stage_retries", 0) or failed_stage == "tester":
            return {"review": ReviewResult(passed=True, findings=[])}
        return {
            "status": "failed_llm",
            "review": None,
            "errors": [{"agent": "reviewer", "code": "llm_exhausted"}],
        }

    async def tester(s):
        trace.append("tester")
        if failed_stage == "tester" and not s.get("stage_retries", 0):
            return {
                "status": "failed_llm",
                "errors": [{"agent": "tester", "code": "llm_exhausted"}],
            }
        return (
            {"test_files": [GeneratedFile(path="test_main.py", content="test")]}
            if s.get("review")
            else {}
        )

    async def sandbox(s):
        trace.append("sandbox")
        return {"tests": TestResult(passed=True, total=1, failed=0)} if s.get("test_files") else {}

    async def no_db(*args, **kwargs):
        pass

    async def capture(run_id, event):
        emitted.append(event.event)

    for name, function in (
        ("pm_node", pm),
        ("architect_node", architect),
        ("coder_node", coder),
        ("reviewer_node", reviewer),
        ("tester_node", tester),
        ("sandbox_node", sandbox),
    ):
        monkeypatch.setattr(build, name, function)
    monkeypatch.setattr(nodes, "save_state", no_db)
    monkeypatch.setattr(events, "emit", capture)
    monkeypatch.setattr(executor, "mark_execution", no_db)
    monkeypatch.setattr(bus, "restore_counter", no_db)

    async def scenario():
        graph = build.build_graph().compile(
            checkpointer=InMemorySaver(), interrupt_before=["architect", "coder_gate"]
        )
        config = build.thread_config("run-1")
        initial = state(
            requirements=None, design=None, files=[], errors=[], status="running", finished_at=None
        )
        await graph.ainvoke(initial, config)
        assert (await graph.aget_state(config)).next == ("architect",)
        await graph.ainvoke(None, config)
        assert (await graph.aget_state(config)).next == ("coder_gate",)
        await graph.ainvoke(None, config)
        failed = await graph.aget_state(config)
        assert failed.next == ()
        assert failed.values["status"] == "failed_llm"
        trace.clear()
        await executor.retry_run(
            "run-1",
            graph,
            config,
            failed_stage,
            1,
            recovery.retry_update(failed.values, failed_stage, 1),
        )
        assert "run.retried" in emitted  # The HTTP response must not race its replay marker.
        await executor.await_all(5)
        result = await graph.aget_state(config)
        assert result.values["status"] == "succeeded"
        assert result.values["loop_count"] == 2
        assert result.values["files"][0].content == "saved code"
        assert trace == (
            ["reviewer", "tester", "sandbox"]
            if failed_stage == "reviewer"
            else ["tester", "sandbox"]
        )
        assert "run.retried" in emitted
        assert not executor.is_running("run-1")

    asyncio.run(scenario())


def test_partial_coder_recovery_keeps_completed_file_bytes():
    from app.graph.nodes import _generate_tree
    from app.llm.client import LLMResult
    from app.schemas.agents import Design, GeneratedFile

    generated = []

    class Coder:
        async def run_file(self, saved, spec):
            generated.append(spec.path)
            return LLMResult(
                value=SimpleNamespace(content="new code"), model="fixture", attempts=[]
            )

    design = Design(
        collections=[{"name": "items", "fields": ["name"]}],
        endpoints=[
            {"method": "GET", "path": "/items", "response_model": "Item", "status_code": 200}
        ],
        files=[{"path": "main.py"}, {"path": "schemas.py"}],
    )
    saved = {
        "retry_stage": "coder",
        "files": [GeneratedFile(path="main.py", content="original bytes")],
    }
    result = asyncio.run(_generate_tree(saved, Coder(), design))
    assert generated == ["schemas.py"]
    assert [(f.path, f.content) for f in result["files"]] == [
        ("main.py", "original bytes"),
        ("schemas.py", "new code"),
    ]
    assert result["retry_stage"] is None


@pytest.mark.parametrize("stage,next_node", [("pm", "architect"), ("architect", "coder_gate")])
def test_regenerated_plans_pause_for_human_approval(monkeypatch, stage, next_node):
    from langgraph.checkpoint.memory import InMemorySaver

    from app.events import bus, events
    from app.graph import build, executor
    from app.schemas.agents import Design, Requirements

    requirements = Requirements(
        project_name="API",
        summary="Items",
        entities=[{"name": "Item", "fields": [{"name": "name", "type": "str"}]}],
        operations=["read"],
    )
    design = Design(
        collections=[{"name": "items", "fields": ["name"]}],
        endpoints=[
            {"method": "GET", "path": "/items", "response_model": "Item", "status_code": 200}
        ],
        files=[{"path": "main.py"}],
    )

    async def pm(saved):
        return {"requirements": requirements}

    async def architect(saved):
        return {"design": design}

    async def no_io(*args, **kwargs):
        pass

    run = SimpleNamespace(state={}, status="running", save=AsyncMock())

    async def get_run(key):
        return run

    monkeypatch.setattr(build, "pm_node", pm)
    monkeypatch.setattr(build, "architect_node", architect)
    monkeypatch.setattr(executor, "mark_execution", no_io)
    monkeypatch.setattr(executor.Run, "get", get_run)
    monkeypatch.setattr(bus, "restore_counter", no_io)
    monkeypatch.setattr(events, "emit", no_io)

    async def scenario():
        graph = build.build_graph().compile(
            checkpointer=InMemorySaver(), interrupt_before=["architect", "coder_gate"]
        )
        config = build.thread_config("gate-run")
        failed = state(
            run_id="gate-run",
            requirements=None if stage == "pm" else requirements,
            design=None,
            files=[],
            errors=[{"agent": stage, "code": "llm_exhausted"}],
        )
        await graph.aupdate_state(config, failed, as_node="finalise")
        await executor.retry_run(
            "gate-run", graph, config, stage, 1, recovery.retry_update(failed, stage, 1)
        )
        await executor.await_all(5)
        snapshot = await graph.aget_state(config)
        assert snapshot.next == (next_node,)
        assert run.status == "awaiting_approval"
        assert snapshot.values["approvals"] == ({} if stage == "pm" else {"pm": {"approved": True}})

    asyncio.run(scenario())


def test_old_provider_error_does_not_hide_a_newer_non_provider_failure():
    saved = state(
        errors=[
            {"agent": "reviewer", "code": "llm_exhausted"},
            {"agent": "reviewer", "code": "ValueError"},
        ]
    )
    assert recovery.retry_stage(saved) is None


@pytest.mark.parametrize(
    "phase,next_node,missing",
    [("pm", "architect", "requirements"), ("architect", "coder_gate", "design")],
)
def test_provider_failure_before_approval_becomes_retryable_instead_of_empty_approval(
    monkeypatch, phase, next_node, missing
):
    from app.events import events
    from app.graph import executor

    saved = state(**{missing: None}, errors=[{"agent": phase, "code": "llm_exhausted"}])
    run = SimpleNamespace(state=saved.copy(), status="failed_llm", save=AsyncMock())
    monkeypatch.setattr(executor.Run, "get", AsyncMock(return_value=run))
    monkeypatch.setattr(events, "run_failed", AsyncMock())
    monkeypatch.setattr(
        events,
        "approval_required",
        AsyncMock(side_effect=AssertionError("Empty approvals must not be offered")),
    )
    graph = SimpleNamespace(
        aget_state=AsyncMock(return_value=SimpleNamespace(values=saved, next=(next_node,)))
    )
    asyncio.run(executor._after_invoke("run-1", graph, {}))
    assert run.status == "failed_llm"
    assert run.state["finished_at"] is not None
