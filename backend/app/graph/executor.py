"""Launching and resuming graph runs.

`POST /runs` returns 202 immediately and the pipeline continues here in the background
(FR-7). A run takes minutes; holding the HTTP request open for it would tie up a worker
and give the client nothing to watch.

The task is tracked so a run can be cancelled and so the process does not drop the only
reference to it — an un-referenced asyncio task can be garbage collected mid-flight.
"""

import asyncio
import contextlib
from datetime import datetime
from pathlib import Path
from typing import Any

from app.events import events
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Run

_running: dict[str, asyncio.Task] = {}

# `interrupt_before=["architect", "coder_gate"]` (graph/build.py) pauses the graph
# right before the named node runs — which is one step later than the approval it
# represents. Paused before "architect" means the PM's requirements are awaiting
# approval; paused before "coder_gate" means the Architect's design is. (The gate node
# exists so this never fires again on the loop's autonomous returns to "coder".)
_PHASE_BEFORE_NODE = {"architect": "pm", "coder_gate": "architect"}


def _approval_payload(phase: str, state: dict[str, Any]) -> dict[str, Any]:
    """Renders the paused step's output as the labelled facts the approval bar shows
    (design_handoff/README.md "Approval bar") — never the raw agent output."""
    if phase == "pm":
        req = state.get("requirements")
        if req is None:
            return {}
        if len(req.entities) == 1:
            entity = req.entities[0]
            entity_detail = f"{entity.name} — {', '.join(f.name for f in entity.fields)}"
        else:
            entity_detail = ", ".join(e.name for e in req.entities)
        return {
            "project_name": req.project_name,
            "entity": entity_detail,
            "operations": ", ".join(req.operations),
        }
    if phase == "architect":
        design = state.get("design")
        if design is None:
            return {}
        return {
            "endpoints": str(len(design.endpoints)),
            "collection": ", ".join(c.name for c in design.collections),
            "files_planned": ", ".join(Path(f.path).stem for f in design.files if f.path),
        }
    return {}


async def _after_invoke(run_id: str, graph, config: dict) -> None:
    """`graph.ainvoke` returns normally both when a run finishes and when it pauses at
    an `interrupt_before` node — nothing raises to tell the two apart. This is the only
    place that distinguishes them, and for a pause it does the two things the frontend
    needs: emits `approval.required` and marks the run paused so a reload reflects it."""
    snapshot = await graph.aget_state(config)
    if not snapshot.next:
        return  # reached END — finalise_node already emitted run.completed

    phase = _PHASE_BEFORE_NODE.get(snapshot.next[0])
    if phase is None:
        return

    run = await Run.get(run_id)
    if run is not None:
        run.status = "awaiting_approval"
        run.updated_at = datetime.now()
        await run.save()

    await events.approval_required(run_id, phase, _approval_payload(phase, snapshot.values))


def is_running(run_id: str) -> bool:
    task = _running.get(run_id)
    return task is not None and not task.done()


def cancel(run_id: str) -> bool:
    task = _running.get(run_id)
    if task is None or task.done():
        return False
    task.cancel()
    return True


async def _finish(run_id: str, status: str, reason: str) -> None:
    run = await Run.get(run_id)
    if run is not None:
        run.status = status
        run.updated_at = datetime.now()
        await run.save()
    await events.run_failed(run_id, status, reason)


async def _execute(run_id: str, state: dict[str, Any], with_approvals: bool) -> None:
    graph = compile_graph(with_approvals=with_approvals)
    config = thread_config(run_id)
    try:
        await graph.ainvoke(state, config=config)
        if with_approvals:
            await _after_invoke(run_id, graph, config)
    except asyncio.CancelledError:
        await _finish(run_id, "cancelled", "cancelled by the user")
        raise
    except Exception as exc:  # noqa: BLE001
        # A crash here would otherwise vanish into a background task nobody awaits.
        # NFR-5: every terminal state carries a machine-readable status and a reason.
        await _finish(run_id, "failed_llm", f"{type(exc).__name__}: {exc}"[:400])
    finally:
        _running.pop(run_id, None)


async def start_run(run: Run, *, with_approvals: bool = True) -> None:
    """Kick off a run in the background and return at once."""
    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=run.project_id,
        user_id=run.user_id,
        thread_id=run_id,  # one checkpointer thread per run
        user_prompt=run.prompt,
        rag_enabled=bool((run.state or {}).get("rag_enabled", True)),
    )

    run.status = "running"
    run.updated_at = datetime.now()
    await run.save()

    await events.run_started(run_id, run.prompt)

    task = asyncio.create_task(_execute(run_id, state, with_approvals))
    _running[run_id] = task


async def resume_run(run_id: str) -> None:
    """Continue a run that is paused at an approval checkpoint.

    Resuming means invoking the same thread with `None`: LangGraph picks up from the
    checkpoint rather than starting over.
    """
    if is_running(run_id):
        return

    graph = compile_graph(with_approvals=True)
    config = thread_config(run_id)

    async def _continue() -> None:
        try:
            await graph.ainvoke(None, config=config)
            await _after_invoke(run_id, graph, config)
        except asyncio.CancelledError:
            await _finish(run_id, "cancelled", "cancelled by the user")
            raise
        except Exception as exc:  # noqa: BLE001
            await _finish(run_id, "failed_llm", f"{type(exc).__name__}: {exc}"[:400])
        finally:
            _running.pop(run_id, None)

    task = asyncio.create_task(_continue())
    _running[run_id] = task


async def await_all(seconds: float | None = None) -> None:
    """Wait for in-flight runs. For tests and for a clean shutdown.

    The parameter is not called `timeout`: the async lint rules reserve that name for
    functions that pass it straight to a cancellation scope.
    """
    tasks = [t for t in _running.values() if not t.done()]
    if not tasks:
        return
    with contextlib.suppress(TimeoutError):
        async with asyncio.timeout(seconds):
            await asyncio.gather(*tasks, return_exceptions=True)
