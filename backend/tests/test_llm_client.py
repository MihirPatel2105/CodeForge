"""Fallback-classification tests.

These run offline: they exercise the decision logic that decides whether to try the next
model, which is the part that broke in practice. Live provider calls are covered by
`scripts/preflight.py`.
"""

import asyncio
from types import SimpleNamespace

import instructor
import litellm
import pytest
from pydantic import BaseModel

from app.core.exceptions import ProviderExhaustedError
from app.llm import client
from app.llm.client import _is_retryable, _short_rate_limit_delay
from app.llm.registry import CHAINS, ModelSpec, chain_for


class FakeInstructorWrapper(Exception):
    """Stands in for InstructorRetryException, which wraps the provider error rather
    than being one."""


def _wrapped(inner: Exception) -> Exception:
    outer = FakeInstructorWrapper("instructor gave up")
    outer.__cause__ = inner
    return outer


def test_rate_limit_is_retryable():
    assert _is_retryable(litellm.RateLimitError("429", llm_provider="groq", model="m"))


def test_wrapped_rate_limit_is_retryable():
    """Instructor hides the provider error one level down; the classifier must unwrap."""
    inner = litellm.RateLimitError("429", llm_provider="groq", model="m")
    assert _is_retryable(_wrapped(inner))


def test_invalid_api_key_reported_as_bad_request_is_retryable():
    """Groq answers a dead key with 400, not 401. Without this the chain aborts on the
    first rung instead of falling through."""
    exc = litellm.BadRequestError(
        'GroqException - {"error":{"message":"Invalid API Key","code":"invalid_api_key"}}',
        llm_provider="groq",
        model="m",
    )
    assert _is_retryable(exc)
    assert _is_retryable(_wrapped(exc))


def test_payment_required_is_retryable():
    """Cerebras' free tier now answers this; the chain must move on rather than fail."""
    exc = litellm.APIError(
        status_code=402,
        message="CerebrasException - Payment required to access this resource.",
        llm_provider="cerebras",
        model="m",
    )
    assert _is_retryable(exc)


def test_truncated_single_file_output_is_retryable():
    """`SingleFileOutput`'s own validator (schemas/agents.py) raises this once Instructor's
    in-rung reasks are exhausted on a file that still won't parse — almost always the
    model hitting its token ceiling mid-file. Without this marker the chain raised on
    rung 1 and never reached a rung with a larger budget, which happened for real: every
    live Tester run that hit this error failed after exactly one rung (2026-08-15)."""
    exc = FakeInstructorWrapper(
        "1 validation error for SingleFileOutput\n  Value error, test_main.py is not "
        "valid Python. Return the complete file; if it was cut short, write a shorter "
        "implementation rather than a truncated one."
    )
    assert _is_retryable(exc)


def test_duplicate_document_id_validation_can_fall_through_to_another_model():
    exc = FakeInstructorWrapper(
        "1 validation error for SingleFileOutput: main.py duplicates document id"
    )
    assert _is_retryable(exc)


def test_prose_instead_of_a_tool_call_is_retryable():
    """Groq reports a model narrating the schema instead of emitting it as a 400
    `output_parse_failed`, which is otherwise the one error worth failing fast on. It is
    a property of that model, not of the prompt, so the chain must fall through. Observed
    live 2026-08-19: the Architect died on rung 1 — with an OpenRouter rung and a local
    rung below it untried — and took the whole run down in 18 seconds."""
    exc = litellm.BadRequestError(
        'GroqException - {"error":{"message":"Parsing failed. The model generated output '
        'that could not be parsed. Please adjust your prompt.","type":"invalid_request_error",'
        '"code":"output_parse_failed","failed_generation":"We need to output a structured '
        'object matching the Design type"}}',
        llm_provider="groq",
        model="m",
    )
    assert _is_retryable(exc)
    assert _is_retryable(_wrapped(exc))


def test_genuine_bad_request_is_not_retryable():
    """A malformed prompt fails identically everywhere, so it must fail fast and stay
    visible instead of burning the whole chain."""
    exc = litellm.BadRequestError(
        "messages: content must be a string", llm_provider="groq", model="m"
    )
    assert not _is_retryable(exc)


def test_groq_invalid_json_falls_through_to_a_different_output_mode():
    exc = litellm.BadRequestError(
        'GroqException - {"error":{"code":"json_validate_failed"}}',
        llm_provider="groq",
        model="m",
    )
    assert _is_retryable(_wrapped(exc))


def test_mistral_fallback_receives_configured_key(monkeypatch):
    monkeypatch.setattr(client, "_configured", False)
    monkeypatch.setattr(client.settings, "mistral_api_key", "test-mistral-key")
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    client.configure()
    assert client.os.environ["MISTRAL_API_KEY"] == "test-mistral-key"


def test_every_rung_429_exhausts_chain_with_attempts_recorded(monkeypatch):
    class AlwaysLimited:
        async def create(self, **kwargs):
            raise litellm.RateLimitError(
                "429 rate limit", llm_provider="groq", model=kwargs["model"]
            )

    fake = SimpleNamespace(chat=SimpleNamespace(completions=AlwaysLimited()))
    monkeypatch.setattr(instructor, "from_litellm", lambda *_, **__: fake)
    monkeypatch.setattr(client, "configure", lambda: None)
    monkeypatch.setattr(
        client,
        "chain_for",
        lambda *_: [ModelSpec(model="groq/a"), ModelSpec(model="openrouter/b")],
    )
    with pytest.raises(ProviderExhaustedError) as caught:
        asyncio.run(client.structured(prompt="test", schema=BaseModel, agent="tester"))
    assert [attempt.model for attempt in caught.value.attempts] == ["groq/a", "openrouter/b"]
    assert all(not attempt.ok for attempt in caught.value.attempts)


def test_schema_mode_uses_groq_then_tools_for_provider_fallback(monkeypatch):
    class Output(BaseModel):
        name: str

    seen: list[instructor.Mode] = []

    class FakeCompletions:
        def __init__(self, mode):
            self.mode = mode

        async def create(self, **kwargs):
            if self.mode == instructor.Mode.JSON_SCHEMA:
                raise litellm.RateLimitError(
                    "429 rate limit", llm_provider="groq", model=kwargs["model"]
                )
            return Output(name="books")

    def fake_from_litellm(_completion, *, mode):
        seen.append(mode)
        return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(mode)))

    monkeypatch.setattr(instructor, "from_litellm", fake_from_litellm)
    monkeypatch.setattr(client, "configure", lambda: None)
    monkeypatch.setattr(
        client,
        "chain_for",
        lambda *_: [
            ModelSpec(model="groq/a", structured_mode="json_schema"),
            ModelSpec(model="openrouter/b"),
        ],
    )
    result = asyncio.run(client.structured(prompt="test", schema=Output, agent="architect"))
    assert result.value.name == "books"
    assert seen == [instructor.Mode.JSON_SCHEMA, instructor.Mode.TOOLS]
    assert [(a.mode, a.ok) for a in result.attempts] == [
        ("json_schema", False),
        ("tools", True),
    ]


def test_invalid_schema_json_retries_same_groq_model_in_json_mode(monkeypatch):
    class Output(BaseModel):
        name: str

    seen: list[instructor.Mode] = []

    class FakeCompletions:
        def __init__(self, mode):
            self.mode = mode

        async def create(self, **kwargs):
            if self.mode == instructor.Mode.JSON_SCHEMA:
                raise litellm.BadRequestError(
                    'GroqException - {"error":{"code":"json_validate_failed"}}',
                    llm_provider="groq",
                    model=kwargs["model"],
                )
            return Output(name="books")

    def fake_from_litellm(_completion, *, mode):
        seen.append(mode)
        return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(mode)))

    monkeypatch.setattr(instructor, "from_litellm", fake_from_litellm)
    monkeypatch.setattr(client, "configure", lambda: None)
    monkeypatch.setattr(
        client,
        "chain_for",
        lambda *_: [
            ModelSpec(model="groq/a", structured_mode="json_schema"),
            ModelSpec(model="groq/a", structured_mode="json"),
        ],
    )
    result = asyncio.run(client.structured(prompt="test", schema=Output, agent="tester"))
    assert result.value.name == "books"
    assert seen == [instructor.Mode.JSON_SCHEMA, instructor.Mode.JSON]
    assert [(a.model, a.mode, a.ok) for a in result.attempts] == [
        ("groq/a", "json_schema", False),
        ("groq/a", "json", True),
    ]


def test_short_429_waits_and_retries_same_model(monkeypatch):
    class Output(BaseModel):
        name: str

    calls = 0
    slept: list[float] = []

    class OnceLimited:
        async def create(self, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise litellm.RateLimitError(
                    "429 TPM",
                    llm_provider="groq",
                    model=kwargs["model"],
                    headers={"retry-after": "2"},
                )
            return Output(name="books")

    async def fake_sleep(delay):
        slept.append(delay)

    fake = SimpleNamespace(chat=SimpleNamespace(completions=OnceLimited()))
    monkeypatch.setattr(instructor, "from_litellm", lambda *_, **__: fake)
    monkeypatch.setattr(client, "configure", lambda: None)
    monkeypatch.setattr(client.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(
        client,
        "chain_for",
        lambda *_: [ModelSpec(model="groq/a", structured_mode="json_schema")],
    )
    result = asyncio.run(client.structured(prompt="test", schema=Output, agent="architect"))
    assert result.value.name == "books"
    assert calls == 2 and slept == [2.5]
    assert [a.model for a in result.attempts] == ["groq/a", "groq/a"]


def test_long_429_does_not_wait_on_the_same_provider():
    exc = litellm.RateLimitError(
        "429 daily quota", llm_provider="groq", model="m", headers={"retry-after": "3600"}
    )
    assert _short_rate_limit_delay(exc) is None
    message = litellm.RateLimitError("Please try again in 1.5225s", llm_provider="groq", model="m")
    assert _short_rate_limit_delay(message) == pytest.approx(2.0225)
    milliseconds = litellm.RateLimitError(
        "Please try again in 862.5ms", llm_provider="groq", model="m"
    )
    assert _short_rate_limit_delay(milliseconds) == pytest.approx(1.3625)


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #


def test_every_agent_has_a_chain():
    for agent in ("pm", "architect", "coder", "reviewer", "tester"):
        assert len(chain_for(agent)) >= 2, f"{agent} needs at least one fallback"


def test_unknown_agent_raises():
    with pytest.raises(KeyError):
        chain_for("nonexistent")


def test_every_chain_spans_more_than_one_provider():
    """No agent may depend on a single provider.

    This replaces an earlier rule that every chain must end at a local Ollama model.
    That guaranteed a rung nobody could rate-limit, but it also made a 2GB local model a
    setup prerequisite for every contributor (removed 2026-08-20 — see the registry
    docstring). What still has to hold is the reason the rule existed: one provider
    having a bad minute must never take an agent down with it.
    """
    for agent, chain in CHAINS.items():
        providers = {spec.model.split("/", 1)[0] for spec in chain}
        assert len(chain) >= 2, f"{agent} has only one rung — no fallback at all"
        assert len(providers) >= 2, (
            f"{agent} depends on a single provider ({providers}) — one outage kills it"
        )


def test_no_duplicate_model_mode_pairs_within_a_chain():
    for agent, chain in CHAINS.items():
        pairs = [(spec.model, spec.structured_mode) for spec in chain]
        assert len(pairs) == len(set(pairs)), f"{agent} repeats the same output mode twice"
