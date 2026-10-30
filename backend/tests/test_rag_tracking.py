"""Whether a RAG-enabled run actually received retrieved context.

The with/without-RAG delta is the headline metric, so a run flagged `rag_enabled` whose
retrieval silently failed must be visible rather than counted as a with-RAG result.
"""

import asyncio
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from app.graph.metrics import score_run
from app.graph.nodes import _fix_tree, _generate_tree
from app.graph.state import RunMetrics, new_run_state
from app.llm.client import LLMAttempt, LLMResult
from app.rag import retriever
from app.rag.retriever import RetrievalUnavailableError, retrieve_context
from app.schemas.agents import Design, FileSpec, GeneratedFile, Requirements, SingleFileOutput
from scripts.evaluate import CSV_FIELDS, slots, summarize
from tests.test_admin import _create_run, admin_user  # noqa: F401 - fixture reuse

# --------------------------------------------------------------------------- #
# Retrieval outcome
# --------------------------------------------------------------------------- #


def test_disabled_retrieval_reports_disabled_and_no_context():
    outcome = retrieve_context("delete an item and return 204", enabled=False)
    assert outcome.status == "disabled"
    assert outcome.snippet_ids == ()
    assert outcome.text == ""


def test_enabled_retrieval_reports_the_snippets_it_injected():
    outcome = retrieve_context("delete an item and return 204", enabled=True)
    assert outcome.status == "retrieved"
    assert "crud_delete_204" in outcome.snippet_ids
    assert "```python" in outcome.text


def test_enabled_retrieval_with_nothing_to_search_reports_empty():
    outcome = retrieve_context("   ", enabled=True)
    assert outcome.status == "empty"
    assert outcome.text == ""


def test_broken_index_reports_unavailable_instead_of_failing(monkeypatch):
    def broken(_query, *, top_k):
        raise RetrievalUnavailableError("embedding model could not be loaded")

    monkeypatch.setattr(retriever, "retrieve", broken)
    outcome = retrieve_context("delete an item", enabled=True)
    assert outcome.status == "unavailable"
    assert outcome.snippet_ids == ()
    assert outcome.text == ""


# --------------------------------------------------------------------------- #
# Coder: every generation carries the retrieval it was given
# --------------------------------------------------------------------------- #


def _requirements() -> Requirements:
    return Requirements(
        project_name="Library",
        summary="Books",
        entities=[{"name": "Book", "fields": [{"name": "title", "type": "str"}]}],
        operations=["create", "read"],
    )


def _design() -> Design:
    return Design(
        collections=[{"name": "books", "fields": ["title"]}],
        endpoints=[
            {"method": "GET", "path": "/books", "response_model": "BookRead", "status_code": 200}
        ],
        files=[{"path": "main.py", "purpose": "routes"}],
    )


def _ok_result(content: str = "value = 1\n") -> LLMResult:
    return LLMResult(
        value=SingleFileOutput(path="main.py", content=content),
        model="test",
        attempts=[LLMAttempt(model="test", ok=True)],
    )


def test_coder_attaches_the_retrieval_outcome_to_its_result(monkeypatch):
    from app.agents.base import BaseAgent
    from app.agents.coder import SingleFileCoderAgent

    async def fake_call(_self, _prompt, **_kwargs):
        return _ok_result()

    monkeypatch.setattr(BaseAgent, "call", fake_call)
    state = {
        "run_id": "run-1",
        "requirements": _requirements(),
        "design": _design(),
        "rag_enabled": True,
    }
    coder = SingleFileCoderAgent()

    generated = asyncio.run(coder.run_file(state, FileSpec(path="main.py", purpose="routes")))
    fixed = asyncio.run(
        coder.run_fix(state, path="main.py", current="x = 1\n", problems="- return 204 on delete")
    )
    disabled = asyncio.run(
        coder.run_file({**state, "rag_enabled": False}, FileSpec(path="main.py", purpose="x"))
    )

    assert generated.retrieval["status"] == "retrieved"
    assert generated.retrieval["snippets"]
    assert fixed.retrieval["status"] == "retrieved"
    assert disabled.retrieval == {"status": "disabled", "snippets": []}


# --------------------------------------------------------------------------- #
# Graph: the run records each Coder call's retrieval
# --------------------------------------------------------------------------- #


class _FakeCoder:
    def __init__(self, retrieval: dict | None):
        self.retrieval = retrieval

    def _result(self) -> LLMResult:
        return _ok_result().model_copy(update={"retrieval": self.retrieval})

    async def run_file(self, _state, _spec):
        return self._result()

    async def run_fix(self, _state, **_kwargs):
        return self._result()


def _graph_state(**extra) -> dict:
    return {
        "run_id": "run-1",
        "design": Design.model_construct(files=[FileSpec(path="main.py", purpose="routes")]),
        "files": [],
        "review": None,
        "tests": None,
        "loop_count": 0,
        "errors": [],
        "llm_attempts": [],
        "llm_tokens": 0,
        **extra,
    }


def test_first_pass_records_retrieval_for_each_generated_file():
    retrieval = {"status": "retrieved", "snippets": ["crud_list"]}
    update = asyncio.run(_generate_tree(_graph_state(), _FakeCoder(retrieval), _design()))
    assert update["rag_retrievals"] == [
        {"path": "main.py", "iteration": 0, "status": "retrieved", "snippets": ["crud_list"]}
    ]


def test_fix_pass_appends_to_earlier_retrieval_records():
    earlier = {"path": "main.py", "iteration": 0, "status": "retrieved", "snippets": ["a"]}
    state = _graph_state(
        files=[GeneratedFile(path="main.py", content="value = 1\n")],
        rag_retrievals=[earlier],
    )
    fake = _FakeCoder({"status": "unavailable", "snippets": []})
    # A missing tests result with a failing verdict routes the problem to main.py.
    from app.schemas.agents import TestFailure, TestResult

    state["tests"] = TestResult(
        passed=False,
        total=1,
        failed=1,
        failures=[TestFailure(test_name="test_list", assertion="500", traceback_tail="")],
    )
    update = asyncio.run(_fix_tree(state, fake, "tester"))
    assert update["rag_retrievals"] == [
        earlier,
        {"path": "main.py", "iteration": 1, "status": "unavailable", "snippets": []},
    ]


def test_a_result_without_retrieval_information_records_nothing():
    update = asyncio.run(_generate_tree(_graph_state(), _FakeCoder(None), _design()))
    assert update["rag_retrievals"] == []


def test_new_run_state_starts_with_no_retrieval_records():
    state = new_run_state(
        run_id="r", project_id="p", user_id="u", thread_id="r", user_prompt="Books API"
    )
    assert state["rag_retrievals"] == []


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #


def _scored_state(rag_enabled: bool, retrievals: list[dict]) -> dict:
    start = datetime(2026, 10, 30, 10, tzinfo=UTC)
    return {
        "rag_enabled": rag_enabled,
        "rag_retrievals": retrievals,
        "started_at": start,
        "finished_at": start + timedelta(seconds=5),
        "errors": [],
        "loop_history": [],
    }


def test_metrics_count_coder_calls_that_did_and_did_not_receive_context():
    metrics = score_run(
        _scored_state(
            True,
            [
                {"path": "main.py", "iteration": 0, "status": "retrieved", "snippets": ["a"]},
                {"path": "models.py", "iteration": 0, "status": "unavailable", "snippets": []},
                {"path": "main.py", "iteration": 1, "status": "empty", "snippets": []},
            ],
        ),
        status="failed_llm",
    )
    assert metrics.rag_context_calls == 1
    assert metrics.rag_missed_calls == 2
    assert any("retrieval" in note.lower() for note in metrics.notes)


def test_rag_off_run_never_counts_missed_retrieval():
    metrics = score_run(
        _scored_state(
            False, [{"path": "main.py", "iteration": 0, "status": "disabled", "snippets": []}]
        ),
        status="failed_llm",
    )
    assert metrics.rag_context_calls == 0
    assert metrics.rag_missed_calls == 0


def test_runs_from_before_retrieval_tracking_still_score():
    state = _scored_state(True, [])
    del state["rag_retrievals"]
    metrics = score_run(state, status="failed_llm")
    assert metrics.rag_context_calls == 0
    assert metrics.rag_missed_calls == 0


# --------------------------------------------------------------------------- #
# Evaluation report
# --------------------------------------------------------------------------- #


def test_with_rag_run_that_missed_retrieval_confounds_the_rag_delta():
    planned = slots([{"id": "p01", "prompt": "Books API"}], 1)
    without = next(slot for slot in planned if not slot["rag_enabled"])
    with_rag = next(slot for slot in planned if slot["rag_enabled"])
    records = [
        {
            **without,
            "exclusion_reason": None,
            "generation_succeeded": False,
            "tests_passed": False,
            "rag_missed_calls": 0,
        },
        {
            **with_rag,
            "exclusion_reason": None,
            "generation_succeeded": True,
            "tests_passed": True,
            "rag_context_calls": 3,
            "rag_missed_calls": 1,
        },
    ]
    summary = summarize(records, planned)
    assert summary["complete"]
    assert summary["retrieval_affected_pairs"] == 1
    assert summary["rag_comparison_status"] == "retrieval_confounded"
    assert summary["rag_generation_success_delta"] is None
    assert summary["rag_test_pass_delta"] is None


def test_report_columns_include_retrieval_counts():
    assert {"rag_context_calls", "rag_missed_calls"} <= set(CSV_FIELDS)


# --------------------------------------------------------------------------- #
# Admin quality comparison
# --------------------------------------------------------------------------- #


def test_admin_rag_comparison_leaves_out_runs_that_missed_retrieval(client, admin_user):  # noqa: F811
    received = _create_run(client, admin_user, project_name="RAG A", prompt="Build A")
    missed = _create_run(client, admin_user, project_name="RAG B", prompt="Build B")
    with MongoClient(settings.mongo_uri) as mongo:
        runs = mongo[settings.mongo_db].runs
        for run_id, missed_calls, level in ((received, 0, "L5"), (missed, 2, "L0")):
            runs.update_one(
                {"_id": ObjectId(run_id)},
                {
                    "$set": {
                        "metrics": RunMetrics(
                            rag_enabled=True,
                            acceptance_level=level,
                            tests_passed=level == "L5",
                            generation_succeeded=level == "L5",
                            rag_context_calls=4 - missed_calls,
                            rag_missed_calls=missed_calls,
                        ).model_dump()
                    }
                },
            )

    body = client.get("/admin/quality", headers=admin_user["headers"]).json()
    with_rag = next(group for group in body["rag_comparison"] if group["rag_enabled"])
    assert with_rag["runs"] == 1
    assert with_rag["l5_rate"] == 100.0
    # The run still counts towards the platform-wide figures; only the RAG arm drops it.
    assert body["eligible_runs"] == 2


# --------------------------------------------------------------------------- #
# Startup
# --------------------------------------------------------------------------- #


def test_startup_builds_the_retrieval_index(monkeypatch):
    from fastapi.testclient import TestClient

    import app.main as main

    calls = []
    monkeypatch.setattr(main, "warm_index", lambda: calls.append(1) or 19)
    with TestClient(main.app) as test_client:
        assert test_client.get("/health").status_code == 200
    assert calls == [1]


def test_startup_survives_an_unavailable_retrieval_index(monkeypatch):
    from fastapi.testclient import TestClient

    import app.main as main

    def broken() -> int:
        raise RetrievalUnavailableError("embedding model could not be loaded")

    monkeypatch.setattr(main, "warm_index", broken)
    with TestClient(main.app) as test_client:
        assert test_client.get("/health").status_code == 200
