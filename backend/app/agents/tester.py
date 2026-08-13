from app.agents.base import BaseAgent
from app.agents.reviewer import describe_endpoints, render_files
from app.llm.client import LLMResult
from app.prompts import tester as prompt
from app.schemas.agents import Design, GeneratedFile, SingleFileOutput


class TesterAgent(BaseAgent):
    """Writes test_main.py.

    Uses the flat `SingleFileOutput` for the same reason as the Coder: free-tier models
    are unreliable at filling a nested `files[]` array in a tool call, and the suite is
    a single file anyway.
    """

    name = "tester"
    output_schema = SingleFileOutput
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
        )
