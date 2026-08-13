from app.agents.base import BaseAgent
from app.agents.coder import describe_entities
from app.llm.client import LLMResult
from app.prompts import architect as prompt
from app.schemas.agents import Design, Requirements


class ArchitectAgent(BaseAgent):
    name = "architect"
    output_schema = Design
    system = prompt.SYSTEM
    template_version = prompt.VERSION

    async def run(self, state: dict) -> LLMResult:
        requirements: Requirements = state["requirements"]
        return await self.call(
            prompt.render(
                project_name=requirements.project_name,
                summary=requirements.summary,
                entities=describe_entities(requirements),
                operations=", ".join(requirements.operations),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )
