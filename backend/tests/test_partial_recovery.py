"""A missing designed module is recoverable on a Coder loop pass."""

import asyncio

from app.graph.nodes import _collect_usage, _fix_tree
from app.llm.client import LLMAttempt, LLMResult
from app.schemas.agents import Design, FileSpec, GeneratedFile, SingleFileOutput


def test_fix_loop_creates_missing_designed_file_and_keeps_expected_path():
    design = Design.model_construct(
        files=[
            FileSpec(path="main.py", purpose="routes"),
            FileSpec(path="schemas.py", purpose="response models"),
        ]
    )
    state = {
        "run_id": "generic-test-run",
        "design": design,
        "files": [GeneratedFile(path="main.py", content="value = 1\n")],
        "review": None,
        "tests": None,
        "loop_count": 0,
        "errors": [],
        "llm_attempts": [],
        "llm_tokens": 0,
    }

    class FakeCoder:
        async def run_file(self, supplied, spec):
            assert supplied["loop_count"] == 1
            assert spec.path == "schemas.py"
            return LLMResult(
                value=SingleFileOutput(path="wrong.py", content="value = 2\n"),
                model="groq/a",
                attempts=[LLMAttempt(model="groq/a", mode="json_schema", ok=True)],
            )

    update = asyncio.run(_fix_tree(state, FakeCoder(), "tester"))
    assert [f.path for f in update["files"]] == ["main.py", "schemas.py"]
    assert update["files"][1].content == "value = 2\n"
    assert update["loop_history"][-1]["files_changed"] == ["schemas.py"]
    assert update["errors"] == []


def test_same_model_cooldown_is_not_a_provider_fallback():
    result = LLMResult(
        value="ok",
        model="groq/a",
        attempts=[
            LLMAttempt(model="groq/a", mode="json_schema", ok=False, error="429"),
            LLMAttempt(model="groq/a", mode="json_schema", ok=True),
        ],
    )
    attempts, _ = _collect_usage([], 0, result)
    assert len(attempts) == 2
    assert not any(attempt["fallback"] for attempt in attempts)
