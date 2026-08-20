# STATE_AND_API.md — State Schema, REST & SSE Contract

---

## 1. `RunState` — the project's spine

Lives in `backend/app/graph/state.py`. Every agent reads and writes it. Changing it later is
expensive, so it is designed once in Phase 2 and touched rarely.

```python
class RunState(TypedDict, total=False):
    # identity
    run_id: str
    project_id: str
    user_id: str
    thread_id: str                       # LangGraph checkpointer thread

    # input
    user_prompt: str

    # phase outputs
    requirements: Requirements | None
    design: Design | None
    files: list[GeneratedFile]           # current code tree (overwritten each fix pass)
    test_files: list[GeneratedFile]
    review: ReviewResult | None
    tests: TestResult | None
    sandbox: SandboxResult | None

    # loop control
    loop_count: int                      # total fix passes so far, either trigger
    max_loops: int                       # default 3 — applies to each phase independently
    loop_history: list[LoopRecord]       # iteration, trigger, findings, outcome
    # Reviewer and Sandbox each get their own MAX_LOOPS, counted from loop_history's
    # `trigger` field (app/graph/routing.py:loop_count_for) — a slow-to-converge review
    # can no longer spend the Sandbox's budget before it gets a single attempt.

    # human-in-the-loop
    awaiting_approval: str | None        # "pm" | "architect" | None
    approvals: dict[str, ApprovalRecord] # phase -> {approved, note, at}

    # meta
    status: RunStatus
    current_agent: str | None
    prompt_versions: dict[str, str]      # agent -> template version
    rag_enabled: bool
    errors: list[RunError]
    started_at: datetime
    finished_at: datetime | None
```

```python
RunStatus = Literal[
    "queued", "running",
    "awaiting_approval",
    "succeeded",
    "failed_max_loops",      # loop cap hit — partial result kept
    "failed_sandbox",        # container/runtime failure
    "failed_llm",            # all providers exhausted
    "rejected",              # human rejected at a checkpoint
    "cancelled",
]
```

Rules
- `files` always holds the **current** tree. History goes to `loop_history`, not to `files`.
- Nothing is deleted from state on failure — a partial run is a reportable result.
- No raw LLM text is stored in state. Only validated schema objects.

---

## 2. Mongo collections (Beanie Documents)

| Collection | Key fields |
|---|---|
| `users` | `email` (unique index), `hashed_password`, `created_at` |
| `projects` | `user_id`, `name`, `description`, `created_at` |
| `runs` | `project_id`, `user_id`, `prompt`, `status`, `state` (RunState snapshot), `metrics`, timestamps |
| `checkpoints` | managed by LangGraph `MongoDBSaver` — do not hand-edit |
| GridFS `artifacts` | zipped file tree, sandbox logs, pytest report, keyed by `run_id` |

Indexes: `users.email` unique; `runs.project_id`; `runs.status`; `runs.created_at` desc.

---

## 3. REST API

Auth header: `Authorization: Bearer <jwt>` on everything except `/health` and `/auth/*`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/auth/register` | create user → JWT |
| POST | `/auth/login` | JWT |
| GET | `/auth/me` | current user |
| POST | `/projects` | create project |
| GET | `/projects` | list user's projects |
| GET | `/projects/{id}` | project detail |
| POST | `/runs` | start a run — body: `{project_id, prompt, rag_enabled?}` → `{run_id}` |
| GET | `/runs/{id}` | full run state snapshot |
| GET | `/runs/{id}/stream` | **SSE** live events |
| POST | `/runs/{id}/approve` | body: `{phase, approved: bool, note?}` — resumes or rejects |
| POST | `/runs/{id}/cancel` | cancel a running graph |
| GET | `/runs/{id}/files` | current generated file tree |
| GET | `/runs/{id}/artifacts` | GridFS zip download |
| GET | `/projects/{id}/runs` | run history |

Conventions
- Errors: `{"error": {"code": "...", "message": "...", "run_id": "..."}}`, correct HTTP status.
- `POST /runs` returns immediately (202) and executes the graph in the background — the client
  then attaches to the SSE stream. Never block the HTTP request on a full run.

---

## 4. SSE event contract

`GET /runs/{id}/stream`, `text/event-stream`. Every event carries a monotonic `id` so the client
can reconnect with `Last-Event-ID` and replay.

```
event: run.started
data: {"run_id":"...","prompt":"...","at":"..."}

event: agent.started
data: {"agent":"pm","iteration":0}

event: agent.message
data: {"agent":"pm","text":"Identified entity: Book (title, author, year)"}

event: agent.completed
data: {"agent":"pm","output_summary":{...},"duration_ms":4120}

event: approval.required
data: {"phase":"architect","payload":{...}}

event: approval.resolved
data: {"phase":"architect","approved":true,"note":null}

event: loop.iteration
data: {"iteration":1,"trigger":"reviewer","blocking_findings":2}

event: file.written
data: {"path":"main.py","bytes":2318}

event: sandbox.started
data: {"image":"codeforge-sandbox:latest"}

event: sandbox.output
data: {"stream":"stdout","chunk":"..."}

event: tests.result
data: {"passed":false,"total":8,"failed":2}

event: run.completed
data: {"status":"succeeded","iterations":2,"duration_ms":91240}

event: run.failed
data: {"status":"failed_max_loops","reason":"..."}
```

Rules
- Events are emitted **only** through `events/bus.py`. Agents and the sandbox never format SSE
  payloads themselves.
- Every event is also appended to the run document, so a page refresh can rebuild the timeline.
- Heartbeat comment every 15s to keep proxies from closing the connection.

---

## 5. Sandbox contract

```python
class SandboxRequest(BaseModel):
    run_id: str
    files: list[GeneratedFile]       # app code + tests
    timeout_s: int = 120

class SandboxResult(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    pytest_report: dict | None
    timed_out: bool
    duration_ms: int
```

Container rules
- Image is **pre-baked** with fastapi, uvicorn, beanie, pymongo, pytest, httpx and `mongod` —
  `network_mode="none"` means nothing can be installed at run time.
- Limits: `network_mode="none"`, `mem_limit="512m"`, `nano_cpus` capped, read-only mount for
  source, no host paths beyond the run's temp dir.
- `mongod` starts inside the container; the generated app connects to `mongodb://localhost:27017`.
- Hard timeout, then `container.kill()`.
- **Always** `container.remove(force=True)` in `finally`.
- stdout/stderr streamed out as `sandbox.output` events while running, not only at the end.

---

## 6. Metrics recorded per run

Written to `runs.metrics` at completion; the evaluation harness aggregates these.

```python
class RunMetrics(BaseModel):
    generation_succeeded: bool
    tests_passed: bool
    test_pass_ratio: float           # passed / total
    iterations: int
    blocking_findings_total: int
    findings_fixed: int              # review-loop effectiveness
    rag_enabled: bool
    llm_calls: int
    tokens_total: int
    provider_fallbacks: int          # how often a 429 forced a switch
    end_to_end_ms: int
    failure_category: str | None     # schema | objectid | timeout | quota | loop_exhausted | other
```
