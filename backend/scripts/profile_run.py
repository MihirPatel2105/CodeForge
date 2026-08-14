"""Time every node of one graph run, to find where the wall clock goes.

    PYTHONPATH=. python scripts/profile_run.py

A full run measured 987s in the Phase 4 batch. This attributes that to nodes so the fix
targets the real cost rather than a guess.
"""

import asyncio
import sys
import time

from app.db import connect, disconnect
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Project, Run, User

PROMPT = (
    "I want an API to manage my personal book collection. Each book has a title, "
    "an author, the year it was published, and a list of genres."
)


async def main() -> int:
    await connect()
    user = User(email=f"profile-{int(time.time())}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="Profile")
    await project.insert()
    run = Run(project_id=str(project.id), user_id=str(user.id), prompt=PROMPT, status="running")
    await run.insert()

    run_id = str(run.id)
    state = new_run_state(
        run_id=run_id,
        project_id=str(project.id),
        user_id=str(user.id),
        thread_id=run_id,
        user_prompt=PROMPT,
    )

    graph = compile_graph(with_approvals=False)
    started = time.monotonic()
    last = started
    timings: list[tuple[str, float]] = []

    async for chunk in graph.astream(state, config=thread_config(run_id)):
        now = time.monotonic()
        for node in chunk:
            elapsed = now - last
            timings.append((node, elapsed))
            print(f"  {node:12} {elapsed:7.1f}s", flush=True)
        last = now

    total = time.monotonic() - started
    print(f"\ntotal {total:.1f}s")
    print("\nshare of wall clock:")
    for node, elapsed in sorted(timings, key=lambda t: -t[1]):
        print(f"  {node:12} {elapsed:7.1f}s  {elapsed / total * 100:5.1f}%")

    await disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
