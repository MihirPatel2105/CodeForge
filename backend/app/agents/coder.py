from app.agents.base import BaseAgent
from app.llm.client import LLMResult
from app.prompts import coder as prompt
from app.schemas.agents import CodeOutput, Requirements, SingleFileOutput


def _describe_entities(requirements: Requirements) -> str:
    lines: list[str] = []
    for entity in requirements.entities:
        fields = ", ".join(
            f"{f.name}: {f.type}{'' if f.required else ' (optional)'}" for f in entity.fields
        )
        lines.append(f"- {entity.name}: {fields}")
    return "\n".join(lines)


class CoderAgent(BaseAgent):
    name = "coder"
    output_schema = CodeOutput
    system = prompt.SYSTEM
    template_version = prompt.VERSION

    async def run(self, state: dict) -> LLMResult:
        requirements: Requirements = state["requirements"]
        return await self.call(
            prompt.render(
                project_name=requirements.project_name,
                summary=requirements.summary,
                entities=_describe_entities(requirements),
                operations=", ".join(requirements.operations),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )


class SingleFileCoderAgent(CoderAgent):
    """Emits one file per call via a flat schema.

    Free-tier models fail often enough on nested `list[GeneratedFile]` tool calls that a
    multi-file response is not dependable; see `SingleFileOutput`. Phase 4 should call
    this once per file in the Design rather than asking for the whole tree at once —
    which also keeps each request under Groq's 8000 TPM ceiling.
    """

    output_schema = SingleFileOutput
