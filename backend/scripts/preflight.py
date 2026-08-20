"""Pre-flight check: is every rung of every chain actually going to answer right now?

Run this before a demo. It asks each provider what quota is left rather than inferring
it from a test completion, so it costs (almost) nothing to run and can be repeated.

    PYTHONPATH=. python scripts/preflight.py

Run it from inside the backend container so it tests the path the pipeline actually
uses — same environment, same `.env`, same egress:

    docker compose exec backend python scripts/preflight.py

Exit code is 0 if every chain has at least one working rung, 1 otherwise — so it can gate
a script, not just inform a human.
"""

import asyncio
import os
import sys

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.llm.registry import CHAINS  # noqa: E402

GREEN, YELLOW, RED, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
OK, WARN, FAIL = f"{GREEN}ok{RESET}", f"{YELLOW}warn{RESET}", f"{RED}FAIL{RESET}"


def _model_id(spec_model: str) -> str:
    """`groq/openai/gpt-oss-120b` -> `openai/gpt-oss-120b` (strip the LiteLLM prefix)."""
    return spec_model.split("/", 1)[1]


async def check_groq() -> tuple[bool, list[str]]:
    """Groq publishes remaining quota in response headers, so one tiny completion buys
    the real numbers — the catalogue endpoint alone does not carry them."""
    lines: list[str] = []
    if not settings.groq_api_key:
        return False, [f"  {FAIL} no GROQ_API_KEY set"]

    wanted = {
        _model_id(s.model)
        for chain in CHAINS.values()
        for s in chain
        if s.model.startswith("groq/")
    }

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            listed = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            )
        except Exception as exc:  # noqa: BLE001
            return False, [f"  {FAIL} unreachable: {exc}"]

        if listed.status_code != 200:
            return False, [f"  {FAIL} /models returned {listed.status_code} — key rejected?"]

        available = {m["id"] for m in listed.json().get("data", [])}
        missing = wanted - available
        for model in sorted(wanted):
            mark = FAIL if model in missing else OK
            lines.append(
                f"  {mark} {model}{' — NOT in catalogue (retired?)' if model in missing else ''}"
            )

        # One near-empty completion, purely to read the quota headers back.
        probe = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": sorted(available & wanted)[0]
                if (available & wanted)
                else "openai/gpt-oss-20b",
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 1,
            },
        )
        h = probe.headers
        rem_req, lim_req = (
            h.get("x-ratelimit-remaining-requests"),
            h.get("x-ratelimit-limit-requests"),
        )
        rem_tok, lim_tok = h.get("x-ratelimit-remaining-tokens"), h.get("x-ratelimit-limit-tokens")
        if rem_req is not None:
            reset = h.get("x-ratelimit-reset-requests", "?")
            lines.append(f"  {DIM}requests: {rem_req}/{lim_req} left (resets in {reset}){RESET}")
        if rem_tok is not None:
            reset = h.get("x-ratelimit-reset-tokens", "?")
            tokens_left = int(rem_tok)
            mark = WARN if tokens_left < 4000 else OK
            lines.append(
                f"  {mark} tokens: {rem_tok}/{lim_tok} left this minute (resets in {reset})"
            )

    return not missing, lines


async def check_openrouter() -> tuple[bool, list[str]]:
    """The free-models-per-day cap is the one that historically ended a demo evening, and
    it is only visible on the key endpoint — a completion will not tell you."""
    lines: list[str] = []
    if not settings.openrouter_api_key:
        return False, [f"  {FAIL} no OPENROUTER_API_KEY set"]

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            )
        except Exception as exc:  # noqa: BLE001
            return False, [f"  {FAIL} unreachable: {exc}"]

        if resp.status_code != 200:
            return False, [f"  {FAIL} /auth/key returned {resp.status_code} — key rejected?"]

        data = resp.json().get("data", {})
        lines.append(f"  {OK} key valid")

        # The cap that actually ends demo evenings is free-models-per-day: 50 on a free
        # account, 1000 once ≥10 credits have ever been purchased. OpenRouter exposes no
        # counter for it — `usage_daily` is denominated in dollars and every `:free`
        # model costs $0, so it reads 0.00 right up until the 51st request 429s. Say so
        # rather than printing a reassuring number that measures something else.
        if data.get("is_free_tier"):
            lines.append(f"  {WARN} free tier: {DIM}~50 :free-model requests/day, and the")
            lines.append(f"     remaining count is not exposed by any endpoint{RESET}")
            lines.append(f"     {DIM}a full run uses 1-2 OpenRouter calls per agent that")
            lines.append(f"     falls through to it; the reviewer starts there by design{RESET}")
        else:
            lines.append(f"  {OK} paid credits present {DIM}(1000 :free requests/day){RESET}")

        # Dollar usage is still worth showing — a non-zero value means something billable
        # slipped into a chain, which would breach the $0 constraint.
        usage = data.get("usage")
        if usage:
            lines.append(f"  {WARN} ${usage} billable usage — a paid model is in a chain")
        else:
            lines.append(f"  {OK} $0 billable usage {DIM}(nothing paid in any chain){RESET}")

    return True, lines


async def main() -> int:
    print(f"\n{DIM}pre-flight — quota and reachability for every rung{RESET}\n")

    results = {}
    for name, check in (
        ("groq", check_groq),
        ("openrouter", check_openrouter),
    ):
        healthy, lines = await check()
        results[name] = healthy
        print(f"{name}")
        for line in lines:
            print(line)
        print()

    # A chain is safe if any rung's provider is up — that is the whole point of chains.
    print(f"{DIM}per-agent chain viability{RESET}")
    all_ok = True
    for agent, chain in CHAINS.items():
        providers = [s.model.split("/", 1)[0] for s in chain]
        live = [p for p in providers if results.get(p)]
        if not live:
            print(f"  {FAIL} {agent}: no working rung — this agent cannot run")
            all_ok = False
        elif not results.get(providers[0]):
            print(f"  {WARN} {agent}: primary ({providers[0]}) down, falls back to {live[0]}")
        else:
            print(f"  {OK} {agent}: {len(live)}/{len(providers)} rungs live")

    print()
    if all_ok:
        print(f"{GREEN}Every agent has a working rung.{RESET}")
    else:
        print(f"{RED}At least one agent has no working rung — a run will fail.{RESET}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
