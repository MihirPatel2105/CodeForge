"""Conditional routing — the review ↔ test feedback loop.

This is the project's core technical contribution (CLAUDE.md §1). Two edges send work
back to the Coder:

  reviewer → coder   when the review reports blocking findings
  sandbox  → coder   when the executed tests fail

Both are bounded by `MAX_LOOPS`. On exhaustion the run ends as `failed_max_loops` with
the last file tree and outstanding findings preserved: a partial result is a reportable
outcome, an infinite loop is a defect (NFR-6).
"""

from typing import Any

from app.graph.state import DEFAULT_MAX_LOOPS

State = dict[str, Any]


def _max_loops(state: State) -> int:
    return state.get("max_loops") or DEFAULT_MAX_LOOPS


def _exhausted(state: State) -> bool:
    return state.get("loop_count", 0) >= _max_loops(state)


def after_reviewer(state: State) -> str:
    """Blocking findings send the code back; anything else moves on to testing.

    Warnings and nits never trigger a loop — spending a free-tier generation on a style
    opinion is how the quota disappears (docs/AGENTS.md §5).
    """
    review = state.get("review")
    if review is None:
        # The reviewer failed. Testing what was written is more useful than looping on
        # an opinion nobody has.
        return "tester"

    if review.passed:
        return "tester"

    return "finalise" if _exhausted(state) else "coder"


def after_sandbox(state: State) -> str:
    """Failing tests send the code back. The sandbox's verdict is the authoritative one:
    the Reviewer has an opinion, the interpreter has a result."""
    tests = state.get("tests")
    if tests is None:
        return "finalise"  # nothing executed; there is nothing to fix against

    if tests.passed:
        return "finalise"

    return "finalise" if _exhausted(state) else "coder"


def loop_trigger(state: State) -> str | None:
    """Why the Coder is being re-entered, or None on the first pass.

    The Coder needs this to know whether it is writing a file tree from scratch or
    fixing specific problems, and `loop_history` needs it for the metrics.
    """
    tests = state.get("tests")
    if tests is not None and not tests.passed:
        return "tester"

    review = state.get("review")
    if review is not None and not review.passed:
        return "reviewer"

    return None
