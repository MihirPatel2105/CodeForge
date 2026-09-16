"""Resumable Phase 8 evaluation over the frozen canonical prompts.

    PYTHONPATH=. python scripts/evaluate.py --repeat 3
    PYTHONPATH=. python scripts/evaluate.py --repeat 3 --max-runs 4  # daily quota chunk
    PYTHONPATH=. python scripts/evaluate.py --repeat 3 --dry-run

Both retrieval arms run for every prompt and repetition. The graph has no human
interrupts, while its state records both checkpoints as auto-approved. Provider
quota before any completion, infrastructure and operator-stopped attempts are
excluded; a mid-run quota failure remains an included system outcome.
"""

import argparse
import asyncio
import csv
import hashlib
import json
import os
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

PROMPTS_FILE = Path(__file__).resolve().parent.parent / "tests" / "prompts.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "evaluation-results"
BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
CSV_FIELDS = (
    "slot",
    "attempt",
    "prompt_id",
    "rag_enabled",
    "repetition",
    "run_id",
    "status",
    "acceptance_level",
    "exclusion_reason",
    "failure_category",
    "generation_succeeded",
    "tests_passed",
    "test_pass_ratio",
    "iterations",
    "blocking_findings_total",
    "findings_fixed",
    "llm_calls",
    "tokens_total",
    "provider_fallbacks",
    "end_to_end_ms",
)


def slots(entries: list[dict], repeat: int) -> list[dict[str, Any]]:
    """Alternate retrieval order so one arm does not always inherit quota debt."""
    planned: list[dict[str, Any]] = []
    for repetition in range(1, repeat + 1):
        for index, entry in enumerate(entries):
            arms = (False, True) if (index + repetition) % 2 == 0 else (True, False)
            for rag in arms:
                planned.append(
                    {
                        "slot": f"{entry['id']}:{repetition}:{'rag' if rag else 'no_rag'}",
                        "prompt_id": entry["id"],
                        "prompt": entry["prompt"],
                        "repetition": repetition,
                        "rag_enabled": rag,
                    }
                )
    return planned


def _effective(records: list[dict]) -> dict[str, dict]:
    """One included result per slot; excluded attempts remain visible separately."""
    included: dict[str, dict] = {}
    for record in records:
        if not record.get("exclusion_reason"):
            included[record["slot"]] = record
    return included


def summarize(records: list[dict], planned: list[dict]) -> dict[str, Any]:
    planned_ids = {p["slot"] for p in planned}
    included = {slot: record for slot, record in _effective(records).items() if slot in planned_ids}
    planned_pairs = {(p["prompt_id"], p["repetition"]) for p in planned}
    results_by_pair: dict[tuple[str, int], dict[bool, dict]] = {}
    for record in included.values():
        key = (record["prompt_id"], record["repetition"])
        results_by_pair.setdefault(key, {})[record["rag_enabled"]] = record
    paired_pairs = sum(len(arms) == 2 for arms in results_by_pair.values())
    quota_affected_pairs = sum(
        any(record.get("failure_category") == "quota" for record in arms.values())
        for arms in results_by_pair.values()
    )
    complete = planned_ids <= included.keys()
    comparison_ready = complete and paired_pairs == len(planned_pairs) and not quota_affected_pairs
    by_arm: dict[str, dict[str, Any]] = {}
    for rag, label in ((False, "without_rag"), (True, "with_rag")):
        arm = [r for r in included.values() if r["rag_enabled"] is rag]
        n = len(arm)
        reviewers = [r for r in arm if int(r.get("blocking_findings_total") or 0) > 0]
        winners = [r for r in arm if r.get("tests_passed")]
        by_arm[label] = {
            "included": n,
            "generation_success_rate": sum(bool(r.get("generation_succeeded")) for r in arm) / n
            if n
            else None,
            "test_pass_rate": len(winners) / n if n else None,
            "review_loop_effectiveness": sum(bool(r.get("tests_passed")) for r in reviewers)
            / len(reviewers)
            if reviewers
            else None,
            "review_loop_runs": len(reviewers),
            "average_iterations_to_success": sum(int(r.get("iterations") or 0) for r in winners)
            / len(winners)
            if winners
            else None,
            "average_end_to_end_seconds": sum(int(r.get("end_to_end_ms") or 0) for r in arm)
            / (n * 1000)
            if n
            else None,
            "failure_categories": dict(
                Counter(r["failure_category"] for r in arm if r.get("failure_category"))
            ),
        }
    without = by_arm["without_rag"]
    with_rag = by_arm["with_rag"]
    rag_generation_delta = (
        with_rag["generation_success_rate"] - without["generation_success_rate"]
        if comparison_ready
        and with_rag["generation_success_rate"] is not None
        and without["generation_success_rate"] is not None
        else None
    )
    rag_test_delta = (
        with_rag["test_pass_rate"] - without["test_pass_rate"]
        if comparison_ready
        and with_rag["test_pass_rate"] is not None
        and without["test_pass_rate"] is not None
        else None
    )
    return {
        "planned_slots": len(planned_ids),
        "included_slots": len(planned_ids & included.keys()),
        "complete": complete,
        "planned_pairs": len(planned_pairs),
        "paired_pairs": paired_pairs,
        "quota_affected_pairs": quota_affected_pairs,
        "rag_comparison_status": (
            "incomplete"
            if not complete
            else "quota_confounded"
            if quota_affected_pairs
            else "ready"
        ),
        "excluded_attempts": dict(
            Counter(r["exclusion_reason"] for r in records if r.get("exclusion_reason"))
        ),
        "arms": by_arm,
        "rag_generation_success_delta": rag_generation_delta,
        "rag_test_pass_delta": rag_test_delta,
    }


def configuration_fingerprint() -> str:
    """Keep resumed RAG arms on the same platform and sandbox implementation."""
    digest = hashlib.sha256()
    paths = [
        *BACKEND_ROOT.joinpath("app").rglob("*.py"),
        *REPO_ROOT.joinpath("sandbox").rglob("*.py"),
        *REPO_ROOT.joinpath("sandbox").rglob("*.sh"),
        REPO_ROOT / "sandbox" / "Dockerfile",
        PROMPTS_FILE,
        Path(__file__).resolve(),
    ]
    for path in sorted(paths):
        digest.update(str(path.relative_to(REPO_ROOT)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def write_report(output: Path, records: list[dict], planned: list[dict]) -> None:
    output.mkdir(parents=True, exist_ok=True)
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "configuration_fingerprint": configuration_fingerprint(),
        "summary": summarize(records, planned),
        "results": records,
    }
    temporary = output / "report.json.tmp"
    temporary.write_text(json.dumps(report, indent=2))
    os.replace(temporary, output / "report.json")
    with (output / "runs.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows({key: row.get(key) for key in CSV_FIELDS} for row in records)


async def run_slot(graph, slot: dict, user_id: str, project_id: str) -> dict[str, Any]:
    from app.graph.build import thread_config
    from app.graph.metrics import score_run
    from app.graph.persistence import serialise
    from app.graph.state import ApprovalRecord, new_run_state
    from app.models import Run

    run = Run(project_id=project_id, user_id=user_id, prompt=slot["prompt"], status="running")
    await run.insert()
    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=project_id,
        user_id=user_id,
        thread_id=run_id,
        user_prompt=slot["prompt"],
        prompt_id=slot["prompt_id"],
        rag_enabled=slot["rag_enabled"],
    )
    granted = datetime.now(UTC)
    state["approvals"] = {
        phase: ApprovalRecord(approved=True, auto=True, at=granted) for phase in ("pm", "architect")
    }
    run.state = serialise(state)
    await run.save()
    try:
        final = await graph.ainvoke(state, config=thread_config(run_id))
        status = final.get("status", "failed_llm")
        metrics = score_run(final, status=status, prompt_id=slot["prompt_id"])
    except Exception as exc:  # noqa: BLE001 - a batch must retain failed attempts
        status = "failed_llm"
        state["status"] = status
        state["finished_at"] = datetime.now(UTC)
        state["errors"] = [
            *(state.get("errors") or []),
            {"code": type(exc).__name__, "message": str(exc)[:400], "at": state["finished_at"]},
        ]
        metrics = score_run(state, status=status, prompt_id=slot["prompt_id"])
        run.state = serialise(state)
        run.status = status
        run.metrics = metrics
        await run.save()
    return {
        **{key: slot[key] for key in ("slot", "prompt_id", "rag_enabled", "repetition")},
        "run_id": run_id,
        "status": status,
        **metrics.model_dump(mode="json"),
    }


async def execute(args, planned: list[dict], records: list[dict]) -> list[dict]:
    from app.db import connect, disconnect
    from app.graph.build import compile_graph
    from app.models import Project, User

    await connect()
    try:
        user = User(email=f"evaluation-{uuid4().hex}@example.com", hashed_password="x")
        await user.insert()
        project = Project(user_id=str(user.id), name="Canonical prompt evaluation")
        await project.insert()
        graph = compile_graph(with_approvals=False)
        completed = _effective(records)
        attempted = 0
        for slot in planned:
            if slot["slot"] in completed:
                continue
            if args.max_runs and attempted >= args.max_runs:
                break
            if attempted and args.delay:
                await asyncio.sleep(args.delay)
            attempt = sum(r["slot"] == slot["slot"] for r in records) + 1
            print(f"{slot['slot']} attempt {attempt}", flush=True)
            record = await run_slot(graph, slot, str(user.id), str(project.id))
            record["attempt"] = attempt
            records.append(record)
            write_report(args.out_dir, records, planned)
            attempted += 1
            print(
                f"  {record['acceptance_level']} {record['status']} "
                f"excluded={record['exclusion_reason'] or 'no'}",
                flush=True,
            )
            if (
                record.get("exclusion_reason")
                in {
                    "infrastructure",
                    "quota_before_completion",
                }
                or record.get("failure_category") == "quota"
            ):
                print("Stopped on unavailable infrastructure/quota; rerun this command later.")
                break
        return records
    finally:
        await disconnect()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--only", default="", help="comma-separated frozen prompt ids")
    parser.add_argument("--max-runs", type=int, default=0, help="attempt at most N slots now")
    parser.add_argument("--delay", type=int, default=75, help="seconds between runs")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.repeat < 1 or args.max_runs < 0 or args.delay < 0:
        parser.error("repeat must be positive; max-runs and delay cannot be negative")
    return args


def main() -> None:
    args = parse_args()
    entries = json.loads(PROMPTS_FILE.read_text())["prompts"]
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        entries = [entry for entry in entries if entry["id"] in wanted]
        missing = wanted - {entry["id"] for entry in entries}
        if missing:
            raise SystemExit(f"Unknown canonical prompt id(s): {', '.join(sorted(missing))}")
    planned = slots(entries, args.repeat)
    if args.dry_run:
        print(f"{len(planned)} slots over {len(entries)} frozen prompts; no services contacted")
        return
    report_file = args.out_dir / "report.json"
    existing = json.loads(report_file.read_text()) if report_file.exists() else None
    if existing and existing.get("configuration_fingerprint") != configuration_fingerprint():
        raise SystemExit(
            "Evaluation code changed since this report was created; use --out-dir "
            "with a new directory so unlike runs are not mixed."
        )
    records = existing["results"] if existing else []
    records = asyncio.run(execute(args, planned, records))
    write_report(args.out_dir, records, planned)
    print(json.dumps(summarize(records, planned), indent=2))
    print(f"Reports: {args.out_dir / 'report.json'} and {args.out_dir / 'runs.csv'}")


if __name__ == "__main__":
    main()
