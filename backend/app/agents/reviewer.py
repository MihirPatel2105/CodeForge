from app.agents.base import BaseAgent
from app.llm.client import LLMResult
from app.prompts import reviewer as prompt
from app.schemas.agents import Design, GeneratedFile, ReviewResult


def describe_endpoints(design: Design) -> str:
    return "\n".join(
        f"- {e.method} {e.path} -> {e.response_model} ({e.status_code})" for e in design.endpoints
    )


def render_files(files: list[GeneratedFile]) -> str:
    return "\n\n".join(f"### {f.path}\n```python\n{f.content}\n```" for f in files)


class ReviewerAgent(BaseAgent):
    name = "reviewer"
    output_schema = ReviewResult
    system = prompt.SYSTEM
    template_version = prompt.VERSION

    async def run(self, state: dict) -> LLMResult:
        design: Design = state["design"]
        files: list[GeneratedFile] = state.get("files") or []
        return await self.call(
            prompt.render(
                endpoints=describe_endpoints(design),
                files=render_files(files),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
            temperature=0.0,  # a review should be reproducible, not creative
        )
