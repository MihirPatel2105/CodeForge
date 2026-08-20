"""Pinned model chains — the only place a model name appears.

Never hardcode a model string in an agent (CLAUDE.md §5). Changing routing means editing
this file and nothing else.

Every id below was probed against the live provider APIs on 2026-08-13; see
`scripts/probe_models.py` to re-verify after a provider changes its catalogue.

Deviation from CLAUDE.md §5 as originally written: the Coder was specified as
Cerebras-primary for its token headroom, but Cerebras' free tier now returns
"Payment required" for every model in the account catalogue, which conflicts with the
$0 constraint. Groq is primary for all agents, with OpenRouter `:free` as the cloud
fallback and a local model as last resort.
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

OLLAMA_LOCAL = "ollama/qwen2.5:3b"
# The backend runs inside the compose network, where "localhost" means the container
# itself, not the host running Ollama. Docker Desktop's host-side DNS name reaches it
# instead. Discovered 2026-08-18: this made the local fallback — the rung every chain is
# supposed to end at, the one meant to answer when every free tier is down at once —
# unreachable, so a bad cloud-provider moment failed runs outright instead of degrading.
OLLAMA_API_BASE = "http://host.docker.internal:11434"


class ModelSpec(BaseModel):
    """One rung of a fallback chain."""

    model: str
    # Extra kwargs LiteLLM needs for this model; Ollama requires an explicit api_base.
    extra: dict = {}

    # Groq reserves `prompt + max_tokens` against its 8000 TPM budget, so an inflated
    # ceiling throttles throughput even when the reply is short. Keep these tight.
    max_tokens: int | None = None

    # A rung that hangs is worse than one that fails: the chain cannot move on until it
    # returns. Measured 2026-08-14: an OpenRouter rung burned 180s before timing out,
    # which was 29% of a whole run.
    timeout: int | None = None


def _ollama(max_tokens: int | None = None, timeout: int = 120) -> ModelSpec:
    # Every cloud rung in every chain has an explicit timeout except this one — the rung
    # every chain falls back to last, the one meant to always answer. Confirmed live
    # 2026-08-18: with connectivity fixed (see OLLAMA_API_BASE above) a Tester call
    # reached this rung and then sat for 10+ minutes with no bound at all, needing a
    # manual cancel. 120s is generous for a 3B local model's slowest realistic case.
    return ModelSpec(
        model=OLLAMA_LOCAL,
        extra={"api_base": OLLAMA_API_BASE},
        max_tokens=max_tokens,
        timeout=timeout,
    )


# --- per-agent chains, tried in order -------------------------------------- #

CHAINS: dict[str, list[ModelSpec]] = {
    "pm": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=GROQ_GPT_OSS_20B),
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER),
        _ollama(),
    ],
    "architect": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER),
        _ollama(),
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
        _ollama(max_tokens=4000),
    ],
    # OpenRouter first, unlike every other agent. Groq fails this one predictably: a
    # review's findings quote code, and long strings full of quotes and newlines break
    # Groq's tool-call JSON parsing ("Failed to parse tool call arguments as JSON").
    # Measured 2026-08-14: Groq fails, OpenRouter returns findings, local 3B emits no
    # tool call at all.
    "reviewer": [
        ModelSpec(model=OPENROUTER_NEMOTRON_SUPER, timeout=90),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO, timeout=90),
        ModelSpec(model=GROQ_GPT_OSS, timeout=60),
        _ollama(),
    ],
    # Groq rung had no timeout until 2026-08-18 (see `_ollama`'s comment for the fuller
    # story of that live-run diagnosis) — every other chain already had one on its cloud
    # rungs, this one just got missed.
    # Budgets added 2026-08-19: this agent emits a whole suite in a single call, and with
    # no ceiling at all Groq truncated it mid-file — twice visibly (invalid Python) and
    # once silently, returning a file that parsed but defined zero tests. Groq counts
    # prompt + max_tokens against its 8000 TPM ceiling and this prompt carries the whole
    # app, so 3000 leaves room for it; the OpenRouter rung has no such shared budget.
    "tester": [
        ModelSpec(model=GROQ_GPT_OSS_20B, max_tokens=3000, timeout=60),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO, max_tokens=8000, timeout=90),
        _ollama(max_tokens=4000),
    ],
}


def chain_for(agent: str) -> list[ModelSpec]:
    if agent not in CHAINS:
        raise KeyError(f"No model chain registered for agent {agent!r}")
    return CHAINS[agent]
