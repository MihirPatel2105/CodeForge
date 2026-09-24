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
| `admin_audit_logs` | admin identity, action, target, required reason, action details, timestamp |
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
| POST | `/auth/login` | JWT, or a five-minute password-verification ticket with available methods |
| POST | `/auth/login/complete` | exchange the password ticket and authenticator code for a JWT |
| GET | `/auth/me` | current user |
| GET | `/auth/devices` | active browser sessions grouped by device |
| POST | `/auth/devices/{id}/sign-out` | revoke all current tokens for one owned device |
| POST | `/auth/sign-in-alert/respond` | one-time email response: `me` or `not_me`; the latter revokes all sessions |
| GET/POST | `/auth/passkeys` | list passkeys; registration options/verify and password-confirmed deletion |
| POST | `/auth/passkeys/login/options` | issue a five-minute discoverable-credential challenge |
| POST | `/auth/passkeys/login/verify` | verify a user-verified passkey assertion and issue a JWT |
| POST | `/auth/passkeys/mfa/options` | create a user-bound passkey challenge for a password-verification ticket |
| POST | `/auth/passkeys/mfa/verify` | exchange the password ticket and a user-verified passkey assertion for a JWT |
| POST | `/projects` | create project |
| GET | `/projects` | list user's projects |
| GET | `/projects/{id}` | project detail |
| POST | `/runs` | start a run — body: `{project_id, prompt, rag_enabled?}` → `{run_id}` |
| GET | `/runs/{id}` | full run state snapshot |
| GET | `/runs/{id}/stream` | **SSE** live events |
| POST | `/runs/{id}/approve` | body: `{phase, approved: bool, note?}` — resumes or rejects |
| POST | `/runs/{id}/cancel` | cancel a running graph |
| GET | `/runs/{id}/files` | current generated file tree |
| GET | `/runs/{id}/file-history` | archived per-iteration versions for the Diff panel; owner-only |
| GET | `/runs/{id}/artifacts` | GridFS zip download |
| GET | `/runs/{id}/preview` | Start or reuse a private temporary sandbox and list generated API endpoints |
| POST | `/runs/{id}/preview/request` | Send `{method, path, body?}` to the generated API inside that sandbox; return its HTTP status and body |
| DELETE | `/runs/{id}/preview` | Remove the preview and its temporary data |
| POST | `/runs/{id}/deployment` | Publish a passed run; return stable URL and API key once |
| GET | `/runs/{id}/deployment` | Read publication status and URL without revealing the key |
| POST | `/runs/{id}/deployment/rotate-key` | Replace the key and return the new key once |
| DELETE | `/runs/{id}/deployment` | Unpublish and delete the generated API's hosted data |
| GET/POST/PUT/PATCH/DELETE | `/api/v1/deployments/{id}/{path}` | API-key protected gateway to the generated app |
| GET | `/projects/{id}/runs` | run history |
| GET | `/admin/overview` | admin-only platform totals and recent runs |
| GET | `/admin/runs` | paginated cross-user run inventory; status, prompt, RAG, acceptance, failure, and date filters |
| GET | `/admin/runs/export.csv` | export up to 5,000 filtered-period run records |
| GET | `/admin/runs/{id}` | admin-only run state and durable event replay |
| POST | `/admin/runs/{id}/cancel` | audited cancellation; body: `{reason}` |
| POST | `/admin/runs/{id}/retry` | start an audited new run from a terminal run |
| GET | `/admin/runs/{id}/artifacts` | list generated code, logs, and test reports |
| GET | `/admin/runs/{id}/artifacts/{file_id}` | authenticated admin artifact download |
| GET | `/admin/users` | paginated user inventory with search and date filters; matching administrator is pinned first on page one |
| GET | `/admin/users/export.csv` | export up to 5,000 user records |
| GET | `/admin/users/{id}` | account, project, and recent-run support view |
| POST | `/admin/users/{id}/revoke-sessions` | revoke every user JWT generation; body: `{reason}` |
| POST | `/admin/users/{id}/suspend` | suspend login and revoke all sessions |
| POST | `/admin/users/{id}/restore` | restore a suspended account |
| POST | `/admin/users/{id}/verify-email` | manually mark an address verified |
| POST | `/admin/users/{id}/limits` | set project and monthly-run limits |
| POST | `/admin/users/{id}/delete` | permanently delete a non-admin user and all owned data; requires admin password, typed confirmation, and reason |
| GET | `/admin/quality` | persisted RunMetrics scorecard, breakdowns, and RAG comparison |
| GET | `/admin/system-health` | live internal checks and passive provider observations |
| GET | `/admin/monitoring` | historical volume, alerts, storage, tokens, and free-provider cost totals |
| GET | `/admin/audit-log` | paginated and filterable history of sensitive admin actions |
| GET | `/admin/audit-log/export.csv` | export the durable audit record |

Conventions
- Errors: `{"error": {"code": "...", "message": "...", "run_id": "..."}}`, correct HTTP status.
- `POST /runs` returns immediately (202) and executes the graph in the background — the client
  then attaches to the SSE stream. Never block the HTTP request on a full run.
- Try API is owner-only and available only for succeeded runs with passing sandbox tests.
  Its Docker container has no network or published port, shares no database with the platform,
  and expires after 15 minutes. It is an in-app preview, not a deployed API URL.
- Published APIs use the platform backend as their public gateway. The generated app remains in
  a network-isolated Docker container with a named MongoDB data volume. The owner may publish one
  passed run, rotate its one-time API key, or unpublish and delete the volume. The gateway accepts
  JSON requests up to 16 KB and allows 60 requests per minute per deployment.
- `/admin/*` fails closed unless the authenticated account's email matches `ADMIN_EMAIL`.
  Every sensitive mutation requires a reason and writes an `admin_audit_logs` record.
- Every account supports encrypted TOTP secrets; sign-in also has persistent password-attempt lockouts.
  Optional passkeys require user verification. Enrollment/removal requires the current password
  and TOTP if enabled. After a correct password, accounts with TOTP and/or passkeys receive a
  five-minute ticket and may verify with either enrolled method; authenticator-code attempts are
  limited per ticket. Direct user-verified passkey sign-in issues a session without another code.
  Password sign-in and recovery remain available. Challenges and tickets are single-use.
  A password reset or "not me" sign-in response removes passkeys so an unrecognized credential
  cannot reopen a recovered account.
  TOTP setup returns both a manual Base32 key and an `otpauth://` provisioning URI; the
  dedicated account-security screen renders the URI as a QR code while keeping manual entry available.
- Browser sessions carry a separate device identifier; new browsers receive a sign-in email when SMTP is configured.
  The alert link is single-use and expires after 24 hours. Its review page requires a POST confirmation;
  opening the email link cannot revoke sessions. Browser and platform labels come from User-Agent and
  IP is the direct peer address, so neither represents a verified physical device or location.
- Suspended accounts are rejected centrally by the authentication dependency. Project and
  monthly-run limits are enforced at creation time, not only displayed in the admin UI.

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
    acceptance_level: str            # L0–L5, scored against the final file tree
    exclusion_reason: str | None     # infrastructure | quota_before_completion | cancelled | rejected
    prompt_id: str | None            # frozen evaluation prompt id, when applicable
    failure_category: str | None     # schema | objectid | timeout | quota | loop_exhausted | other
```

Acceptance scoring follows `docs/ACCEPTANCE.md`. The sandbox boot probe imports the generated
FastAPI app and calls one designed endpoint before pytest; its marker establishes L3 even when
tests fail. Excluded attempts remain in the JSON/CSV report but do not enter success-rate
denominators. The evaluator checks a fingerprint of the backend and sandbox implementation before
resuming, so RAG arms from different versions cannot be combined accidentally.
