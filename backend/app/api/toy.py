"""Phase 3 two-agent toy: PM -> Coder, linear, no graph and no cycles.

TEMPORARY. Phase 4 replaces this with the LangGraph pipeline and `POST /runs` executing
in the background. It exists to prove the whole chain works end to end — auth, CRUD,
prompts, the LLM client's fallback, structured output and Langfuse tracing — before the
orchestrator is introduced.

Unlike `POST /runs`, this endpoint runs synchronously so a single curl shows the result
(the Phase 3 Definition of Done).
"""

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.agents import PMAgent, SingleFileCoderAgent
from app.core.deps import CurrentUser, get_owned
from app.graph.state import new_run_state
from app.models import Project, Run
from app.schemas.agents import GeneratedFile, Requirements, SingleFileOutput
from app.schemas.api import RunCreate

router = APIRouter(tags=["toy"])


class ToyResponse(BaseModel):
    run_id: str
    requirements: Requirements
    files: list[GeneratedFile]
    models_used: dict[str, str]
    provider_fallbacks: int
    duration_ms: int


@router.post("/toy/run", response_model=ToyResponse)
async def toy_run(payload: RunCreate, user: CurrentUser) -> ToyResponse:
    await get_owned(Project, payload.project_id, str(user.id), "Project")
    started = datetime.now()

    run = Run(
        project_id=payload.project_id,
        user_id=str(user.id),
        prompt=payload.prompt,
        status="running",
    )
    await run.insert()
    run_id = str(run.id)

    state = new_run_state(
        run_id=run_id,
        project_id=payload.project_id,
        user_id=str(user.id),
        thread_id=run_id,
        user_prompt=payload.prompt,
        rag_enabled=payload.rag_enabled,
    )

    pm, coder = PMAgent(), SingleFileCoderAgent()

    pm_result = await pm.run(state)
    requirements: Requirements = pm_result.value
    state["requirements"] = requirements

    code_result = await coder.run(state)
    single: SingleFileOutput = code_result.value
    files = [single.as_generated_file()]

    duration_ms = int((datetime.now() - started).total_seconds() * 1000)
    fallbacks = pm_result.fallbacks + code_result.fallbacks

    run.status = "succeeded"
    run.updated_at = datetime.now()
    run.state = {
        "run_id": run_id,
        "user_prompt": payload.prompt,
        "requirements": requirements.model_dump(mode="json"),
        "files": [f.model_dump() for f in files],
        "loop_count": 0,
        "prompt_versions": {"pm": pm.template_version, "coder": coder.template_version},
        "rag_enabled": payload.rag_enabled,
    }
    await run.save()

    return ToyResponse(
        run_id=run_id,
        requirements=requirements,
        files=files,
        models_used={"pm": pm_result.model, "coder": code_result.model},
        provider_fallbacks=fallbacks,
        duration_ms=duration_ms,
    )
