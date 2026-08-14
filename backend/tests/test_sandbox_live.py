"""Sandbox execution against a real Docker daemon.

Needs `codeforge-sandbox:latest` built and Docker running. Skipped by default because a
machine without Docker should not show a red suite for it.

    RUN_LIVE_DOCKER=1 pytest tests/test_sandbox_live.py -v

These are the safety properties, not the happy path: an escape, a leak or a run that
cannot be killed is a security failure, not a bug.
"""

import asyncio
import os
import subprocess

import pytest

from app.sandbox import parse_pytest, run_in_sandbox
from app.schemas.agents import GeneratedFile
from app.schemas.sandbox import SandboxRequest

pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_LIVE_DOCKER"),
    reason="needs Docker and the sandbox image; set RUN_LIVE_DOCKER=1 to run",
)


def _containers() -> int:
    result = subprocess.run(
        ["docker", "ps", "-a", "--filter", "ancestor=codeforge-sandbox:latest", "-q"],
        capture_output=True,
        text=True,
    )
    return len(result.stdout.split())


def _run(files: list[GeneratedFile], timeout_s: int = 60):
    return asyncio.run(
        run_in_sandbox(SandboxRequest(run_id="test", files=files, timeout_s=timeout_s))
    )


def test_passing_suite_runs_green():
    result = _run(
        [
            GeneratedFile(path="main.py", content="VALUE = 42\n"),
            GeneratedFile(
                path="test_main.py",
                content="from main import VALUE\n\ndef test_value():\n    assert VALUE == 42\n",
            ),
        ]
    )
    assert result.exit_code == 0
    assert not result.timed_out
    assert parse_pytest(result).passed


def test_failing_suite_is_distinguishable_from_a_crash():
    result = _run([GeneratedFile(path="test_main.py", content="def test_x():\n    assert False\n")])
    assert result.exit_code == 1, "a failing test is exit 1, not a crash"
    assert not parse_pytest(result).passed


def test_infinite_loop_is_killed():
    """An uncapped run would hang the pipeline forever."""
    result = _run(
        [
            GeneratedFile(
                path="test_main.py", content="def test_hangs():\n    while True:\n        pass\n"
            )
        ],
        timeout_s=10,
    )
    assert result.timed_out
    assert result.exit_code == 124
    assert result.duration_ms < 30_000, "the kill must be prompt, not eventual"


def test_no_containers_leak():
    """Every path must remove its container, including the timeout path (NFR-8)."""
    before = _containers()
    _run([GeneratedFile(path="test_main.py", content="def test_ok():\n    assert True\n")])
    _run([GeneratedFile(path="test_main.py", content="def test_no():\n    assert False\n")])
    _run(
        [
            GeneratedFile(
                path="test_main.py", content="def test_hangs():\n    while True:\n        pass\n"
            )
        ],
        timeout_s=8,
    )
    assert _containers() == before, "a container survived its run"


def test_generated_code_has_no_network():
    """`network_mode='none'` is a safety requirement, not a preference (NFR-2). If this
    ever passes, generated code can reach the internet."""
    result = _run(
        [
            GeneratedFile(
                path="test_main.py",
                content=(
                    "import socket\n\n"
                    "def test_no_network():\n"
                    "    try:\n"
                    "        socket.create_connection(('1.1.1.1', 53), timeout=3)\n"
                    "    except OSError:\n"
                    "        return  # expected: no route\n"
                    "    raise AssertionError('sandbox reached the network')\n"
                ),
            )
        ]
    )
    assert result.exit_code == 0, result.stdout[-500:]


def test_mongod_is_available_inside_the_container():
    """The generated app's database lives and dies with the container."""
    result = _run(
        [
            GeneratedFile(
                path="test_main.py",
                content=(
                    "from pymongo import MongoClient\n\n"
                    "def test_mongo():\n"
                    "    client = MongoClient('mongodb://localhost:27017')\n"
                    "    assert client.admin.command('ping')['ok'] == 1.0\n"
                ),
            )
        ]
    )
    assert result.exit_code == 0, result.stdout[-500:]
