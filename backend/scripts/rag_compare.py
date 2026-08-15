"""Run the same prompts with retrieval on and off, and compare outcomes.

    PYTHONPATH=. python scripts/rag_compare.py [--prompts 3] [--out rag_report.json]

Phase 6 asks only that both arms run cleanly. The numbers this prints are a first look,
not a result: with a handful of runs per arm, free-tier variance dominates any real
effect. Phase 8's repetitions are what turn this into the reportable delta.

Outcome is scored on the acceptance levels in docs/ACCEPTANCE.md, since "did it work" is
not a single number: L2 does not parse, L3 does not boot, L4 ran with failures, L5 green.
"""

import argparse
import ast
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


def level_of(final: dict[str, Any]) -> str:
    files = final.get("files") or []
    if not files:
        return "L1"
    for generated in files:
        if generated.path.endswith(".py"):
            try:
                ast.parse(generated.content)
            except SyntaxError:
                return "L2"
    sandbox = final.get("sandbox")
    tests = final.get("tests")
    if sandbox is None or tests is None:
        return "L3"
    if sandbox.exit_code in (2, 3, 4, 5):
        return "L3"
    return "L5" if tests.passed else "L4"


async def run_once(graph, user_id: str, project_id: str, prompt: str, rag: bool) -> dict:
    run = Run(project_id=project_id, user_id=user_id, prompt=prompt, status="running")
    await run.insert()
    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=project_id,
        user_id=user_id,
        thread_id=run_id,
        user_prompt=prompt,
        rag_enabled=rag,
    )
    started = time.monotonic()
    try:
        final = await graph.ainvoke(state, config=thread_config(run_id))
    except Exception as exc:  # a crash is a result, not a reason to stop the comparison
        return {"rag": rag, "level": "crashed", "error": str(exc)[:160], "seconds": 0}

    tests = final.get("tests")
    return {
        "rag": rag,
        "level": level_of(final),
        "status": final.get("status"),
        "loops": final.get("loop_count", 0),
        "tests_passed": (tests.total - tests.failed) if tests else 0,
        "tests_total": tests.total if tests else 0,
        "seconds": round(time.monotonic() - started, 1),
    }


async def main() -> tuple[str, list[dict]]:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompts", type=int, default=3)
    parser.add_argument("--out", default="rag_report.json")
    parser.add_argument(
        "--delay",
        type=int,
        default=75,
        help="seconds to idle between runs so one arm does not inherit the other's "
        "rate-limit debt (Groq's TPM window is one minute)",
    )
    args = parser.parse_args()

    entries = json.loads(PROMPTS_FILE.read_text())["prompts"][: args.prompts]

    await connect()
    user = User(email=f"rag-{int(time.time())}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="RAG comparison")
    await project.insert()

    graph = compile_graph(with_approvals=False)
    results: list[dict] = []

    first = True
    for index, entry in enumerate(entries):
        # Alternate which arm runs first. Running off-then-on every time means the second
        # arm systematically inherits the first arm's rate-limit state, which is exactly
        # what contaminated the first comparison.
        order = (False, True) if index % 2 == 0 else (True, False)

        for rag in order:
            if not first:
                print(f"    ... idling {args.delay}s so the rate-limit window clears", flush=True)
                await asyncio.sleep(args.delay)
            first = False

            label = "on " if rag else "off"
            print(f"[{entry['id']}] rag={label} (position {order.index(rag) + 1}) ...", flush=True)
            record = await run_once(graph, str(user.id), str(project.id), entry["prompt"], rag)
            record["id"] = entry["id"]
            record["position"] = order.index(rag) + 1
            results.append(record)
            print(
                f"    {record['level']}  loops={record.get('loops')}  "
                f"tests={record.get('tests_passed')}/{record.get('tests_total')}  "
                f"{record['seconds']}s",
                flush=True,
            )

    print("\n===== RAG COMPARISON =====")
    for rag in (False, True):
        arm = [r for r in results if r["rag"] is rag]
        levels = {lvl: sum(1 for r in arm if r["level"] == lvl) for lvl in ("L2", "L3", "L4", "L5")}
        runnable = sum(1 for r in arm if r["level"] in ("L4", "L5"))
        print(
            f"  rag {'on ' if rag else 'off'}: {levels}  "
            f"code runs {runnable}/{len(arm)}  "
            f"green {levels['L5']}/{len(arm)}"
        )
    # A run that produced nothing in seconds was rate limited, not beaten by the prompt.
    suspicious = [r for r in results if r["level"] == "L1" and r["seconds"] < 30]
    if suspicious:
        print(f"\n  WARNING: {len(suspicious)} run(s) produced nothing in under 30s —")
        print("  those were almost certainly rate limited and should not be counted.")

    print("\n  N is small; this is a smoke comparison, not the reported delta.")

    await disconnect()
    return args.out, results


if __name__ == "__main__":
    out_path, report = asyncio.run(main())
    Path(out_path).write_text(json.dumps(report, indent=2))
    print(f"  report written to {out_path}")
