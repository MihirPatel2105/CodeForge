"""The single entry point for every LLM call.

Agents call `structured()` and get a validated Pydantic object back, or an exception.
They never see a provider, a retry, or a raw completion string (CLAUDE.md §6).

Responsibilities, in order:
  1. Walk the agent's model chain, moving to the next rung on a rate limit or provider
     error. Free-tier 429s are expected operation, not failure (NFR-4).
  2. Enforce structured output through Instructor, so malformed JSON is retried against
     the schema rather than parsed by hand.
  3. Trace every attempt to Langfuse with run id, agent and iteration (FR-42).
"""

import os
from typing import Any, TypeVar

import litellm
from pydantic import BaseModel

from app.config import settings
from app.core.exceptions import ProviderExhaustedError
from app.llm.registry import ModelSpec, chain_for

T = TypeVar("T", bound=BaseModel)

litellm.suppress_debug_info = True
litellm.drop_params = True  # not every provider accepts every sampling parameter

_configured = False


class LLMAttempt(BaseModel):
    """One rung of the chain, recorded so a run can report why it fell through."""

    model: str
    ok: bool
    error: str | None = None


class LLMResult(BaseModel):
    value: Any
    model: str
    attempts: list[LLMAttempt]
    tokens: int = 0

    @property
    def fallbacks(self) -> int:
        """How many rungs failed before one worked — feeds RunMetrics."""
        return max(0, len(self.attempts) - 1)


def configure() -> None:
    """Push credentials into the environment LiteLLM reads, and enable tracing.

    Idempotent: safe to call from every agent invocation.
    """
    global _configured
    if _configured:
        return

    for env_name, value in (
        ("GROQ_API_KEY", settings.groq_api_key),
        ("CEREBRAS_API_KEY", settings.cerebras_api_key),
        ("OPENROUTER_API_KEY", settings.openrouter_api_key),
        ("GEMINI_API_KEY", settings.google_api_key),
    ):
        if value:
            os.environ[env_name] = value

    if settings.langfuse_public_key and settings.langfuse_secret_key:
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
        os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
        os.environ["LANGFUSE_HOST"] = settings.langfuse_host
        litellm.success_callback = ["langfuse"]
        litellm.failure_callback = ["langfuse"]

    _configured = True


_RETRYABLE_TYPES = (
    litellm.RateLimitError,
    litellm.ServiceUnavailableError,
    litellm.InternalServerError,
    litellm.APIConnectionError,
    litellm.Timeout,
    litellm.NotFoundError,  # model retired from a provider's catalogue
    litellm.AuthenticationError,  # key missing or revoked for this provider only
)

# Providers disagree on the status code for a bad credential: Groq answers an invalid key
# with 400 BadRequest, which is otherwise the one error worth failing fast on. These
# markers separate "this provider won't serve us" from "the prompt is malformed".
_RETRYABLE_MARKERS = (
    "invalid api key",
    "invalid_api_key",
    "no api key",
    "unauthorized",
    "authentication",
    "payment required",
    "insufficient",
    "quota",
    "rate limit",
    "too many requests",
    "overloaded",
    "does not exist",
    "unavailable",
)


def _causes(exc: BaseException):
    """Walk the exception chain. Instructor wraps provider errors in its own retry
    exception, so the LiteLLM error is never the outermost one."""
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        current = current.__cause__ or current.__context__


def _is_retryable(exc: Exception) -> bool:
    """Whether to try the next model.

    Rate limits, outages, missing models and dead credentials are worth falling through
    for. A genuinely malformed request is not: the next provider would reject it
    identically, so failing fast makes the real bug visible.
    """
    for err in _causes(exc):
        if isinstance(err, _RETRYABLE_TYPES):
            return True
        message = str(err).lower()
        if any(marker in message for marker in _RETRYABLE_MARKERS):
            return True
    return False


async def structured(
    *,
    prompt: str,
    schema: type[T],
    agent: str,
    trace: dict[str, Any] | None = None,
    system: str | None = None,
    temperature: float = 0.2,
) -> LLMResult:
    """Run `prompt` down `agent`'s chain until one model returns a valid `schema`."""
    configure()

    import instructor

    client = instructor.from_litellm(litellm.acompletion)

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    attempts: list[LLMAttempt] = []
    chain: list[ModelSpec] = chain_for(agent)

    for spec in chain:
        try:
            value = await client.chat.completions.create(
                model=spec.model,
                messages=messages,
                response_model=schema,
                temperature=temperature,
                max_retries=2,  # Instructor re-asks on schema violations
                metadata=_trace_metadata(agent, trace),
                **({"max_tokens": spec.max_tokens} if spec.max_tokens else {}),
                **spec.extra,
            )
            attempts.append(LLMAttempt(model=spec.model, ok=True))
            return LLMResult(value=value, model=spec.model, attempts=attempts)

        except Exception as exc:  # noqa: BLE001 - classified immediately below
            attempts.append(
                LLMAttempt(model=spec.model, ok=False, error=f"{type(exc).__name__}: {exc}"[:300])
            )
            if not _is_retryable(exc):
                raise

    raise ProviderExhaustedError(
        f"Every model failed for agent {agent!r}: "
        + "; ".join(f"{a.model} -> {a.error}" for a in attempts)
    )


async def complete(
    *,
    prompt: str,
    agent: str,
    trace: dict[str, Any] | None = None,
    system: str | None = None,
    temperature: float = 0.2,
) -> LLMResult:
    """Unstructured variant. Used only for smoke checks — agents use `structured()`."""
    configure()

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    attempts: list[LLMAttempt] = []

    for spec in chain_for(agent):
        try:
            response = await litellm.acompletion(
                model=spec.model,
                messages=messages,
                temperature=temperature,
                metadata=_trace_metadata(agent, trace),
                **({"max_tokens": spec.max_tokens} if spec.max_tokens else {}),
                **spec.extra,
            )
            attempts.append(LLMAttempt(model=spec.model, ok=True))
            return LLMResult(
                value=response.choices[0].message.content,
                model=spec.model,
                attempts=attempts,
                tokens=getattr(response.usage, "total_tokens", 0) or 0,
            )
        except Exception as exc:  # noqa: BLE001
            attempts.append(
                LLMAttempt(model=spec.model, ok=False, error=f"{type(exc).__name__}: {exc}"[:300])
            )
            if not _is_retryable(exc):
                raise

    raise ProviderExhaustedError(f"Every model failed for agent {agent!r}")


def _trace_metadata(agent: str, trace: dict[str, Any] | None) -> dict[str, Any]:
    meta = {"generation_name": f"{agent}-agent", "tags": [agent]}
    if trace:
        meta.update(
            {
                "trace_id": trace.get("run_id"),
                "run_id": trace.get("run_id"),
                "agent": agent,
                "iteration": trace.get("iteration", 0),
            }
        )
    return meta
