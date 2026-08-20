# PHASES.md — CodeForge SDLC Build Plan

The project is built the way it works: phase by phase, each phase gated by a **Definition of Done
(DoD)**. Do not start a phase until the previous phase's DoD passes. Mark progress by checking
boxes in this file.

**Guiding rule:** a working end-to-end skeleton by end of Month 2, even if ugly. A working ugly
thing beats a beautiful half-thing at demo time.

## Classic SDLC vs CodeForge

The standard SDLC has 6 phases. CodeForge **automates phases 1–4**; deployment and maintenance are
deliberately out of scope and belong in the Future Scope chapter. Expect faculty to ask about the gap.

| Classic SDLC phase | Automated by | Status |
|---|---|---|
| 1. Requirement Analysis | PM Agent | In scope |
| 2. Design | Architect Agent | In scope |
| 3. Implementation | Coder Agent | In scope |
| — Code Review (QA gate) | Reviewer Agent | In scope — core differentiator |
| 4. Testing | Tester Agent | In scope |
| 5. Deployment | — | Out of scope — future work |
| 6. Maintenance | — | Out of scope — future work |

---

## Build phases

| Phase | SDLC stage | Target |
|---|---|---|
| 0 | Setup | Week 1 |
| 1 | Requirements | Month 1 |
| 2 | Design | Month 1 |
| 3 | Implementation A — foundation | Month 1–2 |
| 4 | Implementation B — full agent pipeline | Month 2 |
| 5 | Implementation C — sandbox execution | Month 3 |
| 6 | Implementation D — feedback loop + RAG | Month 3 |
| 7 | Implementation E — dashboard + approvals | Month 3 |
| 8 | Testing & evaluation | Month 4 |
| 9 | Deployment, docs, demo | Month 4 |

---

## Phase 0 — Environment & repo setup

**Goal:** every team member can run the same thing on their machine.

Tasks
- [x] `backend/` FastAPI skeleton, Python 3.11 venv, `requirements.txt`.
- [x] `frontend/` Next.js 15 App Router + Tailwind + shadcn/ui init.
- [x] `docker-compose.yml`: mongo, backend, langfuse.
- [x] `.env.example` with every key: `MONGO_URI`, `JWT_SECRET`, `GROQ_API_KEY`,
      `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `LANGFUSE_*`.
- [x] `GET /health` returning `{"status":"ok"}`.
- [x] Ruff config + pre-commit hook.
- [x] Free-tier accounts created for Groq, Cerebras, OpenRouter, Google AI Studio; Ollama installed
      locally with one small model pulled.
      *(all four keys in `.env`; Ollama 0.32.9 + `qwen2.5:3b`, verified through LiteLLM)*

**DoD:** `docker compose up` → backend healthy, Mongo reachable, frontend renders, one successful
LiteLLM `completion()` call logged in Langfuse.

---

## Phase 1 — Requirements

**Goal:** freeze what gets built, on paper, before any real code.

Tasks
- [x] SRS document: functional + non-functional requirements.
      *(`docs/SRS.md` — 47 FRs, 15 NFRs, 8 constraints. Team-reviewed 2026-08-13.)*
- [x] Fix the supported prompt domain: **single-entity and two-entity CRUD REST APIs only**.
      *(`docs/SRS.md` §4, with rationale)*
- [x] Write 10 canonical test prompts (books API, tasks API, notes API, contacts + groups, …).
      These become the permanent evaluation set — do not change them later or the metrics break.
      *(`backend/tests/prompts.json` — 6 single-entity, 4 two-entity)*
- [x] Define the human approval checkpoints (after PM, after Architect; final code delivery).
      *(`docs/ACCEPTANCE.md` §5)*
- [x] Define acceptance criteria for "generation succeeded".
      *(`docs/ACCEPTANCE.md` §2 — L3 boots = generation, L5 all green = tests)*

**DoD:** SRS reviewed by the team; the 10 prompts are committed to `backend/tests/prompts.json`.

---

## Phase 2 — Design

**Goal:** every contract is written down before implementation starts. Getting this right early is
the single highest-leverage thing in the project.

Tasks
- [x] **`RunState` schema** — see `docs/STATE_AND_API.md`. This is the project's spine.
      *(`backend/app/graph/state.py`)*
- [x] Pydantic I/O schema for every agent handoff (PM out → Architect in, etc.).
      *(`backend/app/schemas/agents.py`)*
- [x] LangGraph node/edge diagram including the conditional cyclic loop.
      *(`docs/AGENTS.md` §7 — Mermaid, renders on GitHub)*
- [x] REST + SSE contract frozen (paths, payloads, event names).
      *(`backend/app/schemas/api.py`, `backend/app/events/schemas.py` — 13 events, discriminated union)*
- [x] Mongo collections: `users`, `projects`, `runs`, plus GridFS bucket for artifacts.
      *(`backend/app/models/`, `backend/app/schemas/artifacts.py` — indexes and GridFS round-trip verified)*
- [x] Sandbox contract: input (file tree) → output (stdout, stderr, exit code, test report).
      *(`backend/app/schemas/sandbox.py`)*
- [x] Generated-app file-structure template the Architect must target
      (`main.py`, `models.py`, `database.py`, `schemas.py`, `test_main.py`).
      *(`docs/GENERATED_APP.md` — reference code executed and verified, not just written)*

**DoD:** all schemas exist as real Pydantic classes and import cleanly, even with empty logic
behind them. Frontend and backend owners have both signed off on the API contract.
*(Met 2026-08-13. Contract signed off by the frontend and backend owners; TypeScript types and
a replayable mock run live in `frontend/lib/`.)*

---

## Phase 3 — Implementation A: foundation

**Goal:** the platform exists, minus the intelligence.

Tasks
- [x] Auth: register/login, JWT issue + verify, `get_current_user` dependency (~60 lines total).
- [x] Beanie models + DB init on startup.
- [x] CRUD: `POST/GET /projects`, `POST/GET /runs`.
- [x] `llm/client.py`: LiteLLM wrapper, model registry, retry + provider fallback on 429.
- [x] Instructor integration — one function that takes a prompt + Pydantic schema and returns a
      validated object, retrying on malformed output.
- [x] Langfuse tracing wired into that one function.
- [x] **Two-agent toy:** PM → Coder, text only, no graph cycles. Prints requirements + a single
      Python file to the console.
      *(`POST /toy/run` — temporary, removed when the graph lands in Phase 4)*

**DoD:** a curl request creates a run and returns PM output + one generated file, and the whole
call chain is visible in Langfuse. Provider fallback verified by deliberately using a dead key.

---

## Phase 4 — Implementation B: full agent pipeline

**Goal:** all five agents running through LangGraph, text-only, no execution yet.

Tasks
- [x] LangGraph `StateGraph` over `RunState`, `MongoDBSaver` checkpointer attached.
- [x] Nodes: `pm` → `architect` → `coder` → `reviewer` → `tester` (linear first, cycles next).
- [x] Each agent: dedicated prompt template, Pydantic output schema, model chain from registry.
- [x] Coder writes a **multi-file tree** into state, not one blob.
      *(one LLM call per file — a whole-tree call breaches Groq's TPM ceiling and provokes
      nested tool-call rejections)*
- [x] Reviewer emits structured findings (`severity`, `file`, `line`, `issue`, `fix_hint`) —
      not prose.
- [x] Tester writes `test_main.py` targeting the generated endpoints.
- [x] Run persisted to Mongo at every node transition; run is resumable after a crash.

**DoD:** all 10 canonical prompts produce a complete file tree + tests as text. Nothing executes
yet. Kill the process mid-run and resume it from the checkpoint successfully.
*(Met 2026-08-14. 10/10 prompts produced a full 4-file tree plus tests; 8/10 drew at least one
blocking review finding. Crash-resume verified twice with SIGKILL, recovering at `coder` and at
`tester`. Approval interrupts exercised end to end: the graph pauses after PM and after
Architect, and writes nothing until resumed (`tests/test_approvals_live.py`). The Phase 3
`/toy/run` endpoint has been removed. Median run ~300s after tuning, down from ~987s.*

*Not guaranteed per-run: free-tier variance means an individual run can still lose a file or a
review. Phase 8's repetitions turn that into a measured rate.)*

---

## Phase 5 — Implementation C: sandbox execution

**Goal:** generated code actually runs.

Tasks
- [x] Pre-baked sandbox Docker image: fastapi, uvicorn, beanie, pymongo, pytest, httpx, and
      `mongod` (no network at run time, so nothing installs later).
      *(`sandbox/Dockerfile` — built on `mongo:8` + Python 3.12, not `python:3.11-slim`:
      MongoDB ships no arm64 server for Debian. See `docs/GENERATED_APP.md` §6.)*
- [x] `sandbox/runner.py`: write file tree to a temp dir → mount → run container with
      `network_mode="none"`, CPU/memory limits, and a hard timeout.
      *(files are copied in via `put_archive`, so no host path is exposed at all)*
- [x] Start `mongod` inside the container, then run pytest; capture stdout, stderr, exit code, and
      the pytest report.
      *(`app/sandbox/report.py` parses pytest output into `TestResult`; exit 2-5 means the
      suite never ran and is not reported as "0 failures")*
- [x] Force-remove the container in `finally`. No leaks.
      *(verified: `docker ps -a` clean after passing, failing, and timed-out runs)*
- [x] Artifacts (file tree zip + logs) stored in GridFS, downloadable by run id.
      *(`app/db/artifacts.py`, `GET /runs/{id}/artifacts` and `/artifacts/{file_id}`)*

**DoD:** the books-API prompt goes prompt → generated code → container run → real pytest output,
and `docker ps -a` is clean afterwards. Container is killed correctly on timeout and on an
infinite-loop test case.
*(Met 2026-08-14. Books prompt ran end to end in 34s: 4 files generated, tests written, executed
in the sandbox, real pytest output captured, three artifacts stored in GridFS, no containers
leaked. Timeout and infinite-loop kills, the absence of network access, and mongod availability
are covered by `tests/test_sandbox_live.py`.*

*What execution revealed: the generated app failed to run — `SyntaxError: 'await' outside async
function`. Complete-looking, reviewed, tested code that does not parse is exactly what Phase 4's
text-only DoD could not detect, and exactly what the Phase 6 loop exists to fix. Across 3 stored
trees re-executed, 1 reached the test stage (11/16 passing) and 2 failed at import. Reporting a
broken app honestly is Phase 5 working, not failing.)*

---

## Phase 6 — Implementation D: the feedback loop + RAG

**Goal:** the project's core differentiator. Highest risk — give it the most time.

Tasks
- [x] Conditional edges: `reviewer → coder` when blocking findings exist; `tester → coder` when
      tests fail; `→ done` when both pass.
      *(`app/graph/routing.py`; demonstrated live — 0/2 tests → fix pass → 7/7 passing)*
- [x] Loop counter in state, `MAX_LOOPS = 3`, then fail gracefully with a partial result and a
      clear reason — never crash, never loop forever.
      *(terminates as `failed_max_loops`, distinct from an agent dying)*
- [x] Fix prompts carry **only the specific findings + affected files**, not the whole history.
- [x] Loop iteration count, per-iteration diff, and outcome recorded in state (feeds the metrics).
      *(`loop_history`: iteration, trigger, files changed, outcome)*
- [x] ChromaDB example library: 15–20 hand-written FastAPI + Beanie snippets (response-model
      pattern, ObjectId handling, router structure, pytest+httpx setup).
      *(`app/rag/library.py` — 18 snippets, each targeting a measured failure)*
- [x] Retrieval injected into the Coder prompt; a feature flag toggles RAG on/off so the
      with/without success-rate delta can be measured.
      *(flag verified: prompt 369 chars off vs 2027 on; a leak would invalidate the metric)*

**DoD:** a deliberately broken prompt is caught by the Reviewer, fixed by the Coder, and passes on
iteration 2 — visible end to end in Langfuse traces. RAG on/off both run cleanly.

*Status 2026-08-14: **half met, half deferred.***

*Met — the loop. A to-do API produced code that failed in the sandbox (0/2, collection error),
the graph routed back to the Coder, which rewrote only `main.py`, and the next execution passed
**7/7**. First L5 result in the project, produced by the loop rather than by luck.*

*Deferred — the RAG comparison. Both arms execute, but a clean measurement was impossible:
Groq's daily budget hit its cap (199,858 / 200,000 tokens) and OpenRouter's free-model daily
limit was already gone. Runs starved of quota produce nothing in seconds, which is noise, not a
result. **Re-run on fresh quota before claiming any delta.***

*Planning consequence: evaluation is quota-bound, not compute-bound. Phase 8 needs 10 prompts ×
2 arms × 3 repetitions = 60 runs, which at ~20-40k tokens per run is **6-12 days** of Groq's
daily budget. Collect continuously rather than in one batch, or add providers.*

*Correction 2026-08-15: the "0/2 → 7/7" demo above ran with `with_approvals=False` (the
evaluation harness), which compiles the graph with no `interrupt_before` at all — it never
touched the approval-gated path real users go through. Wiring Phase 7's real Live Run screen to
the actual API surfaced two bugs that only exist on that path: `events.approval_required()` was
defined but never called, so the graph correctly paused at each checkpoint but nothing told the
frontend; and `interrupt_before=["architect", "coder"]` re-paused on **every** entry to `coder`,
including the loop's own autonomous return trips, which would have silently disabled the loop
the instant approvals were turned on. Both fixed — see `app/graph/executor.py`'s `_after_invoke`
and the new `coder_gate` passthrough node in `app/graph/build.py`. Re-verified live: a real
approval-gated run looped twice on genuine Reviewer findings (`loop_count` reached 2) without
ever re-pausing for approval.*

---

## Phase 7 — Implementation E: dashboard + human checkpoints

**Goal:** the demo's wow factor.

Tasks
- [x] SSE endpoint streaming agent lifecycle events (see `docs/STATE_AND_API.md`).
      *(`app/api/stream.py`; consumed by `frontend/lib/use-run-stream.ts` via `fetch`, not the
      native `EventSource` — bearer-token auth means the browser API can't attach the
      `Authorization` header, so SSE frames are parsed by hand)*
- [x] Frontend: prompt input page → live run dashboard.
      *(`/projects/[id]` → `POST /runs` → `/runs/[id]`)*
- [x] Agent cards with idle / thinking / done / failed states.
      *(all four confirmed against a real run: PM/Architect idle→working→done, Tester
      done→failed on a genuine truncated-generation error)*
- [x] Live message timeline; loop iterations rendered as a visible cycle, not a hidden retry.
      *(the LOOP entry + pipeline return-arc animation, confirmed firing on two real Reviewer
      findings in the same run)*
- [x] Code viewer with file tree + syntax highlighting; sandbox output panel.
      *(current-file view reads live from `GET /runs/{id}/files`; the Diff toggle intentionally
      never appears for a live run — the backend stores per-iteration history as a zipped
      artifact, not structured per-file content, so there is nothing cheap to diff against yet.
      Fixing that needs either a backend endpoint returning structured history or a client-side
      unzip step — not done)*
- [x] Approval checkpoints: run pauses, UI shows Approve / Reject + edit-notes, graph resumes from
      the checkpoint on approve.
      *(both the PM and Architect checkpoints verified live, including the two bug fixes noted
      under Phase 6 above — this task was the one that surfaced them)*
- [x] SSE reconnect with replay from last event id.
      *(implemented — `Last-Event-ID` + exponential backoff in `use-run-stream.ts`, replayed by
      `bus.replay()` server-side — but not yet exercised against a real dropped connection)*

**DoD:** a non-technical person watches one run start to finish and can explain what happened.

*Status 2026-08-15: functionally complete and verified against the real backend end to end —
sign-up, project creation, a full run through both approvals, several real loop iterations on
genuine Reviewer findings across multiple runs, a real Reject at the PM checkpoint, and clean,
honest failures (`failed_llm` on invalid Tester output, `failed_max_loops` on findings that never
cleared) instead of crashes. Every outcome — succeeded / partial / failed_max_loops / failed_llm /
rejected / cancelled — renders in its correct tone with plain-English copy, confirmed in both
themes. Polish pass added a persistent header (logo, working theme switcher, signed-in email,
sign out) across Projects / Project detail / Live run, and a Cancel run control wired to the
existing `POST /runs/{id}/cancel`. What's still open: the literal DoD wants an actual
non-technical person's reaction, not just a technical run-through — get someone to watch one
before calling this closed. Separately: the backend container had no Docker socket mount at all
(docker-compose.yml) and a stale image missing the `docker` package, so no run had ever reached a
real Sandbox execution before today — both fixed; what's left blocking an actual Sandbox pass is
the Tester's own truncated-generation bug, tracked as a follow-up outside this phase.*

*Status 2026-08-19 — first fully green run: run `6a85263d25cecdf4a534e8bc` finished `succeeded`
with the Reviewer reporting "0 findings, 0 blocking — passed" and the Sandbox reporting **8 of 8
tests passed** against real pytest in the container. Getting there took seven fixes, each found by
driving live runs rather than reading code, and each verified by another live run:*

1. ***The local fallback was unreachable.** `OLLAMA_API_BASE` was `http://localhost:11434`, which
   inside the backend container means the container itself. The rung every chain ends at — the one
   CLAUDE.md §5 promises "still answers when every free tier rate-limits at once" — had been dead
   since the backend moved into Docker. Now `host.docker.internal`.*
2. ***That same rung had no timeout**, the only rung in the registry without one. Once reachable, a
   Tester call sat on it for 10+ minutes and needed a manual cancel. `_ollama()` now defaults to 120s.*
3. ***Groq retired `llama-3.3-70b-versatile`.** Confirmed against the live catalogue; it was the
   Tester's primary and PM's second rung, so both failed instantly on every call. Replaced with
   `openai/gpt-oss-20b`; the dead id is kept as `_RETIRED_GROQ_LLAMA_70B` as a paper trail.*
4. ***The Tester's cloud rungs had no timeouts and no token budgets**, though it emits a whole suite
   in one call. Truncation followed, both loudly (invalid Python) and silently.*
5. ***Fix passes were blind to sibling files.** `render_fix` sent only the file being fixed, so the
   Coder invented names other files did not define and reviews never converged. It now also carries
   the contract files (database/models/schemas, never main.py) — a narrow, deliberate exception to
   the token-budget rule that docstring explains.*
6. ***The two loops shared one budget.** `loop_count` was compared against `MAX_LOOPS` for both
   edges, so a slow-converging review could spend the entire budget and leave the Sandbox — the
   authoritative signal — zero attempts on a real, reproducible bug. `routing.py:loop_count_for`
   now derives each phase's own count from `loop_history`, giving each a full `MAX_LOOPS`.*
7. ***All three prompts contradicted FastAPI.** Architect, Coder and Reviewer each demanded an
   explicit `response_model` on every endpoint while also specifying 204 on delete; FastAPI rejects
   that pairing outright, so every generated DELETE was broken by construction. The `Endpoint`
   schema had been correct about this all along — only the prompt text was wrong. Fixed in all
   three, plus `docs/GENERATED_APP.md` §2.*

8. ***Groq's `output_parse_failed` was treated as a fatal prompt bug.** When a model narrates the
   schema instead of emitting it ("We need to output a structured object matching the Design
   type..."), Groq returns a 400 that matched no retryable marker, so the chain aborted on rung 1
   with two healthy fallbacks untried — killing a run in 18 seconds. Same reasoning as
   `tool_use_failed`: it is a property of that model, not of the prompt.*
9. ***An optional field nothing read was destroying valid generations.** `SingleFileOutput.notes`
   had a default and was consumed by no code, but Groq validates tool arguments server-side and
   demands every declared property regardless. A complete, correct 8-test suite came back and was
   rejected outright with `missing properties: 'notes'`. The field is gone; the schema now carries
   only the two fields that are actually read.*

***Repeatability, measured rather than assumed:*** *a 3-run back-to-back batch through the real API
(same path the dashboard drives, both checkpoints approved per run) scored **0/3** with defects 8
and 9 still present — all three died in the Tester/Architect chains. With both fixed the same batch
scored **2/3**, both winners passing 8/8 tests in the sandbox, and one of them needing a Sandbox fix
loop to get there — the split budget from item 6 doing exactly its job. The third failure was
exhausted free-tier quota (Groq TPM plus OpenRouter `free-models-per-day` after ~10 runs in one
evening), not a pipeline defect: every rung was tried and the run degraded honestly. Treat the
daily quota, not the pipeline, as the binding constraint on demo day — and see CLAUDE.md §8.3.*

*Cancel, separately, turned out not to cancel. `cancel_run` short-circuited on any status in
`_TERMINAL_STATUSES`, and `failed_llm` is in that set — but a node that exhausts its model chain
records `failed_llm` while the graph **keeps running** (`after_reviewer` deliberately sends a failed
review on to the Tester). So a live run could carry a terminal-looking status for minutes, and
pressing Cancel returned a cheerful 200 having done nothing: confirmed live 2026-08-19, where a
sandbox execution and a whole loop iteration ran after the click. An in-flight task is now the
authoritative "still running" signal, checked before the stored status. Covered by
`test_cancel_stops_a_live_run_whose_status_looks_terminal`, which was confirmed to fail against the
old guard before the fix went in. The same investigation showed the dashboard left the interrupted
agent's card pulsing on "working" forever; the reducer now settles any mid-flight stage to a new
`stopped` state — deliberately not `failed`, since the stage produced no verdict and §5 says a
designed stop must not look like an error.*

*Worth carrying into Phase 8: because `run.status` can read `failed_llm` mid-run, **no metrics
harness may treat that status as terminal**. The first repeatability harness did, and mis-recorded a
run that went on to finish `failed_max_loops` after six loop iterations. Read `finished_at`, or the
`run.completed`/`run.failed` event, instead.*

*The silent half of the truncation problem is now blocked structurally rather than by prompt text,
matching the rule stated at the top of `schemas/agents.py`: a `test_main.py` cut off after its
imports still parses, so it passed the old validator and pytest then collected zero tests, which
reads downstream as failing tests rather than as a Tester that wrote nothing. `SingleFileOutput`
now rejects a `test_*.py` that defines no test function (AST walk, so `conftest.py` and
`TestFoo`-class suites are both handled correctly), and `_RETRYABLE_MARKERS` carries the message so
the chain falls through to a larger budget instead of failing the run. Backend suite: 124 passed.*

*Status 2026-08-20 — everything around the pipeline, not the pipeline itself. None of this was on
Phase 7's original task list above; it is platform work that landed during the phase because the
literal DoD (a non-technical person watching a run) needs somewhere demo-safe to point them at, and
the gaps below would have undermined that the moment anyone touched the app off the happy path.*

***Auth stopped being a toy.*** *Sign-up now mails a six-digit OTP and creates no `User` document
until it is verified — an abandoned sign-up leaves nothing behind, and Mongo's own TTL index sweeps
the pending row once it expires, so there is no cleanup job to remember. "Forgot password" mails a
single-use, 10-minute link (a random token, hashed at rest — SHA-256, not bcrypt, since the token is
already unguessable and the point of hashing here is a leaked database, not brute-force resistance).
Deleting an account cascades for real: runs, projects, and — easy to miss, since it is a separate
pair of collections from `runs` — the GridFS artifacts each run produced. Sign-out, sign-out-
everywhere, and a changed password all revoke sessions server-side now: every JWT carries a `jti`
and the account a `token_version`; sign-out denylists that one token's `jti` (so a copy of it lifted
from local storage dies too, proven live by re-presenting the same token after signing out), while
sign-out-everywhere and a password change bump `token_version`, invalidating every token at once.
Before this, "sign out" only ever cleared the browser's local storage — the token itself stayed
valid for its full 24-hour life no matter what the UI showed.*

***The frontend was rebuilt, not iterated on.*** *The first full pass — landing, auth, dashboard —
was functionally complete but was pointed out (correctly) to be visually identical to an unrelated
project's UI, because both had been built from the same generic template instinct. It was replaced
with an instrument-style system specific to what this product actually is: monospace display type
throughout (the one deliberate signature), near-square geometry (`--radius: 3px`), and colour spent
on exactly one thing — five tokens, each meaning one run state, never decoration. Landing, about,
how-it-works, FAQ, a dark footer, the entire auth flow (sign in/up with an OTP step, forgot/reset
password, profile, settings), and the dashboard all carry it now, plus a brand mark built from the
same idea the product is about: a "C" drawn open on purpose, because the pipeline runs almost the
full circuit but never quite closes without the loop back to the Coder.*

***The platform database moved to Atlas.*** *`MONGO_URI` in each developer's own `.env` now points
at an Atlas M0 cluster; local Docker Mongo stays in `docker-compose.yml` only for the test suite,
which pins `MONGO_URI` to it explicitly (`tests/conftest.py`) regardless of what the app itself is
configured to use — so tests stay fast and offline instead of spending a free tier's connection
budget on every run. The migration itself was a real `mongodump`/`mongorestore`, not a fresh start:
366 documents, verified by an exact per-collection count match on both sides before the app was
pointed at the new cluster, then proven live by stopping the local instance entirely and confirming
the running app still answered real requests.*

***Two bugs worth remembering, because they were the same mistake twice.*** *The reset-password
resend cooldown silently never expired on this host: `PasswordResetToken.created_at` used a naive
`datetime.now()`, and on a UTC+5:30 machine that gets compared against an aware `_now()` as though
it were already UTC — 5.5 hours in the future, so the elapsed time came out negative and the
cooldown looked permanently unexpired. This was a repeat of an earlier bug in the same session (an
OTP resend timer that displayed as already-expired for the identical naive-vs-aware reason), caught
this time by a failing test rather than by inspection. Separately, the brand mark's first shipped
version rendered correctly everywhere it was checked except the one place that mattered — the actual
email, which used a hand-rolled Pillow rasteriser instead of the already-verified SVG, and it shipped
a visibly broken, "toothed" icon. The fix was not a fourth patch to that rasteriser: the loop-stroke
element causing every prior bug in the mark was cut outright, and the email asset is now rendered by
loading the real SVG into a browser canvas and exporting *that* — the verified shape, not a second,
divergent implementation of it.*

*Backend suite: 201 passed, 18 skipped. Still open, unchanged from the note above: get an actual
non-technical person to watch one run for the literal DoD, then start Phase 8.*

---

## Phase 8 — Testing & evaluation

**Goal:** turn the project into numbers for the report.

Tasks
- [ ] pytest for the platform: auth, CRUD, graph transitions, sandbox runner (mocked Docker),
      loop-cap behaviour.
- [ ] Evaluation harness: run all 10 canonical prompts × N repetitions, collect metrics into a
      JSON/CSV report.
- [ ] Metrics: generation success rate, test pass rate, review-loop effectiveness, average
      iterations to success, end-to-end time, **RAG vs no-RAG delta**.
- [ ] Failure taxonomy: categorise every failed run (bad schema, ObjectId error, timeout, quota,
      loop exhausted) — this table is report gold.
- [ ] Load/quota sanity: what happens when every provider 429s at once.

**DoD:** one command produces the full metrics table; results are pasted into the report chapter.

---

## Phase 9 — Deployment, docs, demo

Tasks
- [ ] Frontend to Vercel; backend + sandbox on the local machine/VM (free hosts don't expose the
      Docker socket).
- [ ] README: architecture diagram, setup steps, `.env` guide, run instructions.
- [ ] Final report chapters: architecture, agent design, feedback loop, metrics, limitations.
- [ ] Demo script: 3 prompts — one clean run, one that triggers the review loop, one showing an
      approval rejection.
- [ ] **Recorded backup video** + saved example runs, in case the live demo or a provider fails.
- [ ] Buffer week. Do not plan features into it.

**DoD:** the demo runs twice in a row on the demo machine, from a cold start, with the projector
plugged in.

---

## Critical path

If time runs short, these phases cannot be cut without losing the project's identity. Everything
else is trimmable. Spend buffer time here, in this order.

| Priority | Phase | Why it cannot be cut |
|---|---|---|
| 1 | Phase 6 — feedback loop | The project's technical contribution. Without it, CodeForge is a chatbot with extra steps. |
| 2 | Phase 5 — sandbox | "It actually runs" is the claim the whole evaluation rests on. |
| 3 | Phase 7 — dashboard | The visible collaboration is what makes the demo land in a faculty room. |
| 4 | Phase 8 — evaluation | Converts a working demo into a defensible report with numbers. |

A rough dashboard with a working loop passes. A beautiful dashboard with a fake loop does not.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Agents produce incorrect code | Review ↔ test loop + retry cap + narrow domain + RAG examples |
| Scope creep | MVP is CRUD APIs only; everything else is an upgrade, not a dependency |
| Unsafe generated code | `network_mode="none"`, resource limits, hard timeout, container destroyed after run |
| Free-tier quota cuts / 429s | LiteLLM fallback chain spanning two providers, `scripts/preflight.py` before a demo, cached example runs |
| Live demo failure | Recorded video + saved runs + cold-start rehearsal |
| Loop burns quota | `MAX_LOOPS = 3`, small prompts during dev, RAG to reduce iterations |
| Beanie generation unreliable | Fallback to sync `pymongo` in generated apps — decide by end of Month 2 |