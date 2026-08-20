"""Pinned model chains — the only place a model name appears.

Never hardcode a model string in an agent (CLAUDE.md §5). Changing routing means editing
this file and nothing else.

Every id below was probed against the live provider APIs on 2026-08-13; see
`scripts/probe_models.py` to re-verify after a provider changes its catalogue.

Two deviations from CLAUDE.md §5 as originally written:

1. The Coder was specified as Cerebras-primary for its token headroom, but Cerebras'
   free tier now returns "Payment required" for every model in the account catalogue,
   which conflicts with the $0 constraint. Groq is primary for all agents instead.
2. Every chain used to end at a local Ollama model, on the reasoning that it is the one
   rung no third party can rate-limit. Removed 2026-08-20: it required every contributor
   to install Ollama and pull a 2GB model before the project would run, which is a real
   barrier for a team, and its worst case was a ~10-minute crawl through 120s timeouts
   producing output a 3B model could rarely use anyway (for the Reviewer it was measured
   to emit no tool call at all). Mistral took its place as the last rung the same day,
   restoring a third independent provider without any local setup.

Providers probed and rejected on 2026-08-20, recorded so nobody re-tries them blind:
GitHub Models returns 410 `github_models_retirement_brownout` (the service is being
retired); Google AI Studio still 401s on every auth method because the account can only
issue `AQ.`-prefixed keys, which `generativelanguage.googleapis.com` does not accept;
Cerebras still answers 402 on inference. Note that Cerebras' *catalogue* endpoint returns
200 — a health check that only lists models would call it healthy, so any probe has to
attempt a real completion.
"""

from pydantic import BaseModel

# --- provider model ids ---------------------------------------------------- #

GROQ_GPT_OSS = "groq/openai/gpt-oss-120b"
GROQ_GPT_OSS_20B = "groq/openai/gpt-oss-20b"
# Retired from Groq's catalogue as of 2026-08-18 — confirmed live via
# GET https://api.groq.com/openai/v1/models, which no longer lists it at all. Every
# rung that named it (pm's 2nd rung, tester's 1st) failed instantly with
# NotFoundError on every single call. Kept here, unused, as a paper trail; do not
# reintroduce it.
_RETIRED_GROQ_LLAMA_70B = "groq/llama-3.3-70b-versatile"

OPENROUTER_NEMOTRON_SUPER = "openrouter/nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_NEMOTRON_NANO = "openrouter/nvidia/nemotron-3-nano-30b-a3b:free"
OPENROUTER_NORTH_CODE = "openrouter/cohere/north-mini-code:free"

# The third provider, and the last rung of every chain. Verified 2026-08-20 through
# the real structured()/Instructor path: it returns a valid ReviewResult for code
# containing quotes and newlines — the exact payload that breaks Groq's tool-call
# JSON parsing — so it is a genuine independent fallback, not a nominal one.
MISTRAL_MEDIUM = "mistral/mistral-medium-latest"


class ModelSpec(BaseModel):
    """One rung of a fallback chain."""

    model: str
    # Extra kwargs LiteLLM needs for this model.
    extra: dict = {}

    # Groq reserves `prompt + max_tokens` against its 8000 TPM budget, so an inflated
    # ceiling throttles throughput even when the reply is short. Keep these tight.
    max_tokens: int | None = None

    # A rung that hangs is worse than one that fails: the chain cannot move on until it
    # returns. Measured 2026-08-14: an OpenRouter rung burned 180s before timing out,
    # which was 29% of a whole run.
    timeout: int | None = None


# --- per-agent chains, tried in order -------------------------------------- #

CHAINS: dict[str, list[ModelSpec]] = {
    "pm": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=GROQ_GPT_OSS_20B),
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER),
        ModelSpec(model=MISTRAL_MEDIUM, timeout=90),
    ],
    "architect": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER),
        ModelSpec(model=MISTRAL_MEDIUM, timeout=90),
    ],
    # Writes the most tokens per turn, so it gets the largest budget and a
    # code-specialised cloud fallback.
    # Groq's free tier caps at 8000 tokens per minute *including the prompt*, so the
    # Coder's budget is set below that: at 8000 it overran on the first real run
    # (requested 8470) and every request fell through to the fallback.
    # 2500 rather than 5500: generated files run 1-3 KB (~500-800 tokens), so the larger
    # ceiling reserved TPM that was never used and capped Groq at roughly one file per
    # minute. Measured 2026-08-14: the Coder was 70% of a 764s run.
    "coder": [
        ModelSpec(model=GROQ_GPT_OSS, max_tokens=2500, timeout=90),
        ModelSpec(model=OPENROUTER_NORTH_CODE, max_tokens=8000, timeout=120),
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER, max_tokens=8000, timeout=120),
        ModelSpec(model=MISTRAL_MEDIUM, max_tokens=8000, timeout=120),
    ],
    # OpenRouter first, unlike every other agent. Groq fails this one predictably: a
    # review's findings quote code, and long strings full of quotes and newlines break
    # Groq's tool-call JSON parsing ("Failed to parse tool call arguments as JSON").
    # Measured 2026-08-14: Groq fails, OpenRouter returns findings. (A local 3B model
    # was also tried as a last rung and emitted no tool call at all — one of the
    # reasons the local fallback was dropped; see the module docstring.)
    "reviewer": [
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER, timeout=90),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO, timeout=90),
        ModelSpec(model=GROQ_GPT_OSS, timeout=60),
        ModelSpec(model=MISTRAL_MEDIUM, timeout=90),
    ],
    # Groq rung had no timeout until 2026-08-18 — every other chain already had one on
    # its cloud rungs, this one just got missed. A rung that hangs is worse than one
    # that fails: the chain cannot move on until it returns.
    # Budgets added 2026-08-19: this agent emits a whole suite in a single call, and with
    # no ceiling at all Groq truncated it mid-file — twice visibly (invalid Python) and
    # once silently, returning a file that parsed but defined zero tests. Groq counts
    # prompt + max_tokens against its 8000 TPM ceiling and this prompt carries the whole
    # app, so 3000 leaves room for it; the OpenRouter rung has no such shared budget.
    "tester": [
        ModelSpec(model=GROQ_GPT_OSS_20B, max_tokens=3000, timeout=60),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO, max_tokens=8000, timeout=90),
        ModelSpec(model=MISTRAL_MEDIUM, max_tokens=8000, timeout=90),
    ],
}


def chain_for(agent: str) -> list[ModelSpec]:
    if agent not in CHAINS:
        raise KeyError(f"No model chain registered for agent {agent!r}")
    return CHAINS[agent]
