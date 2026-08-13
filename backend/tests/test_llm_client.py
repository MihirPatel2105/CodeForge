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


def test_every_chain_ends_at_a_local_model():
    """The last rung must be local: it is the only one that still answers when every
    free tier is rate limited at once."""
    for agent, chain in CHAINS.items():
        assert chain[-1].model.startswith("ollama/"), f"{agent} has no local last resort"
        assert "api_base" in chain[-1].extra, f"{agent} local rung needs an api_base"


def test_no_duplicate_models_within_a_chain():
    for agent, chain in CHAINS.items():
        models = [spec.model for spec in chain]
        assert len(models) == len(set(models)), f"{agent} retries the same model twice"
