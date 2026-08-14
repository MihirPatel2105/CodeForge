"""Live end-to-end checks for the LangGraph pipeline.

Skipped by default: real LLM calls cost free-tier quota, take minutes, and fail when a
provider is down. Run deliberately:

    RUN_LIVE_LLM=1 pytest tests/test_graph_live.py -v

The pipeline runs **once** for the whole module. A per-test fixture would re-run five
agents for each assertion, which is exactly the quota this project is built to conserve.

Assertions are about shape and rules, never exact wording — the models are
non-deterministic, and pinning their prose would fail for no useful reason.
"""

import ast
import os
import time

import pytest

from app.db import connect, disconnect
from app.graph.build import compile_graph, thread_config
from app.graph.state import new_run_state
from app.models import Project, Run, User

pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_LIVE_LLM"),
    reason="live LLM test; set RUN_LIVE_LLM=1 to run",
)

BOOKS_PROMPT = (
    "I want an API to manage my personal book collection. Each book has a title, "
    "an author, the year it was published, and a list of genres."
)


async def _seed_run(prompt: str):
    await connect()
    user = User(email=f"live-{int(time.time() * 1000)}@example.com", hashed_password="x")
    await user.insert()
    project = Project(user_id=str(user.id), name="Live graph")
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
    return run_id, state


@pytest.fixture(scope="module")
def completed_run():
    """One full pipeline pass, captured for every assertion below."""
    import asyncio

    async def go():
        run_id, state = await _seed_run(BOOKS_PROMPT)
        graph = compile_graph(with_approvals=False)
        final = await graph.ainvoke(state, config=thread_config(run_id))
        await disconnect()
        return final

    return asyncio.run(go())


def test_pm_stays_within_scope(completed_run):
    requirements = completed_run["requirements"]
    assert 1 <= len(requirements.entities) <= 2

    allowed = {"str", "int", "float", "bool", "datetime", "list[str]"}
    for entity in requirements.entities:
        assert entity.fields
        assert all(f.type in allowed for f in entity.fields)


def test_architect_declares_a_response_model_for_every_body(completed_run):
    """The ObjectId rule: anything returning a body must name a response model."""
    design = completed_run["design"]
    assert design.endpoints
    for endpoint in design.endpoints:
        if endpoint.status_code != 204:
            assert endpoint.response_model, f"{endpoint.method} {endpoint.path}"


def test_coder_writes_every_designed_file_and_they_parse(completed_run):
    design = completed_run["design"]
    files = completed_run["files"]

    written = {f.path for f in files}
    missing = [spec.path for spec in design.files if spec.path not in written]
    assert not missing, f"designed but not generated: {missing}"

    for generated in files:
        if generated.path.endswith(".py"):
            ast.parse(generated.content)  # acceptance level L2


def test_generated_code_obeys_the_hard_rules(completed_run):
    joined = "\n".join(f.content for f in completed_run["files"])
    assert "motor" not in joined.lower(), "Beanie 2.x dropped motor; it is not installed"
    assert "response_model" in joined
    assert "mongodb://localhost:27017" in joined
    assert "init_beanie" in joined


def test_reviewer_returns_structured_findings(completed_run):
    """Findings must be structured, and `passed` must agree with them — it is recomputed
    rather than trusted, because a model claiming success while listing blockers would
    silently skip the fix pass."""
    review = completed_run["review"]
    assert review is not None, "the reviewer produced nothing"

    for finding in review.findings:
        assert finding.severity in {"blocking", "warning", "nit"}
        assert finding.issue

    assert review.passed == (not any(f.severity == "blocking" for f in review.findings))


def test_tester_writes_a_synchronous_suite(completed_run):
    test_files = completed_run["test_files"]
    assert test_files, "no tests were written"

    source = test_files[0].content
    ast.parse(source)
    assert "TestClient" in source
    # Async tests break in the sandbox: pytest-asyncio is deliberately not installed.
    assert "pytest.mark.asyncio" not in source


def test_prompt_versions_are_recorded(completed_run):
    """Prompt changes move the metrics, so the report must know which produced which."""
    versions = completed_run["prompt_versions"]
    assert {"pm", "architect", "coder"} <= set(versions)
