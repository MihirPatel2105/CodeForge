from app.agents.base import BaseAgent
from app.llm.client import LLMResult
from app.prompts import coder as prompt
from app.rag import context_for
from app.schemas.agents import CodeOutput, Requirements, SingleFileOutput


def describe_entities(requirements: Requirements) -> str:
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
                entities=describe_entities(requirements),
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

    async def run_file(self, state: dict, spec) -> LLMResult:
        """Generate one file of the Design.

        Called once per `Design.files` entry. Splitting the tree across calls is what
        keeps each request inside Groq's 8000 TPM ceiling and avoids the nested
        tool-call failures a whole-tree request provokes.
        """
        from app.agents.reviewer import describe_endpoints

        requirements: Requirements = state["requirements"]
        design = state["design"]

        return await self.call(
            prompt.render_file(
                path=spec.path,
                purpose=spec.purpose or "part of the application",
                project_name=requirements.project_name,
                summary=requirements.summary,
                entities=describe_entities(requirements),
                endpoints=describe_endpoints(design),
                file_list=", ".join(f.path for f in design.files),
                reference=context_for(
                    f"{spec.path} {spec.purpose} {requirements.summary}",
                    enabled=state.get("rag_enabled", False),
                ),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )

    async def run_fix(self, state: dict, path: str, current: str, problems: str) -> LLMResult:
        """Regenerate one file to address specific problems."""
        return await self.call(
            prompt.render_fix(
                path=path,
                current=current,
                problems=problems,
                # The problem text is the best possible query: it describes exactly what
                # went wrong, which is what the snippets are indexed against.
                reference=context_for(problems, enabled=state.get("rag_enabled", False)),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )
