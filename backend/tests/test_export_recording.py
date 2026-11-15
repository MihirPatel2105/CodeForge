"""Turning a stored run into an offline replay recording — no database involved."""

from datetime import datetime

import pytest

from scripts.export_recording import RECORDING_VERSION, build_recording


def _event(name: str, **data) -> dict:
    return {"id": 0, "event": name, "data": {"event": name, "at": "2026-10-26T16:10:00Z", **data}}


def _run(**overrides) -> dict:
    run = {
        "_id": "6adf7b8ea61fc854f76fc0af",
        "user_id": "owner-1",
        "project_id": "project-1",
        "prompt": "Build a CRUD API for books",
        "status": "succeeded",
        "created_at": datetime(2026, 10, 26, 16, 10, 0),  # PyMongo returns naive UTC
        "state": {
            "files": [{"path": "main.py", "content": "app = 1\n"}],
            "test_files": [{"path": "test_main.py", "content": "def test_x(): ...\n"}],
        },
        "events": [
            _event("run.started", run_id="6adf7b8ea61fc854f76fc0af", prompt="Build"),
            _event("tests.result", passed=True, total=8, failed=0),
            _event("run.completed", status="succeeded", iterations=1, duration_ms=1),
        ],
    }
    return {**run, **overrides}


def test_recording_carries_events_files_and_history_for_offline_replay():
    history = [
        {"iteration": 1, "files": {"main.py": "app = 1\n"}},
        {"iteration": 0, "files": {"main.py": "app = 0\n"}},
    ]

    recording = build_recording(_run(), history, slug="books-loop", title="Books API")

    assert recording["version"] == RECORDING_VERSION
    assert recording["slug"] == "books-loop"
    assert recording["title"] == "Books API"
    assert recording["source_run_id"] == "6adf7b8ea61fc854f76fc0af"
    assert recording["prompt"] == "Build a CRUD API for books"
    assert [e["event"] for e in recording["events"]] == [
        "run.started",
        "tests.result",
        "run.completed",
    ]
    assert recording["files"] == {"main.py": "app = 1\n", "test_main.py": "def test_x(): ...\n"}
    assert [v["iteration"] for v in recording["history"]] == [0, 1]


def test_recorded_at_is_timezone_aware_so_the_browser_does_not_shift_it():
    recording = build_recording(_run(), [], slug="books", title="Books")

    assert recording["recorded_at"] == "2026-10-26T16:10:00+00:00"


def test_recording_leaves_out_who_owns_the_run():
    recording = build_recording(_run(), [], slug="books", title="Books")

    assert "user_id" not in recording
    assert "project_id" not in recording
    assert "owner-1" not in str(recording)


def test_a_recording_that_would_leak_an_owner_id_is_refused():
    leaky = _run(
        events=[
            _event("run.started", run_id="x", prompt="p"),
            _event("approval.resolved", phase="pm", approved=True, note="by owner-1"),
            _event("run.completed", status="succeeded", iterations=0, duration_ms=1),
        ]
    )

    with pytest.raises(ValueError, match="owner"):
        build_recording(leaky, [], slug="books", title="Books")


def test_only_the_latest_archive_of_each_pass_is_kept():
    history = [
        {"iteration": 1, "files": {"main.py": "old\n"}},
        {"iteration": 1, "files": {"main.py": "new\n"}},
    ]

    recording = build_recording(_run(), history, slug="books", title="Books")

    assert recording["history"] == [{"iteration": 1, "files": {"main.py": "new\n"}}]


def test_only_a_succeeded_run_can_become_a_fallback_recording():
    with pytest.raises(ValueError, match="succeeded"):
        build_recording(_run(status="failed"), [], slug="books", title="Books")


def test_a_run_without_a_completion_event_is_rejected():
    run = _run(events=[_event("run.started", run_id="x", prompt="p")])

    with pytest.raises(ValueError, match="run.completed"):
        build_recording(run, [], slug="books", title="Books")


def test_terminal_events_from_before_a_retry_are_dropped_like_the_live_stream_does():
    run = _run(
        events=[
            _event("run.started", run_id="x", prompt="p"),
            _event("run.failed", code="llm_exhausted", message="quota"),
            _event("run.retried", stage="coder"),
            _event("tests.result", passed=True, total=8, failed=0),
            _event("run.completed", status="succeeded", iterations=0, duration_ms=1),
        ]
    )

    recording = build_recording(run, [], slug="books", title="Books")

    assert "run.failed" not in [e["event"] for e in recording["events"]]
    assert recording["events"][-1]["event"] == "run.completed"


@pytest.mark.parametrize("slug", ["", "../escape", "Books", "books/loop", "a" * 61])
def test_slug_must_be_safe_to_use_as_a_file_name_and_url(slug):
    with pytest.raises(ValueError, match="slug"):
        build_recording(_run(), [], slug=slug, title="Books")


def test_title_is_required():
    with pytest.raises(ValueError, match="title"):
        build_recording(_run(), [], slug="books", title="   ")
