from app.agents.base import BaseAgent
from app.agents.revisions import revision_guidance
from app.llm.client import LLMResult
from app.prompts import pm as prompt
from app.schemas.agents import Requirements


class PMAgent(BaseAgent):
    name = "pm"
    output_schema = Requirements
    system = prompt.SYSTEM
    template_version = prompt.VERSION

    async def run(self, state: dict) -> LLMResult:
        return await self.call(
            prompt.render(state["user_prompt"]) + "\n" + revision_guidance(state, "pm"),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )
