"""Sandbox report parsing and packing.

Offline: no Docker, no containers. The execution properties that need a real daemon live
in `test_sandbox_live.py`.
"""

import tarfile
from io import BytesIO

from app.sandbox.report import parse_pytest, summarise
from app.sandbox.runner import _tar_bytes
from app.schemas.agents import GeneratedFile
from app.schemas.sandbox import SandboxResult


def _result(stdout: str, exit_code: int = 0, timed_out: bool = False) -> SandboxResult:
    return SandboxResult(exit_code=exit_code, stdout=stdout, stderr="", timed_out=timed_out)


def test_all_passing_is_a_pass():
    result = parse_pytest(_result("....\n4 passed in 0.31s", exit_code=0))
    assert result.passed
    assert result.total == 4
    assert result.failed == 0
    assert result.pass_ratio == 1.0


def test_mixed_results_are_counted():
    result = parse_pytest(
        _result(
            "FAILED test_main.py::test_two - assert 201 == 200\n5 failed, 11 passed in 0.30s",
            exit_code=1,
        )
    )
    assert not result.passed
    assert result.total == 16
    assert result.failed == 5
    assert summarise(result) == "11/16 passed"
    assert result.failures[0].test_name == "test_main.py::test_two"
    assert "201 == 200" in result.failures[0].assertion


def test_collection_error_is_not_reported_as_zero_failures():
    """pytest exits 2 when the suite could not even be collected — an import error, say.
    Counting that as "no failures" would report a broken app as a success (L4)."""
    result = parse_pytest(
        _result("ERROR test_main.py\nInterrupted: 1 error during collection", exit_code=2)
    )
    assert not result.passed
    assert result.pass_ratio == 0.0


def test_timeout_is_never_a_pass():
    result = parse_pytest(_result("2 passed in 0.10s", exit_code=0, timed_out=True))
    assert not result.passed, "a killed run must not count as green"


def test_empty_suite_is_not_a_pass():
    """Zero tests collected is not success — it is a Tester failure."""
    result = parse_pytest(_result("no tests ran in 0.01s", exit_code=5))
    assert not result.passed
    assert result.total == 0
    assert summarise(result) == "no tests ran"


# --------------------------------------------------------------------------- #
# Packing
# --------------------------------------------------------------------------- #


def test_tree_is_packed_flat():
    payload = _tar_bytes(
        [
            GeneratedFile(path="main.py", content="x = 1"),
            GeneratedFile(path="test_main.py", content="def test(): pass"),
        ]
    )
    with tarfile.open(fileobj=BytesIO(payload)) as archive:
        assert sorted(archive.getnames()) == ["main.py", "test_main.py"]


def test_path_traversal_is_flattened():
    """A generated path must not be able to write outside /app."""
    payload = _tar_bytes([GeneratedFile(path="../../etc/passwd", content="pwned")])
    with tarfile.open(fileobj=BytesIO(payload)) as archive:
        names = archive.getnames()
    assert names == ["passwd"]
    assert not any(".." in n or n.startswith("/") for n in names)
