"""The review ↔ test feedback loop's routing decisions.

The project's core technical contribution. These run offline — routing is pure logic over
state — so every branch is covered without spending a generation.
"""

from app.graph.routing import after_reviewer, after_sandbox, loop_trigger
from app.schemas.agents import Finding, ReviewResult, TestFailure, TestResult


def _review(*severities: str) -> ReviewResult:
    return ReviewResult(
        findings=[Finding(severity=s, file="main.py", issue="i", fix_hint="f") for s in severities]
    )


def _tests(passed: bool, failed: int = 0) -> TestResult:
    return TestResult(
        passed=passed,
        total=4,
        failed=failed,
        failures=[TestFailure(test_name="t", assertion="a", traceback_tail="")] * failed,
    )


def _history(trigger: str, n: int) -> list[dict]:
    """`n` prior fix passes attributed to `trigger` — each phase's budget is counted
    from `loop_history`, not a shared counter (routing.py, split 2026-08-19)."""
    return [{"trigger": trigger} for _ in range(n)]


# --------------------------------------------------------------------------- #
# reviewer -> ?
# --------------------------------------------------------------------------- #


def test_clean_review_advances_to_testing():
    assert after_reviewer({"review": _review(), "loop_count": 0}) == "tester"


def test_blocking_finding_sends_code_back():
    assert after_reviewer({"review": _review("blocking"), "loop_count": 0}) == "coder"


def test_warnings_and_nits_never_loop():
    """Spending a free-tier generation on a style opinion is how the quota disappears."""
    state = {"review": _review("warning", "nit"), "loop_count": 0}
    assert after_reviewer(state) == "tester"


def test_blocking_finding_at_the_cap_gives_up_gracefully():
    state = {
        "review": _review("blocking"),
        "loop_history": _history("reviewer", 3),
        "max_loops": 3,
    }
    assert after_reviewer(state) == "finalise", "must not loop past the cap"


def test_reviewer_budget_is_independent_of_the_sandbox_budget():
    """A sandbox loop that already spent the whole cap must not starve the reviewer's
    own budget — each phase gets its own (routing.py, split 2026-08-19)."""
    state = {
        "review": _review("blocking"),
        "loop_history": _history("tester", 3),
        "max_loops": 3,
    }
    assert after_reviewer(state) == "coder"


def test_missing_review_still_gets_tested():
    """If the Reviewer failed, testing what was written beats looping on an opinion
    nobody has."""
    assert after_reviewer({"review": None, "loop_count": 0}) == "tester"


# --------------------------------------------------------------------------- #
# sandbox -> ?
# --------------------------------------------------------------------------- #


def test_passing_tests_finish_the_run():
    assert after_sandbox({"tests": _tests(True), "loop_count": 0}) == "finalise"


def test_failing_tests_send_code_back():
    assert after_sandbox({"tests": _tests(False, failed=2), "loop_count": 1}) == "coder"


def test_failing_tests_at_the_cap_give_up_gracefully():
    state = {
        "tests": _tests(False, failed=2),
        "loop_history": _history("tester", 3),
        "max_loops": 3,
    }
    assert after_sandbox(state) == "finalise"


def test_sandbox_budget_is_independent_of_the_reviewer_budget():
    """A reviewer loop that already spent the whole cap must not starve the sandbox's
    own budget — this is the exact failure a live run hit before the split
    (routing.py, 2026-08-19): the review alone used all 3 iterations, leaving the
    sandbox's own genuine, authoritative failure with zero budget to act on."""
    state = {
        "tests": _tests(False, failed=1),
        "loop_history": _history("reviewer", 3),
        "max_loops": 3,
    }
    assert after_sandbox(state) == "coder"


def test_no_execution_means_nothing_to_fix_against():
    assert after_sandbox({"tests": None, "loop_count": 0}) == "finalise"


def test_default_cap_applies_when_state_omits_it():
    """A state missing max_loops must not be treated as unbounded."""
    state = {"tests": _tests(False, failed=1), "loop_history": _history("tester", 3)}
    assert after_sandbox(state) == "finalise"


# --------------------------------------------------------------------------- #
# why the Coder is being re-entered
# --------------------------------------------------------------------------- #


def test_first_pass_has_no_trigger():
    assert loop_trigger({}) is None


def test_review_failure_is_attributed_to_the_reviewer():
    assert loop_trigger({"review": _review("blocking")}) == "reviewer"


def test_test_failure_outranks_a_stale_review():
    """Execution is the authoritative signal, so it names the trigger."""
    state = {"review": _review("blocking"), "tests": _tests(False, failed=1)}
    assert loop_trigger(state) == "tester"


def test_clean_state_has_no_trigger():
    assert loop_trigger({"review": _review(), "tests": _tests(True)}) is None
