"""Graph structure, fallback classification and completion honesty.

Offline: no LLM calls. These lock in behaviour that broke during Phase 4 development.
"""

import litellm
import pytest

from app.graph.build import build_graph, thread_config
from app.llm.client import _is_retryable


def test_graph_has_every_agent_node():
    nodes = {n for n in build_graph().nodes if not n.startswith("__")}
    assert {"pm", "architect", "coder", "reviewer", "tester", "finalise"} <= nodes


def test_thread_config_shape():
    assert thread_config("abc") == {"configurable": {"thread_id": "abc"}}


# --------------------------------------------------------------------------- #
# Fallback classification — each of these aborted a real run before being fixed
# --------------------------------------------------------------------------- #


def test_upstream_resource_exhausted_falls_through():
    """OpenRouter relays Nvidia's ResourceExhausted as a generic APIError. It aborted the
    Reviewer instead of reaching the local model."""
    exc = litellm.APIError(
        status_code=429,
        message="OpenrouterException - Upstream error from Nvidia: ResourceExhausted",
        llm_provider="openrouter",
        model="m",
    )
    assert _is_retryable(exc)


def test_model_answering_in_prose_falls_through():
    """Instructor raises this when a model replies with text instead of calling the tool.
    It cost a file during a real run."""

    class Instructorish(Exception):
        pass

    assert _is_retryable(Instructorish("No tool calls or function call detected"))


def test_truncated_output_falls_through():
    class Wrapper(Exception):
        pass

    assert _is_retryable(Wrapper("The output is incomplete due to a max_tokens length limit."))


def test_genuine_bad_request_still_fails_fast():
    exc = litellm.BadRequestError(
        "messages: content must be a string", llm_provider="groq", model="m"
    )
    assert not _is_retryable(exc)


# --------------------------------------------------------------------------- #
# finalise_node must not flatter an incomplete run
# --------------------------------------------------------------------------- #


@pytest.fixture
def design_with_four_files():
    from app.schemas.agents import Design, Endpoint, EntityField, FileSpec

    return Design(
        collections=[{"name": "books", "fields": [EntityField(name="title", type="str")]}],
        endpoints=[
            Endpoint(
                method="GET",
                path="/books",
                response_model="BookRead",
                status_code=200,
            )
        ],
        files=[FileSpec(path=p) for p in ("database.py", "models.py", "schemas.py", "main.py")],
    )


def _state(design, files, **extra):
    from app.schemas.agents import GeneratedFile, Requirements

    base = {
        "run_id": "",  # empty: save_state is a no-op, keeping this test offline
        "requirements": Requirements(
            project_name="p",
            summary="s",
            entities=[{"name": "Book", "fields": [{"name": "title", "type": "str"}]}],
            operations=["create"],
        ),
        "design": design,
        "files": [GeneratedFile(path=p, content="x") for p in files],
    }
    base.update(extra)
    return base


async def _finalise(state):
    from app.graph.nodes import finalise_node

    return await finalise_node(state)


def test_missing_file_is_not_a_success(design_with_four_files):
    """The bug: a tree missing schemas.py, never reviewed, reported 'succeeded'."""
    import asyncio

    from app.schemas.agents import GeneratedFile, ReviewResult

    state = _state(
        design_with_four_files,
        ["database.py", "models.py", "main.py"],  # schemas.py absent
        review=ReviewResult(findings=[]),
        test_files=[GeneratedFile(path="test_main.py", content="x")],
    )
    result = asyncio.run(_finalise(state))
    assert result["status"] == "failed_llm"
    assert any("schemas.py" in e["message"] for e in result["errors"])


def test_missing_review_is_not_a_success(design_with_four_files):
    import asyncio

    from app.schemas.agents import GeneratedFile

    state = _state(
        design_with_four_files,
        ["database.py", "models.py", "schemas.py", "main.py"],
        review=None,
        test_files=[GeneratedFile(path="test_main.py", content="x")],
    )
    result = asyncio.run(_finalise(state))
    assert result["status"] == "failed_llm"
    assert any("review did not run" in e["message"] for e in result["errors"])


def test_complete_run_succeeds(design_with_four_files):
    import asyncio

    from app.schemas.agents import GeneratedFile, ReviewResult

    state = _state(
        design_with_four_files,
        ["database.py", "models.py", "schemas.py", "main.py"],
        review=ReviewResult(findings=[]),
        test_files=[GeneratedFile(path="test_main.py", content="x")],
    )
    result = asyncio.run(_finalise(state))
    assert result["status"] == "succeeded"
    assert "errors" not in result
