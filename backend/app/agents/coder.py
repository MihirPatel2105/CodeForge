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
    """Asks for the whole file tree in one call, as `CodeOutput`.

    Works, but not on the first rung of its chain: Groq validates tool-call arguments
    server-side and its models repeatedly emit `name` instead of `path` inside the nested
    `files[]` array, so Groq rejects the call and the chain falls through. Observed
    succeeding on `openrouter/cohere/north-mini-code:free`.

    The practical cost is a wasted Groq attempt — latency and free-tier quota — on every
    generation, not a failure. Prefer `SingleFileCoderAgent` unless you specifically need
    a whole tree from one call.
    """

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
    """Emits one file per call via a flat schema. **The preferred path.**

    Two problems disappear at once: the flat schema avoids the nested tool-call
    rejection described on `CoderAgent`, and one file per request stays under Groq's
    8000 TPM ceiling, which a whole-tree request breaches.

    Phase 4 should call this once per file in the Design and assemble the tree in state.
    """

    output_schema = SingleFileOutput
