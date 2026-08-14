"""Turn a sandbox run into a `TestResult`.

pytest's summary line is parsed rather than its JSON report plugin: `pytest-json-report`
is another package to bake into the image and another thing a generated app could break.
The summary format has been stable for years and the container's exit status is the
authoritative pass/fail signal regardless.
"""

import re

from app.schemas.agents import TestFailure, TestResult
from app.schemas.sandbox import SandboxResult

# "2 failed, 3 passed, 1 skipped in 1.23s"
_COUNT = re.compile(r"(\d+)\s+(passed|failed|error|errors|skipped|xfailed|xpassed)")

# "FAILED test_main.py::test_create - assert 201 == 200"
_FAILED_LINE = re.compile(r"^FAILED\s+(\S+?)\s*(?:-\s*(.*))?$", re.MULTILINE)

# pytest exits 2-5 for collection/usage errors: the suite never really ran
_SUITE_DID_NOT_RUN = {2, 3, 4, 5}


def parse_pytest(sandbox: SandboxResult) -> TestResult:
    """Build a `TestResult` from captured output.

    `passed` is derived from the exit status, never from the text: a suite that could not
    be collected prints nothing useful, and treating that as "0 failures" would report a
    broken run as a success (docs/ACCEPTANCE.md L4).
    """
    text = f"{sandbox.stdout}\n{sandbox.stderr}"
    counts: dict[str, int] = {}
    for value, label in _COUNT.findall(text):
        counts[label] = counts.get(label, 0) + int(value)

    passed_count = counts.get("passed", 0)
    failed_count = counts.get("failed", 0) + counts.get("error", 0) + counts.get("errors", 0)
    total = passed_count + failed_count + counts.get("skipped", 0)

    failures = [
        TestFailure(
            test_name=name,
            assertion=(reason or "").strip()[:400],
            traceback_tail=_traceback_tail(text, name),
        )
        for name, reason in _FAILED_LINE.findall(text)
    ]

    suite_ran = sandbox.exit_code not in _SUITE_DID_NOT_RUN and not sandbox.timed_out
    all_green = suite_ran and sandbox.exit_code == 0 and total > 0

    return TestResult(
        passed=all_green,
        total=total,
        failed=failed_count,
        failures=failures,
        stdout_tail=sandbox.stdout[-4000:],
    )


def _traceback_tail(text: str, test_name: str, lines: int = 12) -> str:
    """The last few lines of a failure's traceback, for the Coder's fix pass.

    Only the tail: the fix prompt carries the outstanding findings and affected files,
    not the full history (docs/AGENTS.md §4).
    """
    short_name = test_name.split("::")[-1]
    marker = text.find(f"_ {short_name} _")
    if marker == -1:
        return ""
    block = text[marker : marker + 4000].splitlines()
    return "\n".join(block[1 : lines + 1]).strip()


def summarise(result: TestResult) -> str:
    """One line for the dashboard timeline and log output."""
    if result.total == 0:
        return "no tests ran"
    return f"{result.total - result.failed}/{result.total} passed"
