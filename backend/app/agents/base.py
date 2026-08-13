"""Agent contract — see `docs/AGENTS.md` §1.

Agents are thin: render a prompt, call the LLM through the one client, return a validated
object. They never touch Docker, Mongo or the event bus.
"""

from typing import Any

from pydantic import BaseModel

from app.llm.client import LLMResult, structured


class BaseAgent:
    name: str
    output_schema: type[BaseModel]
    system: str
    template_version: str

    async def call(
        self, prompt: str, *, run_id: str, iteration: int = 0, temperature: float = 0.2
    ) -> LLMResult:
        """Run `prompt` down this agent's chain. The chain comes from the registry keyed
        by `self.name`, so an agent never names a model."""
        return await structured(
            prompt=prompt,
            schema=self.output_schema,
            agent=self.name,
            system=self.system,
            temperature=temperature,
            trace={"run_id": run_id, "agent": self.name, "iteration": iteration},
        )

    async def run(self, state: dict[str, Any]) -> LLMResult:  # pragma: no cover - interface
        raise NotImplementedError
