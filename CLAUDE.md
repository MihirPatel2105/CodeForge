# CLAUDE.md — CodeForge

Read this file fully before touching any code. It is the single source of truth for how this
repo is built. Deeper detail lives in `docs/` — load those files when the task needs them.

| Doc | Load it when |
|---|---|
| `docs/PHASES.md` | Starting or finishing any build phase; unsure what to work on next |
| `docs/AGENTS.md` | Working on LangGraph, agent prompts, or the review ↔ test loop |
| `docs/STATE_AND_API.md` | Touching the state schema, REST routes, SSE events, or DB models |

---

## 0. Current status — update this after every phase

```
CURRENT PHASE : 1 — Requirements
LAST DoD MET  : Phase 0 (2026-08-13) — compose up healthy, /health ok, mongo reachable,
                frontend builds, LiteLLM->Groq call traced in Langfuse
NEXT UP       : SRS + 10 canonical prompts committed to backend/tests/prompts.json
BLOCKED ON    : nothing (Ollama still uninstalled — Phase 0 leftover, needed by Phase 3)
```

Before starting work, read the matching phase in `docs/PHASES.md` and confirm its Definition of
Done. Do not begin a later phase while an earlier DoD is unmet. Update this block when a phase
closes — it is how a fresh session knows where the project stands.

---

## 1. What CodeForge is

CodeForge is a multi-agent AI platform that automates the full Software Development Life Cycle.
A user types a plain-English app request. Five role-based AI agents — PM, Architect, Coder,
Reviewer, Tester — coordinate through the SDLC phases and produce a **working, tested CRUD REST
API**, executed live inside a Docker sandbox, streamed to a dashboard, with human approval
checkpoints between phases.

**Academic subtitle:** *A Multi-Agent AI Platform that Automates the Full Software Development
Life Cycle.*

The differentiator is **not** code generation. It is:
1. Explicit SDLC-mapped agent roles.
2. A **conditional cyclic review ↔ test feedback loop** (the core technical contribution).
3. Live visible collaboration + human-in-the-loop approvals.

This is a final-year B.Tech capstone. Success = a live faculty demo where a prompt turns into a
running, tested API on screen.

---

## 2. Hard constraints — do not violate

1. **$0 cost.** Everything free or open-source. No paid API keys, no paid tiers, ever.
2. **Locked stack.** The stack in §3 is decided. Do not swap, "upgrade", or suggest alternatives
   mid-task. If something genuinely blocks you, stop and ask.
3. **Scope is locked to CRUD REST APIs.** No full-stack generation, no auth generation inside
   generated apps, no arbitrary app types. Narrow scope is a deliberate reliability decision.
4. **Never touch these without explicit approval:** architecture/stack decisions, deleting or
   restructuring existing files, anything that changes how a working feature behaves.
5. **No secrets in code.** Everything through `.env`, with `.env.example` kept updated.
6. **Do not add author names, college names, or IDs** to any file, comment, or docstring unless
   explicitly told to.

---

## 3. Locked tech stack

### Platform (CodeForge itself)

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | FastAPI — **single service**, Python 3.11 |
| Auth | Custom JWT (python-jose + passlib/bcrypt) |
| Agent framework | LangGraph |
| Durability | LangGraph `MongoDBSaver` checkpointer |
| Platform DB | MongoDB (Atlas M0 free tier or local Docker) |
| ODM | Beanie (Motor + Pydantic) |
| LLM routing | LiteLLM (single `completion()` call, auto-fallback on 429) |
| Providers | Groq → Cerebras → OpenRouter `:free` → Google AI Studio → Ollama (local) |
| Structured output | Pydantic + Instructor (schema-valid JSON between handoffs) |
| RAG | ChromaDB over a **curated** library of 15–20 hand-written FastAPI + Beanie snippets |
| Sandbox | Docker SDK for Python, `network_mode="none"` |
| Streaming | Server-Sent Events (SSE) |
| Artifacts | MongoDB GridFS |
| Observability | Langfuse (self-hosted, MIT) |
| Local orchestration | Docker Compose |
| Deployment | Vercel (frontend) + local machine/VM (backend + sandbox) |

### Generated apps (what CodeForge outputs)

FastAPI · MongoDB (`mongod` **inside** the sandbox container) · Beanie ODM · pytest + httpx.
Fallback ODM: `pymongo` (sync) — only if Beanie generation reliability is poor by end of Month 2.

### Explicitly cut — never reintroduce

Kafka/RabbitMQ · Elasticsearch · Keycloak/Auth0 · Prometheus+Grafana · Kubernetes · S3/MinIO ·
Temporal · PostgreSQL · SQLite · Express.js/Node backend · any paid LLM API.

> **Note on older docs:** the original project report mentions React, SQLite, and a Node backend,
> and the earlier project name "AI-SDLC". Those are superseded. This file and `CodeForge_Tech_Stack`
> win in any conflict. Project name is **CodeForge**.

---

## 4. Repo structure

```
CodeForge/
├── CLAUDE.md
├── docs/
│   ├── PHASES.md            # SDLC phase-wise build plan
│   ├── AGENTS.md            # agent specs, prompts, the feedback loop
│   └── STATE_AND_API.md     # state schema, REST + SSE contract, DB models
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory
│   │   ├── config.py               # pydantic-settings, reads .env
│   │   ├── api/                    # routers: auth, projects, runs, stream
│   │   ├── core/                   # security, jwt, deps, exceptions
│   │   ├── db/                     # Motor client, Beanie init, GridFS
│   │   ├── models/                 # Beanie Documents (User, Project, Run)
│   │   ├── schemas/                # Pydantic request/response + agent I/O schemas
│   │   ├── graph/
│   │   │   ├── state.py            # RunState — the spine of the project
│   │   │   ├── build.py            # graph nodes, edges, conditional routing
│   │   │   └── nodes/              # one file per agent node
│   │   ├── agents/                 # agent classes (LLM call + parse + validate)
│   │   ├── prompts/                # role prompt templates (.py or .jinja)
│   │   ├── llm/                    # LiteLLM wrapper, model registry, retries
│   │   ├── rag/                    # ChromaDB index + retriever + example library
│   │   ├── sandbox/                # Docker runner, output capture, cleanup
│   │   └── events/                 # SSE event bus + event schemas
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/                        # Next.js App Router pages
    ├── components/                 # agent cards, timeline, code viewer, approval bar
    ├── lib/                        # api client, SSE hook, types
    └── ...
```

**Rule:** one responsibility per module. Agent code never calls Docker directly, never touches
Mongo directly, and never formats SSE payloads — it goes through `sandbox/`, `db/`, `events/`.

---

## 5. Model routing (pinned in one file)

All model names live in `backend/app/llm/registry.py`. Never hardcode a model string in agent code.

| Agent | Primary → fallback chain |
|---|---|
| PM | Groq (gpt-oss-120b) → Llama 3.3 70B → Gemini Flash → Ollama |
| Architect | Groq (gpt-oss-120b) → Cerebras → Gemini Flash → Ollama |
| Coder | **Cerebras (Qwen3-Coder class)** → Groq → Ollama |
| Reviewer | Groq (gpt-oss-120b) → OpenRouter `:free` |
| Tester | Groq → OpenRouter `:free` |

Coder is on Cerebras first because it writes the most tokens per turn (~30K TPM headroom vs
Groq's ~6K ceiling, which a multi-file write blows through instantly). Gemini is a **fallback
only** — its free tier was cut in Dec 2025 and is unstable.

---

## 6. Coding conventions

**Python**
- Python 3.11, `async def` everywhere in request/graph paths. No blocking I/O in async functions.
- Type hints on every function signature. Pydantic models for every boundary.
- Errors: raise typed exceptions from `core/exceptions.py`; handled centrally, never `except: pass`.
- Comment only non-obvious logic (why, not what).
- Format: `ruff` + `ruff format`.

**LLM calls**
- Always go through `llm/client.py`. Never call a provider SDK directly.
- Always request structured output via Instructor + a Pydantic schema. Never parse free text with
  regex or `json.loads` on a raw completion.
- Every call is traced to Langfuse with `run_id`, agent name, and loop iteration as metadata.

**Frontend**
- Server components by default; `"use client"` only where state/SSE is needed.
- shadcn/ui primitives — don't hand-roll buttons/dialogs.
- The dashboard must stay readable to a non-expert (faculty demo). Clarity > density.

**Git**
- Small, single-purpose commits. Conventional style: `feat(graph): add reviewer node`.
- Branch off `main`, PR with what changed and why.

---

## 7. How to work with me in this repo

1. **One module at a time.** Don't scaffold the whole backend in one shot.
2. **Diagnose before fixing.** When I paste an error, explain the root cause first, then patch.
3. **State assumptions in one line** and proceed — don't ask a list of clarifying questions.
4. Before writing code for a phase, re-read the matching section in `docs/PHASES.md` and confirm
   the phase's **Definition of Done**.
5. After finishing a unit of work, say what changed, what's now testable, and what's next.
6. If a task would break a hard constraint in §2, stop and say so instead of working around it.

---

## 8. Known gotchas (bake these in)

1. **MongoDB `_id` is an `ObjectId` and is not JSON-serializable.** Generated apps must never
   return a raw Beanie `Document`. The response-model pattern goes in the Architect Agent's prompt
   template **and** on the Reviewer Agent's checklist. This is the #1 predicted failure mode.
2. `network_mode="none"` means **no pip install inside the sandbox at run time**. The sandbox
   image must be pre-baked with fastapi, beanie, motor, pytest, httpx, uvicorn, and mongod.
3. Free-tier 429s are normal, not bugs. LiteLLM fallback must be tested deliberately, not assumed.
4. Every sandbox container must be force-removed in a `finally` block. Leaked containers will
   eat the demo machine.
5. Loop iterations must be hard-capped (`MAX_LOOPS = 3`). An uncapped review ↔ test cycle can
   burn an entire day's free quota in minutes.
6. SSE connections drop. The frontend needs reconnect + replay from last event id.

---

## 9. Team ownership

| Owner | Area |
|---|---|
| 1 | Next.js dashboard, SSE consumer, human-approval UI |
| 2 | FastAPI: auth, project/run CRUD, GridFS artifacts |
| 3 | LangGraph: state schema, agent prompts, review ↔ test loop |
| 4 | Docker sandbox, generated-app templates, ChromaDB library, evaluation harness |

Owner 3 holds the core differentiator and the heaviest load.

---

## 10. Definition of project success

- Generation success rate: % of prompts producing runnable code.
- Test pass rate: % of generated apps passing their own generated tests.
- Review-loop effectiveness: how often the Reviewer catches a real issue.
- Average iterations to success.
- End-to-end time (prompt → running output).
- **With-RAG vs without-RAG success-rate delta** — this is a reportable headline metric.

Non-negotiable deliverable: a live demo that survives a faculty room, plus a recorded backup video.