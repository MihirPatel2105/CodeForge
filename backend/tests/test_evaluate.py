"""Phase 8 denominator and report behaviour with no LLM or database."""

import json
from pathlib import Path

from scripts.evaluate import slots, summarize, write_report


def test_frozen_design_produces_balanced_repeated_slots():
    entries = json.loads((Path(__file__).parent / "prompts.json").read_text())["prompts"]
    planned = slots(entries, 3)
    assert len(planned) == 60
    assert len({slot["slot"] for slot in planned}) == 60
    assert sum(slot["rag_enabled"] for slot in planned) == 30


def test_excluded_attempt_is_retried_and_never_changes_the_denominator(tmp_path):
    planned = slots([{"id": "p01", "prompt": "Books API"}], 1)
    first, second = planned
    records = [
        {
            **first,
            "attempt": 1,
            "exclusion_reason": "infrastructure",
            "failure_category": None,
            "tests_passed": False,
        },
        {
            **first,
            "attempt": 2,
            "exclusion_reason": None,
            "failure_category": None,
            "generation_succeeded": True,
            "tests_passed": True,
            "iterations": 1,
            "blocking_findings_total": 1,
            "end_to_end_ms": 6000,
        },
        {
            **second,
            "attempt": 1,
            "exclusion_reason": None,
            "failure_category": "schema",
            "generation_succeeded": False,
            "tests_passed": False,
            "iterations": 0,
            "blocking_findings_total": 0,
            "end_to_end_ms": 2000,
        },
    ]
    summary = summarize(records, planned)
    assert summary["complete"]
    assert summary["rag_comparison_status"] == "ready"
    assert summary["paired_pairs"] == 1
    assert summary["quota_affected_pairs"] == 0
    assert summary["rag_generation_success_delta"] == 1.0
    assert summary["rag_test_pass_delta"] == 1.0
    assert summary["included_slots"] == 2
    assert summary["excluded_attempts"] == {"infrastructure": 1}
    assert sum(arm["included"] for arm in summary["arms"].values()) == 2
    write_report(tmp_path, records, planned)
    assert json.loads((tmp_path / "report.json").read_text())["summary"] == summary
    assert len((tmp_path / "runs.csv").read_text().splitlines()) == 4


def test_report_summary_uses_only_requested_slots():
    planned = slots([{"id": "p01", "prompt": "Books API"}], 1)
    records = [
        {
            **planned[0],
            "exclusion_reason": None,
            "generation_succeeded": True,
            "tests_passed": True,
        },
        {
            "slot": "p02:1:no_rag",
            "rag_enabled": False,
            "exclusion_reason": None,
            "generation_succeeded": False,
            "tests_passed": False,
        },
    ]
    summary = summarize(records, planned)
    assert summary["included_slots"] == 1
    assert sum(arm["included"] for arm in summary["arms"].values()) == 1
    assert summary["rag_comparison_status"] == "incomplete"
    assert summary["paired_pairs"] == 0
    assert summary["rag_generation_success_delta"] is None
    assert summary["rag_test_pass_delta"] is None


def test_mid_run_quota_failure_keeps_arm_outcome_but_confounds_rag_delta():
    planned = slots([{"id": "p01", "prompt": "Books API"}], 1)
    records = [
        {
            **planned[0],
            "exclusion_reason": None,
            "failure_category": None,
            "generation_succeeded": True,
            "tests_passed": True,
        },
        {
            **planned[1],
            "exclusion_reason": None,
            "failure_category": "quota",
            "generation_succeeded": False,
            "tests_passed": False,
        },
    ]
    summary = summarize(records, planned)
    assert summary["complete"]
    assert summary["arms"]["without_rag"]["included"] == 1
    assert summary["arms"]["with_rag"]["included"] == 1
    assert summary["paired_pairs"] == 1
    assert summary["quota_affected_pairs"] == 1
    assert summary["rag_comparison_status"] == "quota_confounded"
    assert summary["rag_generation_success_delta"] is None
    assert summary["rag_test_pass_delta"] is None
