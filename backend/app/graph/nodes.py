"""Graph nodes — one per agent.

A node is deliberately thin: call the agent, write the result into state, persist. It
never talks to Docker, Mongo or the event bus directly (CLAUDE.md §4).

Each node returns only the keys it changed; LangGraph merges them into RunState.
"""

import time
from datetime import UTC, datetime
from typing import Any

from app.agents import ArchitectAgent, PMAgent, ReviewerAgent, SingleFileCoderAgent, TesterAgent
from app.core.exceptions import ProviderExhaustedError
from app.db.artifacts import store_run_artifacts
from app.events import events
from app.graph.persistence import save_state
from app.graph.routing import loop_count_for, loop_trigger
from app.graph.state import DEFAULT_MAX_LOOPS
from app.llm.client import LLMResult
from app.sandbox import SANDBOX_IMAGE, parse_pytest, run_in_sandbox
from app.sandbox.runner import SandboxUnavailableError
from app.schemas.agents import Design, GeneratedFile, Requirements
from app.schemas.sandbox import SandboxRequest

State = dict[str, Any]


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _boot_probe_endpoint(endpoints: list[Any]) -> Any | None:
    """Prefer a GET route with no path id, so the boot check is not an id-validation test."""
    return next(
        (e for e in endpoints if e.method == "GET" and "{" not in e.path),
        next((e for e in endpoints if e.method == "GET"), endpoints[0] if endpoints else None),
    )


def _collect_usage(attempts: list[dict], tokens: int, result: LLMResult) -> tuple[list[dict], int]:
    recorded = [
        {
            **attempt.model_dump(),
            "fallback": index < len(result.attempts) - 1
            and result.attempts[index + 1].model != attempt.model,
        }
        for index, attempt in enumerate(result.attempts)
    ]
    return [*attempts, *recorded], tokens + result.tokens


def _usage_update(state: State, result: LLMResult) -> State:
    attempts, tokens = _collect_usage(
        list(state.get("llm_attempts") or []), int(state.get("llm_tokens") or 0), result
    )
    return {"llm_attempts": attempts, "llm_tokens": tokens}


def _failed_attempts(previous: list[dict], exc: Exception) -> list[dict]:
    if not isinstance(exc, ProviderExhaustedError):
        return previous
    return [
        *previous,
        *(
            {
                **attempt.model_dump(),
                "fallback": index < len(exc.attempts) - 1
                and exc.attempts[index + 1].model != attempt.model,
            }
            for index, attempt in enumerate(exc.attempts)
        ),
    ]


def _failed_usage_update(state: State, exc: Exception) -> State:
    return {"llm_attempts": _failed_attempts(list(state.get("llm_attempts") or []), exc)}


# The files other files' names and types get checked against. Never main.py: nothing
# imports from it, and it is usually the largest file, so including it would blow the
# same token budget this selective-context exception exists to protect.
_CONTRACT_FILES = ("database.py", "models.py", "schemas.py")


def _sibling_context(by_path: dict[str, GeneratedFile], exclude: str) -> str:
    parts = [
        f"# {name}\n{by_path[name].content}"
        for name in _CONTRACT_FILES
        if name != exclude and name in by_path
    ]
    return "\n\n".join(parts)


def _error(state: State, agent: str, exc: Exception) -> list[dict]:
    errors = list(state.get("errors") or [])
    errors.append(
        {
            "agent": agent,
            "code": "llm_exhausted"
            if isinstance(exc, ProviderExhaustedError)
            else type(exc).__name__,
            "message": str(exc)[:400],
            "at": datetime.now(UTC).isoformat(),
        }
    )
    return errors


async def pm_node(state: State) -> State:
    run_id = state["run_id"]
    update: State = {"current_agent": "pm", "status": "running"}
    started = time.monotonic()

    await events.agent_started(run_id, "pm")
    try:
        result = await PMAgent().run(state)
        update.update(_usage_update(state, result))
        requirements = result.value
        update["requirements"] = requirements
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "pm": PMAgent.template_version,
        }
        await events.agent_message(run_id, "pm", events.describe_requirements(requirements))
        await events.agent_completed(
            run_id,
            "pm",
            {
                "entities": len(requirements.entities),
                "operations": len(requirements.operations),
                "model": result.model,
            },
            _elapsed_ms(started),
        )
    except Exception as exc:
        update.update(_failed_usage_update(state, exc))
        update["errors"] = _error(state, "pm", exc)
        update["status"] = "failed_llm"
        await events.agent_failed(run_id, "pm", "llm_exhausted", str(exc))

    await save_state({**state, **update})
    return update


async def architect_node(state: State) -> State:
    run_id = state["run_id"]
    update: State = {"current_agent": "architect"}
    started = time.monotonic()

    await events.agent_started(run_id, "architect")
    try:
        result = await ArchitectAgent().run(state)
        update.update(_usage_update(state, result))
        design = result.value
        update["design"] = design
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "architect": ArchitectAgent.template_version,
        }
        await events.agent_message(run_id, "architect", events.describe_design(design))
        await events.agent_completed(
            run_id,
            "architect",
            {
                "endpoints": len(design.endpoints),
                "files": len(design.files),
                "model": result.model,
            },
            _elapsed_ms(started),
        )
    except Exception as exc:
        update.update(_failed_usage_update(state, exc))
        update["errors"] = _error(state, "architect", exc)
        update["status"] = "failed_llm"
        await events.agent_failed(run_id, "architect", "llm_exhausted", str(exc))

    await save_state({**state, **update})
    return update


async def coder_gate_node(state: State) -> State:
    """No-op passthrough.

    `interrupt_before` in LangGraph fires on every entry to the named node, not just
    the first. Putting it directly on "coder" would re-pause for human approval on
    every autonomous review/test loop-back too, defeating the loop's entire purpose
    (CLAUDE.md's "core technical contribution"). This node exists purely so the
    interrupt has something to target that only the Architect's edge passes through —
    the Reviewer's and Sandbox's loop-back edges go straight to "coder", bypassing it.
    """
    return {}


async def coder_node(state: State) -> State:
    """Generates the tree one file per call.

    A whole-tree request breaches Groq's 8000 TPM ceiling and provokes nested tool-call
    rejections; per-file requests avoid both. A failed file leaves a partial tree,
    which the fix loop can complete on a later pass.
    """
    design: Design | None = state.get("design")
    if design is None:
        # The Architect failed. Skip rather than raise: an unhandled exception here
        # escapes the graph and kills the run, which NFR-5 forbids.
        update = {
            "current_agent": "coder",
            "status": "failed_llm",
            "errors": _error(state, "coder", RuntimeError("no design to build from")),
        }
        await save_state({**state, **update})
        return update

    run_id = state["run_id"]
    coder = SingleFileCoderAgent()
    trigger = loop_trigger(state)
    started = time.monotonic()

    if trigger is None:
        await events.agent_started(run_id, "coder")
        update = await _generate_tree(state, coder, design)
    else:
        # The loop event goes out BEFORE the work starts, so the dashboard shows the
        # return arc firing while the Coder is thinking rather than after it finishes.
        # This is the moment the demo is built around (docs/UI_BRIEF.md §4.2).
        review = state.get("review")
        tests = state.get("tests")
        await events.loop_iteration(
            run_id,
            iteration=state.get("loop_count", 0) + 1,
            trigger=trigger,
            blocking=len(review.blocking) if review else 0,
            failed_tests=tests.failed if tests else 0,
        )
        await events.agent_started(run_id, "coder", iteration=state.get("loop_count", 0) + 1)
        update = await _fix_tree(state, coder, trigger)

    for generated in update.get("files") or []:
        await events.file_written(run_id, generated.path, generated.content)

    await events.agent_completed(
        run_id,
        "coder",
        {"files": len(update.get("files") or []), "fix_pass": trigger is not None},
        _elapsed_ms(started),
    )

    update["current_agent"] = "coder"
    update["prompt_versions"] = {
        **(state.get("prompt_versions") or {}),
        "coder": SingleFileCoderAgent.template_version,
    }
    if not update.get("files"):
        update["status"] = "failed_llm"

    await save_state({**state, **update})
    return update


async def _generate_tree(state: State, coder, design: Design) -> State:
    """First pass: write every file in the Design, one call per file."""
    files: list[GeneratedFile] = []
    errors = list(state.get("errors") or [])
    attempts = list(state.get("llm_attempts") or [])
    tokens = int(state.get("llm_tokens") or 0)

    for spec in design.files:
        try:
            result = await coder.run_file(state, spec)
            attempts, tokens = _collect_usage(attempts, tokens, result)
            files.append(GeneratedFile(path=spec.path, content=result.value.content))
        except Exception as exc:
            attempts = _failed_attempts(attempts, exc)
            errors = _error({"errors": errors}, "coder", exc)

    return {"files": files, "errors": errors, "llm_attempts": attempts, "llm_tokens": tokens}


async def _fix_tree(state: State, coder, trigger: str) -> State:
    """Fix pass: rewrite only the files the findings or failures point at.

    Regenerating the whole tree would discard files that already work and cost four
    generations to fix one bug. `loop_count` increments here — on the return to the
    Coder — which is what `MAX_LOOPS` bounds (docs/AGENTS.md §7).
    """
    files: list[GeneratedFile] = list(state.get("files") or [])
    by_path = {f.path: f for f in files}
    errors = list(state.get("errors") or [])
    attempts = list(state.get("llm_attempts") or [])
    tokens = int(state.get("llm_tokens") or 0)

    problems = _problems_by_file(state)
    design_specs = {spec.path: spec for spec in state["design"].files}
    for path in design_specs:
        if path not in by_path:
            problems.setdefault(path, []).append("- required file missing from the first pass")
    iteration = state.get("loop_count", 0) + 1
    changed: list[str] = []

    for path, issues in problems.items():
        current = by_path.get(path)
        if current is None:
            spec = design_specs.get(path)
            if spec is None:
                errors = _error(
                    {"errors": errors},
                    "coder",
                    RuntimeError(f"review names {path!r}, which the design never specified"),
                )
                continue
            try:
                result = await coder.run_file({**state, "loop_count": iteration}, spec)
                attempts, tokens = _collect_usage(attempts, tokens, result)
                by_path[path] = GeneratedFile(path=path, content=result.value.content)
                changed.append(path)
            except Exception as exc:
                attempts = _failed_attempts(attempts, exc)
                errors = _error({"errors": errors}, "coder", exc)
            continue
        try:
            result = await coder.run_fix(
                state,
                path=path,
                current=current.content,
                problems="\n".join(issues),
                siblings=_sibling_context(by_path, exclude=path),
            )
            attempts, tokens = _collect_usage(attempts, tokens, result)
            by_path[path] = GeneratedFile(path=path, content=result.value.content)
            changed.append(path)
        except Exception as exc:
            attempts = _failed_attempts(attempts, exc)
            errors = _error({"errors": errors}, "coder", exc)

    record = {
        "iteration": iteration,
        "trigger": trigger,
        "blocking_findings": len(state["review"].blocking) if state.get("review") else 0,
        "failed_tests": state["tests"].failed if state.get("tests") else 0,
        "files_changed": changed,
        "at": datetime.now(UTC).isoformat(),
    }

    return {
        "files": [
            by_path[path]
            for path in dict.fromkeys([*(f.path for f in files), *design_specs])
            if path in by_path
        ],
        "errors": errors,
        "llm_attempts": attempts,
        "llm_tokens": tokens,
        "loop_count": iteration,
        "loop_history": [*(state.get("loop_history") or []), record],
        # Cleared so the next reviewer/sandbox verdict is judged fresh rather than
        # against the failures that triggered this pass.
        "review": None,
        "tests": None,
    }


def _problems_by_file(state: State) -> dict[str, list[str]]:
    """Group the outstanding problems by the file that must change.

    Only blocking findings and real test failures — a warning is not worth a generation.
    """
    problems: dict[str, list[str]] = {}

    review = state.get("review")
    if review is not None:
        for finding in review.blocking:
            line = f" (line {finding.line})" if finding.line else ""
            problems.setdefault(finding.file, []).append(
                f"- {finding.issue}{line}\n  Fix: {finding.fix_hint}"
            )

    tests = state.get("tests")
    if tests is not None and not tests.passed:
        # Test failures rarely name the file at fault, so they go to the application
        # entry point, which is where the routes and wiring live.
        target = "main.py"
        for failure in tests.failures[:6]:
            problems.setdefault(target, []).append(
                f"- test {failure.test_name} failed: {failure.assertion}\n"
                f"  {failure.traceback_tail[:300]}"
            )
        if not tests.failures and tests.stdout_tail:
            problems.setdefault(target, []).append(
                f"- the test suite did not run:\n{tests.stdout_tail[-600:]}"
            )

    return problems


async def reviewer_node(state: State) -> State:
    update: State = {"current_agent": "reviewer"}

    if state.get("design") is None or not state.get("files"):
        # Nothing to work on. Skipping keeps the run alive so `finalise` can report an
        # honest partial result instead of the graph raising (NFR-5).
        update["errors"] = _error(
            state, "reviewer", RuntimeError("no design or files to work from")
        )
        await save_state({**state, **update})
        return update

    run_id = state["run_id"]
    started = time.monotonic()
    await events.agent_started(run_id, "reviewer", iteration=state.get("loop_count", 0))
    try:
        result = await ReviewerAgent().run(state)
        update.update(_usage_update(state, result))
        review = result.value
        update["review"] = review
        history = list(state.get("loop_history") or [])
        if history and history[-1].get("outcome") is None:
            history[-1] = {
                **history[-1],
                "outcome": "review_cleared" if review.passed else "review_still_blocking",
            }
            update["loop_history"] = history
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "reviewer": ReviewerAgent.template_version,
        }
        # The first blocking finding, verbatim: this is the line that explains to a
        # viewer why the loop is about to fire.
        if review.blocking:
            first = review.blocking[0]
            await events.agent_message(run_id, "reviewer", f"{first.file}: {first.issue}")
        await events.agent_message(run_id, "reviewer", events.describe_review(review))
        await events.agent_completed(
            run_id,
            "reviewer",
            {
                "findings": len(review.findings),
                "blocking": len(review.blocking),
                "passed": review.passed,
            },
            _elapsed_ms(started),
        )
    except Exception as exc:
        update.update(_failed_usage_update(state, exc))
        update["errors"] = _error(state, "reviewer", exc)
        update["status"] = "failed_llm"
        await events.agent_failed(run_id, "reviewer", "llm_exhausted", str(exc))

    await save_state({**state, **update})
    return update


async def tester_node(state: State) -> State:
    update: State = {"current_agent": "tester"}

    if state.get("design") is None or not state.get("files"):
        # Nothing to work on. Skipping keeps the run alive so `finalise` can report an
        # honest partial result instead of the graph raising (NFR-5).
        update["errors"] = _error(state, "tester", RuntimeError("no design or files to work from"))
        await save_state({**state, **update})
        return update

    run_id = state["run_id"]
    started = time.monotonic()
    await events.agent_started(run_id, "tester", iteration=state.get("loop_count", 0))
    try:
        result = await TesterAgent().run(state)
        update.update(_usage_update(state, result))
        test_file = result.value.as_generated_file()
        update["test_files"] = [test_file]
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "tester": TesterAgent.template_version,
        }
        await events.file_written(run_id, test_file.path, test_file.content)
        await events.agent_completed(
            run_id, "tester", {"files": 1, "model": result.model}, _elapsed_ms(started)
        )
    except Exception as exc:
        update.update(_failed_usage_update(state, exc))
        update["errors"] = _error(state, "tester", exc)
        update["status"] = "failed_llm"
        await events.agent_failed(run_id, "tester", "llm_exhausted", str(exc))

    await save_state({**state, **update})
    return update


async def sandbox_node(state: State) -> State:
    """Execute the generated tree and record what happened.

    The first node whose outcome is not an opinion: the Reviewer thinks the code is
    right, the sandbox finds out. Its `TestResult` is what the Phase 6 loop routes on.
    """
    update: State = {"current_agent": None}

    files: list[GeneratedFile] = state.get("files") or []
    test_files: list[GeneratedFile] = state.get("test_files") or []

    if not files or not test_files:
        update["errors"] = _error(
            state, "sandbox", RuntimeError("nothing to execute: missing code or tests")
        )
        await save_state({**state, **update})
        return update

    run_id = state["run_id"]
    design: Design | None = state.get("design")
    endpoints = list(design.endpoints) if design else []
    probe = _boot_probe_endpoint(endpoints)
    request = SandboxRequest(
        run_id=run_id,
        files=files + test_files,
        probe_method=probe.method if probe else None,
        probe_path=probe.path if probe else None,
    )
    await events.sandbox_started(run_id, SANDBOX_IMAGE)

    try:
        result = await run_in_sandbox(request)
    except SandboxUnavailableError as exc:
        # Docker missing is a property of the host, not of the generated code.
        # docs/ACCEPTANCE.md §3 excludes these runs from the metrics.
        update["errors"] = _error(state, "sandbox", exc)
        update["status"] = "failed_sandbox"
        await events.agent_failed(run_id, "sandbox", "sandbox_unavailable", str(exc))
        await save_state({**state, **update})
        return update

    update["sandbox"] = result
    tests = parse_pytest(result)
    update["tests"] = tests

    # Stream the container's own output so the viewer sees real pytest lines, not a
    # summary of them. Tail only: a full log would flood the timeline.
    for line in result.stdout.strip().splitlines()[-12:]:
        await events.sandbox_output(run_id, line + "\n")
    if result.stderr.strip():
        await events.sandbox_output(run_id, result.stderr.strip()[-500:], stream="stderr")

    await events.tests_result(run_id, tests.passed, tests.total, tests.failed)

    if result.timed_out:
        update["errors"] = _error(
            state, "sandbox", RuntimeError(f"execution exceeded {request.timeout_s}s")
        )

    try:
        await store_run_artifacts(
            run_id=state["run_id"],
            files=files,
            test_files=test_files,
            sandbox=result,
            tests=update["tests"],
            iteration=state.get("loop_count", 0),
        )
    except Exception as exc:  # noqa: BLE001
        # Losing the artifacts is bad; losing the run because of it would be worse.
        update["errors"] = _error({**state, **update}, "sandbox", exc)

    await save_state({**state, **update})
    return update


async def finalise_node(state: State) -> State:
    """Terminal bookkeeping. The status set here is what the dashboard and the Phase 8
    metrics read, so it must not flatter the run.

    A Phase 4 run only succeeds if the pipeline actually completed: every file the
    Architect designed was written, tests exist, and the review ran. An earlier version
    checked only that *some* files existed and reported success on a tree missing a
    module that was never reviewed.
    """
    requirements: Requirements | None = state.get("requirements")
    design: Design | None = state.get("design")
    files: list[GeneratedFile] = state.get("files") or []

    missing: list[str] = []
    if design:
        written = {f.path for f in files}
        missing = [spec.path for spec in design.files if spec.path not in written]

    complete = bool(
        requirements
        and design
        and files
        and not missing
        and state.get("test_files")
        and state.get("tests") is not None  # the sandbox actually ran
    )

    # A run that used up its fix passes and still fails gets its own status: the loop
    # cap working as designed is a different outcome from an agent dying, and Phase 8's
    # failure taxonomy separates them (docs/ACCEPTANCE.md §4).
    # Each phase has its own budget (routing.py, split 2026-08-19), so exhaustion means
    # either one ran out — whichever was actually blocking progress when the graph
    # stopped routing back to the Coder.
    tests = state.get("tests")
    max_loops = state.get("max_loops") or DEFAULT_MAX_LOOPS
    exhausted = (
        loop_count_for(state, "reviewer") >= max_loops
        or loop_count_for(state, "tester") >= max_loops
    )
    still_failing = tests is None or not tests.passed

    if complete and tests is not None and tests.passed:
        status = "succeeded"
    elif exhausted and still_failing:
        status = "failed_max_loops"
    else:
        status = "failed_llm"

    update: State = {
        "current_agent": None,
        "finished_at": datetime.now(UTC),
        "status": status,
    }

    history = list(state.get("loop_history") or [])
    if history and history[-1].get("outcome") is None:
        history[-1] = {**history[-1], "outcome": status}
        update["loop_history"] = history

    reasons: list[str] = []
    if not complete:
        if missing:
            reasons.append(f"files not generated: {', '.join(missing)}")
        if not state.get("test_files"):
            reasons.append("tests were not written")
        if state.get("tests") is None:
            reasons.append("the sandbox did not execute the code")
        if reasons:
            errors = list(state.get("errors") or [])
            errors.append(
                {
                    "agent": None,
                    "code": "incomplete_pipeline",
                    "message": "; ".join(reasons),
                    "at": datetime.now(UTC).isoformat(),
                }
            )
            update["errors"] = errors

    # Emitted last, once the outcome and its reasons are both settled — the dashboard
    # closes the run on this event, so it must carry the final word.
    started_at = state.get("started_at")
    if started_at is not None and started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=UTC)
    duration_ms = int((datetime.now(UTC) - started_at).total_seconds() * 1000) if started_at else 0
    if status == "succeeded":
        await events.run_completed(state["run_id"], status, state.get("loop_count", 0), duration_ms)
    else:
        await events.run_failed(state["run_id"], status, "; ".join(reasons) if reasons else status)

    await save_state({**state, **update})
    return update
