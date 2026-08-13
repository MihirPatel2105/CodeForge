"""Drive one full graph run from the command line.

    PYTHONPATH=. python scripts/run_graph.py ["prompt"]

Phase 4 harness: no HTTP, no approvals, no sandbox. Prints what each node produced so a
linear pass can be inspected end to end.
"""

import asyncio
import sys

from app.db import connect, disconnect
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Project, Run, User

DEFAULT_PROMPT = (
    "I want an API to manage my personal book collection. Each book has a title, "
    "an author, the year it was published, and a list of genres."
)


async def main() -> int:
    prompt = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROMPT
    await connect()

    user = User(email=f"graph-{id(prompt)}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="Graph Run")
    await project.insert()
    run = Run(project_id=str(project.id), user_id=str(user.id), prompt=prompt, status="running")
    await run.insert()

    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=str(project.id),
        user_id=str(user.id),
        thread_id=run_id,
        user_prompt=prompt,
    )

    graph = compile_graph(with_approvals=False)
    final = await graph.ainvoke(state, config=thread_config(run_id))

    print(f"\nrun_id : {run_id}")
    print(f"status : {final.get('status')}")

    requirements = final.get("requirements")
    if requirements:
        print(f"PM        entities={[e.name for e in requirements.entities]}")

    design = final.get("design")
    if design:
        print(f"ARCHITECT endpoints={len(design.endpoints)} files={[f.path for f in design.files]}")

    files = final.get("files") or []
    print(f"CODER     files={[(f.path, len(f.content)) for f in files]}")

    review = final.get("review")
    if review:
        blocking = sum(1 for f in review.findings if f.severity == "blocking")
        print(
            f"REVIEWER  findings={len(review.findings)} blocking={blocking} passed={review.passed}"
        )
        for finding in review.findings[:5]:
            print(f"            [{finding.severity}] {finding.file}: {finding.issue[:80]}")

    tests = final.get("test_files") or []
    print(f"TESTER    files={[(f.path, len(f.content)) for f in tests]}")

    errors = final.get("errors") or []
    if errors:
        print(f"ERRORS    {len(errors)}")
        for err in errors[:4]:
            print(f"            {err.get('agent')}: {str(err.get('message'))[:90]}")

    await disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
