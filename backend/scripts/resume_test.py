"""Crash-and-resume check — the second half of the Phase 4 Definition of Done.

    PYTHONPATH=. python scripts/resume_test.py start          # writes the run id, then runs
    PYTHONPATH=. python scripts/resume_test.py resume <run_id>  # continues from the checkpoint

`start` is meant to be killed mid-run (SIGKILL, no cleanup — a real crash). `resume` runs
in a fresh process with a fresh checkpointer and continues from the last completed node,
proving the run survives process death (FR-27).
"""

import asyncio
import os
import sys
import time
from pathlib import Path

from app.db import connect, disconnect
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Project, Run, User

RUN_ID_FILE = Path("/tmp/codeforge_resume_run_id")

PROMPT = (
    "I want an API to manage my personal book collection. Each book has a title, "
    "an author, the year it was published, and a list of genres."
)


async def start() -> int:
    await connect()
    user = User(email=f"resume-{int(time.time())}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="Resume test")
    await project.insert()
    run = Run(project_id=str(project.id), user_id=str(user.id), prompt=PROMPT, status="running")
    await run.insert()

    run_id = str(run.id)
    # os.write rather than Path.write_text: the async lint rules forbid blocking pathlib
    # calls inside a coroutine, and this must land before the process can be killed.
    fd = os.open(RUN_ID_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)
    os.write(fd, run_id.encode())
    os.close(fd)
    print(f"run_id {run_id}", flush=True)

    state = new_run_state(
        run_id=run_id,
        project_id=str(project.id),
        user_id=str(user.id),
        thread_id=run_id,
        user_prompt=PROMPT,
    )

    graph = compile_graph(with_approvals=False)
    async for chunk in graph.astream(state, config=thread_config(run_id)):
        for node in chunk:
            print(f"completed {node}", flush=True)

    await disconnect()
    return 0


async def resume(run_id: str) -> int:
    await connect()
    graph = compile_graph(with_approvals=False)  # fresh compile, fresh checkpointer
    config = thread_config(run_id)

    snapshot = await graph.aget_state(config)
    done = [
        k
        for k in ("requirements", "design", "files", "review", "test_files")
        if snapshot.values.get(k)
    ]
    print(f"checkpoint found : {bool(snapshot.values)}")
    print(f"state recovered  : {done}")
    print(f"next node        : {snapshot.next}")

    if not snapshot.next:
        print("nothing to resume - the run had already finished")
        await disconnect()
        return 1

    print("resuming ...", flush=True)
    final = await graph.ainvoke(None, config=config)  # None continues from the checkpoint

    print(f"\nstatus : {final.get('status')}")
    print(f"files  : {[f.path for f in final.get('files') or []]}")
    print(f"tests  : {[f.path for f in final.get('test_files') or []]}")
    review = final.get("review")
    print(f"review : {len(review.findings)} findings" if review else "review : none")

    await disconnect()
    return 0


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "start"
    if mode == "start":
        sys.exit(asyncio.run(start()))
    target = sys.argv[2] if len(sys.argv) > 2 else RUN_ID_FILE.read_text().strip()
    sys.exit(asyncio.run(resume(target)))
