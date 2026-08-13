"""Run the graph against every canonical prompt and write a report.

    PYTHONPATH=. python scripts/run_all_prompts.py [--limit N] [--out report.json]

This is the Phase 4 Definition of Done check — all 10 prompts must produce a complete
file tree plus tests, as text. Nothing executes; the sandbox is Phase 5.

It is also the seed of the Phase 8 evaluation harness, so it records per-prompt metrics
rather than just pass/fail, and never lets one bad prompt abort the batch.
"""

import argparse
import asyncio
import json
import time
from pathlib import Path
from typing import Any

from app.db import connect, disconnect
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Project, Run, User

PROMPTS_FILE = Path(__file__).resolve().parent.parent / "tests" / "prompts.json"


async def run_one(graph, user_id: str, project_id: str, entry: dict) -> dict[str, Any]:
    prompt = entry["prompt"]
    started = time.monotonic()

    run = Run(project_id=project_id, user_id=user_id, prompt=prompt, status="running")
    await run.insert()
    run_id = str(run.id)

    state = new_run_state(
        run_id=run_id,
        project_id=project_id,
        user_id=user_id,
        thread_id=run_id,
        user_prompt=prompt,
    )

    record: dict[str, Any] = {
        "id": entry["id"],
        "run_id": run_id,
        "expected_entities": entry.get("expected_entities"),
        "difficulty": entry.get("difficulty"),
    }

    try:
        final = await graph.ainvoke(state, config=thread_config(run_id))
    except Exception as exc:  # a crashed graph is a result, not a reason to stop
        record.update(status="crashed", error=f"{type(exc).__name__}: {exc}"[:300])
        record["duration_s"] = round(time.monotonic() - started, 1)
        return record

    design = final.get("design")
    files = final.get("files") or []
    review = final.get("review")
    written = {f.path for f in files}
    designed = [f.path for f in design.files] if design else []

    record.update(
        status=final.get("status"),
        entities=[e.name for e in final["requirements"].entities]
        if final.get("requirements")
        else [],
        endpoints=len(design.endpoints) if design else 0,
        files_designed=len(designed),
        files_generated=len(files),
        missing_files=[p for p in designed if p not in written],
        has_tests=bool(final.get("test_files")),
        findings=len(review.findings) if review else None,
        blocking=sum(1 for f in review.findings if f.severity == "blocking") if review else None,
        errors=len(final.get("errors") or []),
        duration_s=round(time.monotonic() - started, 1),
    )
    return record


async def main() -> tuple[str, list[dict[str, Any]]]:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="run only the first N prompts")
    parser.add_argument("--out", default="prompt_report.json")
    args = parser.parse_args()

    entries = json.loads(PROMPTS_FILE.read_text())["prompts"]
    if args.limit:
        entries = entries[: args.limit]

    await connect()
    user = User(email=f"batch-{int(time.time())}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="Canonical prompt batch")
    await project.insert()

    graph = compile_graph(with_approvals=False)
    results: list[dict[str, Any]] = []

    for index, entry in enumerate(entries, start=1):
        print(f"[{index}/{len(entries)}] {entry['id']} ...", flush=True)
        record = await run_one(graph, str(user.id), str(project.id), entry)
        results.append(record)
        print(
            f"    status={record.get('status')} "
            f"files={record.get('files_generated')}/{record.get('files_designed')} "
            f"tests={record.get('has_tests')} "
            f"blocking={record.get('blocking')} "
            f"{record.get('duration_s')}s",
            flush=True,
        )

    complete = [r for r in results if r.get("status") == "succeeded"]
    print("\n===== SUMMARY =====")
    print(f"prompts run        : {len(results)}")
    print(f"pipeline completed : {len(complete)}/{len(results)}")
    print(f"produced any files : {sum(1 for r in results if r.get('files_generated'))}")
    print(f"produced tests     : {sum(1 for r in results if r.get('has_tests'))}")

    await disconnect()
    return args.out, results


if __name__ == "__main__":
    # The report is written outside the event loop: blocking file IO inside an async
    # function is exactly what the async lint rules exist to prevent.
    out_path, report = asyncio.run(main())
    Path(out_path).write_text(json.dumps(report, indent=2))
    print(f"report written to  : {out_path}")
