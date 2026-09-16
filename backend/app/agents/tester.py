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
        # Endpoint tests need the request/response contracts and route behavior. The
        # database connection and document internals add tokens without changing an
        # HTTP assertion, and can push a whole-suite response over Groq's TPM budget.
        test_context = [f for f in files if f.path in {"schemas.py", "main.py"}] or files
        return await self.call(
            prompt.render(
                endpoints=describe_endpoints(design),
                files=render_files(test_context),
            ),
            run_id=state["run_id"],
            iteration=state.get("loop_count", 0),
        )
