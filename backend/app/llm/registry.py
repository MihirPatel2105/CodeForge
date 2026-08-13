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
GROQ_LLAMA_70B = "groq/llama-3.3-70b-versatile"

OPENROUTER_NEMOTRON_SUPER = "openrouter/nvidia/nemotron-3-super-120b-a12b:free"
OPENROUTER_NEMOTRON_NANO = "openrouter/nvidia/nemotron-3-nano-30b-a3b:free"
OPENROUTER_NORTH_CODE = "openrouter/cohere/north-mini-code:free"

OLLAMA_LOCAL = "ollama/qwen2.5:3b"
OLLAMA_API_BASE = "http://localhost:11434"


class ModelSpec(BaseModel):
    """One rung of a fallback chain."""

    model: str
    # Extra kwargs LiteLLM needs for this model; Ollama requires an explicit api_base.
    extra: dict = {}
    max_tokens: int | None = None


def _ollama(max_tokens: int | None = None) -> ModelSpec:
    return ModelSpec(model=OLLAMA_LOCAL, extra={"api_base": OLLAMA_API_BASE}, max_tokens=max_tokens)


# --- per-agent chains, tried in order -------------------------------------- #

CHAINS: dict[str, list[ModelSpec]] = {
    "pm": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=GROQ_LLAMA_70B),
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
    "coder": [
        ModelSpec(model=GROQ_GPT_OSS, max_tokens=8000),
        ModelSpec(model=OPENROUTER_NORTH_CODE, max_tokens=8000),
        _ollama(max_tokens=4000),
    ],
    "reviewer": [
        ModelSpec(model=GROQ_GPT_OSS),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO),
        _ollama(),
    ],
    "tester": [
        ModelSpec(model=GROQ_LLAMA_70B),
        ModelSpec(model=OPENROUTER_NEMOTRON_NANO),
        _ollama(),
    ],
}


def chain_for(agent: str) -> list[ModelSpec]:
    if agent not in CHAINS:
        raise KeyError(f"No model chain registered for agent {agent!r}")
    return CHAINS[agent]
