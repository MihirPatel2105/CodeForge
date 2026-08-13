"""Graph nodes — one per agent.

A node is deliberately thin: call the agent, write the result into state, persist. It
never talks to Docker, Mongo or the event bus directly (CLAUDE.md §4).

Each node returns only the keys it changed; LangGraph merges them into RunState.
"""

from datetime import datetime
from typing import Any

from app.agents import ArchitectAgent, PMAgent, ReviewerAgent, SingleFileCoderAgent, TesterAgent
from app.core.exceptions import ProviderExhaustedError
from app.graph.persistence import save_state
from app.schemas.agents import Design, GeneratedFile, Requirements

State = dict[str, Any]


def _error(state: State, agent: str, exc: Exception) -> list[dict]:
    errors = list(state.get("errors") or [])
    errors.append(
        {
            "agent": agent,
            "code": "llm_exhausted"
            if isinstance(exc, ProviderExhaustedError)
            else type(exc).__name__,
            "message": str(exc)[:400],
            "at": datetime.now().isoformat(),
        }
    )
    return errors


async def pm_node(state: State) -> State:
    update: State = {"current_agent": "pm", "status": "running"}
    try:
        result = await PMAgent().run(state)
        update["requirements"] = result.value
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "pm": PMAgent.template_version,
        }
    except Exception as exc:
        update["errors"] = _error(state, "pm", exc)
        update["status"] = "failed_llm"

    await save_state({**state, **update})
    return update


async def architect_node(state: State) -> State:
    update: State = {"current_agent": "architect"}
    try:
        result = await ArchitectAgent().run(state)
        update["design"] = result.value
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "architect": ArchitectAgent.template_version,
        }
    except Exception as exc:
        update["errors"] = _error(state, "architect", exc)
        update["status"] = "failed_llm"

    await save_state({**state, **update})
    return update


async def coder_node(state: State) -> State:
    """Generates the tree one file per call.

    A whole-tree request breaches Groq's 8000 TPM ceiling and provokes nested tool-call
    rejections; per-file requests avoid both. A file that fails is skipped rather than
    aborting the run — the Reviewer will report what is missing, which is exactly the
    signal the loop is built to act on.
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

    coder = SingleFileCoderAgent()

    files: list[GeneratedFile] = []
    errors = list(state.get("errors") or [])

    for spec in design.files:
        try:
            result = await coder.run_file(state, spec)
            files.append(result.value.as_generated_file())
        except Exception as exc:
            errors = _error({"errors": errors}, "coder", exc)

    update: State = {
        "current_agent": "coder",
        "files": files,
        "errors": errors,
        "prompt_versions": {
            **(state.get("prompt_versions") or {}),
            "coder": SingleFileCoderAgent.template_version,
        },
    }
    if not files:
        update["status"] = "failed_llm"

    await save_state({**state, **update})
    return update


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

    try:
        result = await ReviewerAgent().run(state)
        update["review"] = result.value
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "reviewer": ReviewerAgent.template_version,
        }
    except Exception as exc:
        update["errors"] = _error(state, "reviewer", exc)
        update["status"] = "failed_llm"

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

    try:
        result = await TesterAgent().run(state)
        update["test_files"] = [result.value.as_generated_file()]
        update["prompt_versions"] = {
            **(state.get("prompt_versions") or {}),
            "tester": TesterAgent.template_version,
        }
    except Exception as exc:
        update["errors"] = _error(state, "tester", exc)
        update["status"] = "failed_llm"

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
        and state.get("review") is not None
    )

    update: State = {
        "current_agent": None,
        "finished_at": datetime.now(),
        "status": "succeeded" if complete else "failed_llm",
    }

    if not complete:
        reasons = []
        if missing:
            reasons.append(f"files not generated: {', '.join(missing)}")
        if state.get("review") is None:
            reasons.append("review did not run")
        if not state.get("test_files"):
            reasons.append("tests were not written")
        if reasons:
            errors = list(state.get("errors") or [])
            errors.append(
                {
                    "agent": None,
                    "code": "incomplete_pipeline",
                    "message": "; ".join(reasons),
                    "at": datetime.now().isoformat(),
                }
            )
            update["errors"] = errors

    await save_state({**state, **update})
    return update
