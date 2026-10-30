"""`agent.failed` names the actual cause, matching the error recorded in run state.

Only exhausting every provider is `llm_exhausted`. A request a provider rejected outright
is a different failure, and labelling it as quota exhaustion misleads anyone reading the
durable event history.
"""

import asyncio

import pytest

from app.agents import ArchitectAgent, PMAgent, ReviewerAgent, TesterAgent
from app.core.exceptions import ProviderExhaustedError
from app.graph import nodes
from app.schemas.agents import Design, GeneratedFile


@pytest.fixture
def emitted(monkeypatch):
    failures: list[tuple[str, str]] = []

    async def agent_failed(_run_id, agent, code, _message, iteration=0):
        failures.append((agent, code))

    async def nothing(*_args, **_kwargs):
        return None

    monkeypatch.setattr(nodes.events, "agent_failed", agent_failed)
    monkeypatch.setattr(nodes.events, "agent_started", nothing)
    monkeypatch.setattr(nodes, "save_state", nothing)
    return failures


def _state() -> dict:
    return {
        "run_id": "run-1",
        "user_prompt": "Books API",
        "design": Design.model_construct(files=[], endpoints=[]),
        "files": [GeneratedFile(path="main.py", content="value = 1\n")],
        "errors": [],
        "llm_attempts": [],
    }


CASES = [
    (PMAgent, nodes.pm_node, "pm"),
    (ArchitectAgent, nodes.architect_node, "architect"),
    (ReviewerAgent, nodes.reviewer_node, "reviewer"),
    (TesterAgent, nodes.tester_node, "tester"),
]


@pytest.mark.parametrize(("agent_cls", "node", "name"), CASES)
def test_rejected_request_is_not_reported_as_provider_exhaustion(
    monkeypatch, emitted, agent_cls, node, name
):
    async def rejected(_self, _state):
        raise ValueError("malformed request")

    monkeypatch.setattr(agent_cls, "run", rejected)
    update = asyncio.run(node(_state()))

    assert emitted == [(name, "ValueError")]
    assert update["errors"][-1]["code"] == "ValueError"


@pytest.mark.parametrize(("agent_cls", "node", "name"), CASES)
def test_exhausted_provider_chain_is_reported_as_llm_exhausted(
    monkeypatch, emitted, agent_cls, node, name
):
    async def exhausted(_self, _state):
        raise ProviderExhaustedError("every model failed")

    monkeypatch.setattr(agent_cls, "run", exhausted)
    update = asyncio.run(node(_state()))

    assert emitted == [(name, "llm_exhausted")]
    assert update["errors"][-1]["code"] == "llm_exhausted"
