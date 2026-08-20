"""Fallback-classification tests.

These run offline: they exercise the decision logic that decides whether to try the next
model, which is the part that broke in practice. Live provider calls are covered by
`scripts/probe_models.py`.
"""

import litellm
import pytest

from app.llm.client import _is_retryable
from app.llm.registry import CHAINS, chain_for


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


def test_no_duplicate_models_within_a_chain():
    for agent, chain in CHAINS.items():
        models = [spec.model for spec in chain]
        assert len(models) == len(set(models)), f"{agent} retries the same model twice"
