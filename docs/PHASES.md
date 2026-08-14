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
- [ ] Pre-baked sandbox Docker image: python:3.11-slim + fastapi, uvicorn, beanie, pymongo, pytest,
      httpx, and `mongod` (no network at run time, so nothing installs later).
- [ ] `sandbox/runner.py`: write file tree to a temp dir → mount → run container with
      `network_mode="none"`, CPU/memory limits, and a hard timeout.
- [ ] Start `mongod` inside the container, then run pytest; capture stdout, stderr, exit code, and
      the pytest report.
- [ ] Force-remove the container in `finally`. No leaks.
- [ ] Artifacts (file tree zip + logs) stored in GridFS, downloadable by run id.

**DoD:** the books-API prompt goes prompt → generated code → container run → real pytest output,
and `docker ps -a` is clean afterwards. Container is killed correctly on timeout and on an
infinite-loop test case.

---

## Phase 6 — Implementation D: the feedback loop + RAG

**Goal:** the project's core differentiator. Highest risk — give it the most time.

Tasks
- [ ] Conditional edges: `reviewer → coder` when blocking findings exist; `tester → coder` when
      tests fail; `→ done` when both pass.
- [ ] Loop counter in state, `MAX_LOOPS = 3`, then fail gracefully with a partial result and a
      clear reason — never crash, never loop forever.
- [ ] Fix prompts carry **only the specific findings + affected files**, not the whole history.
- [ ] Loop iteration count, per-iteration diff, and outcome recorded in state (feeds the metrics).
- [ ] ChromaDB example library: 15–20 hand-written FastAPI + Beanie snippets (response-model
      pattern, ObjectId handling, router structure, pytest+httpx setup).
- [ ] Retrieval injected into the Coder prompt; a feature flag toggles RAG on/off so the
      with/without success-rate delta can be measured.

**DoD:** a deliberately broken prompt is caught by the Reviewer, fixed by the Coder, and passes on
iteration 2 — visible end to end in Langfuse traces. RAG on/off both run cleanly.

---

## Phase 7 — Implementation E: dashboard + human checkpoints

**Goal:** the demo's wow factor.

Tasks
- [ ] SSE endpoint streaming agent lifecycle events (see `docs/STATE_AND_API.md`).
- [ ] Frontend: prompt input page → live run dashboard.
- [ ] Agent cards with idle / thinking / done / failed states.
- [ ] Live message timeline; loop iterations rendered as a visible cycle, not a hidden retry.
- [ ] Code viewer with file tree + syntax highlighting; sandbox output panel.
- [ ] Approval checkpoints: run pauses, UI shows Approve / Reject + edit-notes, graph resumes from
      the checkpoint on approve.
- [ ] SSE reconnect with replay from last event id.

**DoD:** a non-technical person watches one run start to finish and can explain what happened.

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
| Free-tier quota cuts / 429s | LiteLLM fallback chain, Ollama local last resort, cached example runs |
| Live demo failure | Recorded video + saved runs + cold-start rehearsal |
| Loop burns quota | `MAX_LOOPS = 3`, small prompts during dev, RAG to reduce iterations |
| Beanie generation unreliable | Fallback to sync `pymongo` in generated apps — decide by end of Month 2 |