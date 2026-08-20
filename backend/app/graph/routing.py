"""Conditional routing — the review ↔ test feedback loop.

This is the project's core technical contribution (CLAUDE.md §1). Two edges send work
back to the Coder:

  reviewer → coder   when the review reports blocking findings
  sandbox  → coder   when the executed tests fail

Each has its own budget, bounded by `MAX_LOOPS`. On exhaustion the run ends as
`failed_max_loops` with the last file tree and outstanding findings preserved: a partial
result is a reportable outcome, an infinite loop is a defect (NFR-6).

Split 2026-08-19: the two edges used to share one `loop_count` against one `MAX_LOOPS`.
A live run showed the failure mode that creates: the Reviewer alone took all 3
iterations to converge, so when the Sandbox then found a real, genuine bug on its very
first execution, there was zero budget left to act on it — the signal docs/AGENTS.md §7
calls authoritative ("the Reviewer has an opinion, the interpreter has a result") never
got a fix attempt at all. Each phase now gets its own full `MAX_LOOPS`, counted from
`loop_history`'s `trigger` field rather than a new counter, so a slow-to-converge review
can no longer starve the sandbox loop of every attempt.
"""

from typing import Any

from app.graph.state import DEFAULT_MAX_LOOPS, LoopTrigger

State = dict[str, Any]


def _max_loops(state: State) -> int:
    return state.get("max_loops") or DEFAULT_MAX_LOOPS


def loop_count_for(state: State, trigger: LoopTrigger) -> int:
    """How many fix passes this phase has already spent, from `loop_history`.

    Derived rather than tracked separately: `loop_history` already records which phase
    triggered each pass, so a second counter would just be a second source of truth to
    keep in sync.
    """
    return sum(1 for h in (state.get("loop_history") or []) if h.get("trigger") == trigger)


def _exhausted(state: State, trigger: LoopTrigger) -> bool:
    return loop_count_for(state, trigger) >= _max_loops(state)


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

    return "finalise" if _exhausted(state, "reviewer") else "coder"


def after_sandbox(state: State) -> str:
    """Failing tests send the code back. The sandbox's verdict is the authoritative one:
    the Reviewer has an opinion, the interpreter has a result."""
    tests = state.get("tests")
    if tests is None:
        return "finalise"  # nothing executed; there is nothing to fix against

    if tests.passed:
        return "finalise"

    return "finalise" if _exhausted(state, "tester") else "coder"


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
