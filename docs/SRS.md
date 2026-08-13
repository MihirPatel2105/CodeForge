# SRS.md — Software Requirements Specification

**System:** CodeForge — A Multi-Agent AI Platform that Automates the Full Software Development
Life Cycle
**Document version:** 1.0
**Date:** 2026-08-13
**Status:** Draft — pending team review (Phase 1 DoD)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for CodeForge. It defines
what the system must do, the boundaries of what it will accept as input, and the criteria by which
its output is judged. It is the reference for implementation Phases 3–7 and for the evaluation in
Phase 8.

### 1.2 Scope

CodeForge accepts a natural-language description of a small web API and produces a working, tested
CRUD REST API. Five role-based AI agents — PM, Architect, Coder, Reviewer, Tester — coordinate
through an orchestrated workflow that mirrors the software development life cycle. Generated code is
executed inside an isolated container, its generated tests are run, and results are streamed live to
a web dashboard with human approval checkpoints between major phases.

CodeForge automates classic SDLC phases 1–4 (Requirement Analysis, Design, Implementation, Testing),
plus a code-review quality gate. Deployment and maintenance of generated applications are explicitly
outside its scope.

The system's distinguishing contribution is not code generation itself but the **conditional cyclic
review ↔ test feedback loop**: generated code is reviewed and tested, and failures route back to the
Coder for revision under a bounded retry policy.

### 1.3 Definitions, acronyms and abbreviations

| Term | Meaning |
|---|---|
| Agent | An LLM-backed component fulfilling one SDLC role, with a fixed prompt template and output schema |
| Orchestrator | The LangGraph state machine that routes control between agents |
| Run | One execution of the pipeline from user prompt to terminal status |
| `RunState` | The shared state object every agent reads and writes |
| Fix pass | A return to the Coder triggered by review findings or test failures |
| Loop count | Number of fix passes performed in a run; capped at `MAX_LOOPS = 3` |
| Sandbox | The network-isolated container in which generated code executes |
| Generated app | The FastAPI application CodeForge produces |
| Platform | CodeForge itself, as distinct from a generated app |
| SSE | Server-Sent Events, the one-way streaming channel to the dashboard |
| RAG | Retrieval-Augmented Generation over a curated example library |

### 1.4 References

| Document | Contents |
|---|---|
| `CLAUDE.md` | Authoritative architecture and technology stack |
| `docs/PHASES.md` | Phase-wise build plan and Definitions of Done |
| `docs/AGENTS.md` | Agent specifications, I/O schemas, orchestration graph |
| `docs/STATE_AND_API.md` | State schema, REST and SSE contracts, database models |
| `docs/ACCEPTANCE.md` | Success criteria, failure taxonomy, approval semantics |
| `backend/tests/prompts.json` | The frozen 10-prompt evaluation set |

---

## 2. Overall description

### 2.1 Product perspective

CodeForge is a self-contained system comprising a web frontend, a single backend service, a document
database, an agent orchestration layer, and a container-based execution sandbox. It depends on
external LLM providers, accessed exclusively through free tiers via a routing layer that fails over
between providers.

It is a new, standalone system. It does not integrate with, extend, or replace any existing product.

### 2.2 Product functions

At a high level the system shall:

- Authenticate users and scope all data to the owning user.
- Accept a natural-language application request and initiate a run.
- Elicit structured requirements from that request (PM).
- Produce a technical design — collections, endpoints, file structure (Architect).
- Generate a complete, runnable multi-file application (Coder).
- Review generated code against a fixed checklist and emit structured findings (Reviewer).
- Generate a test suite targeting the designed endpoints (Tester).
- Execute the application and its tests inside an isolated sandbox.
- Route failures back to the Coder for bounded revision.
- Pause for human approval at defined checkpoints.
- Stream progress to a dashboard in real time.
- Persist artifacts and record per-run metrics.

### 2.3 User classes and characteristics

| User class | Description | Technical skill |
|---|---|---|
| End user | Submits prompts, reviews agent output, approves or rejects at checkpoints | Low to moderate; must be able to judge whether requirements match intent |
| Evaluator | Runs the benchmark harness and interprets metrics | High |
| Observer | Watches a live run without interacting, e.g. during a demonstration | None assumed |

The dashboard shall remain interpretable by an Observer with no prior knowledge of the system.

### 2.4 Operating environment

- **Backend and sandbox:** a local machine or virtual machine with a Docker daemon. A Docker socket
  is required, which free serverless hosting tiers do not provide.
- **Frontend:** any modern browser; deployable to a static/edge host.
- **Platform database:** MongoDB, either a free-tier managed cluster or a local container.
- **LLM providers:** reachable over the public internet from the backend host. The sandbox itself has
  no network access.

### 2.5 Design and implementation constraints

| ID | Constraint |
|---|---|
| C-1 | The system shall incur zero monetary cost. No paid service, tier, or API key may be introduced. |
| C-2 | The technology stack defined in `CLAUDE.md` §3 is fixed and shall not be substituted. |
| C-3 | Sandbox containers shall run with networking disabled, without exception. |
| C-4 | Generated applications are restricted to CRUD REST APIs over one or two entities. |
| C-5 | Generated applications shall not contain authentication, external service calls, or environment-dependent configuration. |
| C-6 | All inter-agent handoffs shall be schema-validated structured objects, never free text. |
| C-7 | No secret shall appear in source; configuration is supplied through environment variables. |
| C-8 | The sandbox image shall be pre-built with all runtime dependencies, since nothing can be installed without a network. |

### 2.6 Assumptions and dependencies

- Free-tier LLM quotas remain available. Rate-limit responses are expected during normal operation
  and are handled by provider fallback, not treated as defects.
- At least one provider in a given chain is reachable; a local model server acts as last resort.
- A user's prompt describes an application expressible within the supported domain (§4). Requests
  outside it are narrowed rather than rejected.
- Free-tier provider quotas and model availability may change without notice; model selection is
  therefore centralised in one configuration module.

---

## 3. Specific requirements

### 3.1 Functional requirements

Priority: **M** = must have, **S** = should have, **C** = could have.

#### Authentication and accounts

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The system shall allow a user to register with an email address and password, storing only a hashed password. | M |
| FR-2 | The system shall issue a signed token on successful authentication and verify it on every protected request. | M |
| FR-3 | The system shall expose the authenticated user's own profile. | M |
| FR-4 | The system shall reject unauthenticated requests to all endpoints except health and authentication routes. | M |

#### Project and run management

| ID | Requirement | Priority |
|---|---|---|
| FR-5 | The system shall allow a user to create a project and list only their own projects. | M |
| FR-6 | The system shall accept a run request consisting of a project reference, a natural-language prompt, and an optional retrieval flag. | M |
| FR-7 | The system shall acknowledge a run request immediately and execute the pipeline asynchronously, never blocking the request until completion. | M |
| FR-8 | The system shall expose the full state of a run on demand. | M |
| FR-9 | The system shall expose the current generated file tree for a run. | M |
| FR-10 | The system shall allow a running pipeline to be cancelled. | S |
| FR-11 | The system shall retain run history per project. | S |
| FR-12 | The system shall store run artifacts — the generated file tree and execution logs — and allow retrieval by run. | S |

#### Agent pipeline

| ID | Requirement | Priority |
|---|---|---|
| FR-13 | The PM agent shall convert a natural-language prompt into structured requirements comprising entities, fields, operations and user stories, resolving ambiguity with defaults rather than questioning the user. | M |
| FR-14 | The PM agent shall enforce the supported domain (§4), narrowing over-scoped requests and recording what was excluded. | M |
| FR-15 | The Architect agent shall produce a design specifying collections, endpoints with explicit request and response models, and a target file structure. | M |
| FR-16 | The Architect agent shall require every endpoint to declare an explicit response model and shall never permit returning a raw database document. | M |
| FR-17 | The Coder agent shall emit a complete multi-file application, every file runnable as written, with no placeholders or elisions. | M |
| FR-18 | The Reviewer agent shall evaluate generated code against a fixed checklist and emit structured findings carrying severity, location, issue and remediation hint. | M |
| FR-19 | The Reviewer agent shall not modify code. | M |
| FR-20 | The Tester agent shall generate a test suite covering every designed endpoint, including not-found paths for retrieval, update and deletion. | M |
| FR-21 | Each agent shall return a schema-valid structured object; malformed output shall be retried, never parsed heuristically. | M |

#### Orchestration and the feedback loop

| ID | Requirement | Priority |
|---|---|---|
| FR-22 | The system shall route control between agents according to the SDLC sequence. | M |
| FR-23 | The system shall return control to the Coder when the Reviewer reports blocking findings, or when the executed tests fail. | M |
| FR-24 | The system shall pass only the outstanding findings and the affected files into a fix pass, not the accumulated history. | M |
| FR-25 | The system shall limit fix passes to a fixed maximum and, on exhaustion, terminate with a partial result and a stated reason rather than failing or looping indefinitely. | M |
| FR-26 | The system shall record, per run, the iteration count, what triggered each iteration, and its outcome. | M |
| FR-27 | The system shall persist state at every transition such that an interrupted run can be resumed. | M |

#### Human-in-the-loop

| ID | Requirement | Priority |
|---|---|---|
| FR-28 | The system shall suspend the pipeline after the requirements phase and after the design phase, pending human decision. | M |
| FR-29 | The system shall resume a suspended run on approval, and terminate it as rejected on refusal, in both cases recording the decision and any note. | M |
| FR-30 | The system shall record a human judgement on final delivered code without blocking the pipeline. | S |

#### Execution sandbox

| ID | Requirement | Priority |
|---|---|---|
| FR-31 | The system shall execute generated code inside an isolated container with networking disabled and bounded memory and CPU. | M |
| FR-32 | The system shall provide the generated application with a database instance local to that container. | M |
| FR-33 | The system shall capture standard output, standard error, exit status and the structured test report from each execution. | M |
| FR-34 | The system shall terminate an execution exceeding a fixed time limit. | M |
| FR-35 | The system shall destroy every container after use, including on failure or timeout. | M |

#### Retrieval

| ID | Requirement | Priority |
|---|---|---|
| FR-36 | The system shall maintain a curated library of reference implementation patterns. | S |
| FR-37 | The system shall retrieve relevant patterns and supply them to the Coder agent as reference material. | S |
| FR-38 | Retrieval shall be switchable per run so that its effect on outcomes can be measured. | M |

#### Streaming and observability

| ID | Requirement | Priority |
|---|---|---|
| FR-39 | The system shall stream run lifecycle events — agent transitions, loop iterations, file writes, execution output, results — to connected clients in real time. | M |
| FR-40 | Every streamed event shall carry a monotonic identifier, and clients shall be able to reconnect and replay from the last received event. | M |
| FR-41 | Every event shall also be persisted so that a reloaded client can reconstruct the full timeline. | S |
| FR-42 | The system shall trace every model invocation with the run, agent and iteration to which it belongs. | M |
| FR-43 | The system shall record per-run metrics sufficient to compute generation success rate, test pass rate, loop effectiveness, iteration count, elapsed time and retrieval benefit, without manual instrumentation. | M |

#### Presentation

| ID | Requirement | Priority |
|---|---|---|
| FR-44 | The dashboard shall display each agent's live status, distinguishing idle, working, complete and failed. | M |
| FR-45 | The dashboard shall render loop iterations as a visible cycle rather than a silent retry. | M |
| FR-46 | The dashboard shall present the generated file tree with syntax highlighting and the execution output. | M |
| FR-47 | The dashboard shall present approval decisions to the user at each checkpoint, with an option to attach a note. | M |

### 3.2 External interface requirements

**User interface.** A browser dashboard providing prompt submission, a live run view, a code viewer,
an execution output panel and approval controls. It shall remain interpretable by a non-specialist
observer; clarity takes precedence over information density.

**Application programming interface.** A versioned HTTP interface over JSON, secured by bearer
tokens, plus one server-sent event stream per run. Endpoint paths, payload shapes and event names are
specified in `docs/STATE_AND_API.md` §3–§4, which is the binding contract between frontend and
backend.

**Model provider interface.** All model invocations pass through a single routing layer configured
with an ordered provider chain per agent. No provider SDK is invoked directly, and no model
identifier appears outside the central configuration module.

**Sandbox interface.** The sandbox accepts a file tree and a time limit and returns exit status,
captured streams, a structured test report and a timeout indicator, as specified in
`docs/STATE_AND_API.md` §5.

### 3.3 Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Cost | Total operating cost shall be zero. Any requirement that cannot be met free of charge shall be renegotiated rather than paid for. |
| NFR-2 | Security — isolation | Generated code is untrusted. It shall execute only with networking disabled, bounded resources, a read-only source mount and no host filesystem access beyond its own working directory. |
| NFR-3 | Security — platform | Passwords shall be stored only as hashes. Secrets shall be supplied by environment and never committed. Every data access shall be scoped to the owning user. |
| NFR-4 | Reliability | Provider rate limiting is an expected condition. A run shall survive it by failing over to the next provider in the chain, and this behaviour shall be verified deliberately rather than assumed. |
| NFR-5 | Reliability | No run shall terminate through an unhandled exception. Every terminal state shall carry a machine-readable status and a human-readable reason. |
| NFR-6 | Reliability | Fix passes shall be bounded. An unbounded loop is a defect, not a degraded mode. |
| NFR-7 | Durability | Run state shall survive process termination and be resumable from the last completed transition. |
| NFR-8 | Resource safety | No container shall outlive its run. Container cleanup shall occur on every path, including exceptions and timeouts. |
| NFR-9 | Observability | Every model invocation shall be traceable, and the five evaluation metrics shall be derivable from recorded traces and metrics without manual bookkeeping. |
| NFR-10 | Usability | A person unfamiliar with the system shall be able to watch a complete run and describe what occurred. |
| NFR-11 | Resilience | Streaming connections are assumed to drop. Clients shall reconnect and replay without losing timeline continuity. |
| NFR-12 | Performance | End-to-end duration shall be recorded per run and reported. No fixed service level is asserted, as latency is dominated by third-party free-tier providers outside the system's control. |
| NFR-13 | Maintainability | Each module shall hold a single responsibility. Agents shall not access the container runtime, the database or the event channel directly. |
| NFR-14 | Maintainability | Prompt templates shall be versioned, and the version in force shall be recorded per run, since prompt changes shift measured outcomes. |
| NFR-15 | Portability | The full platform shall start on a clean machine through a single container orchestration command plus documented environment configuration. |

---

## 4. Supported prompt domain

The system accepts prompts describing **CRUD REST APIs over one or two entities**, with fields drawn
from a restricted type set: text, integer, decimal, boolean, timestamp and list-of-text. Supported
operations are create, read, update and delete.

**Explicitly excluded:** authentication or authorisation within generated applications; integration
with external services; file upload or binary handling; background jobs and scheduling; real-time
transport in generated applications; user interface generation; more than two entities; and
many-to-many relationships.

### 4.1 Rationale

This restriction is a deliberate reliability decision, not a limitation of effort. Four independent
constraints converge on it:

1. **Execution isolation.** The sandbox has no network access (C-3). Any generated application
   calling an external service could not run, so such requests are out of scope by construction.
2. **Free-tier capacity.** The Coder agent emits an entire file tree in a single turn. Free-tier
   token throughput and context limits bound how much can be produced reliably; a larger domain
   would raise failure rates for reasons unrelated to the system's design.
3. **Measurement validity.** Evaluation compares success rates across a fixed prompt set and between
   retrieval modes. Heterogeneous task difficulty would confound those comparisons.
4. **Security posture.** Generated authentication code is security-sensitive and cannot be validated
   within this project's scope. Excluding it removes a class of unreviewable output.

Requests exceeding the domain are **narrowed rather than refused** (FR-14): the PM agent reduces the
request to the supported subset and records the excluded portions, so the user sees what was dropped
instead of receiving an error.

### 4.2 Evaluation set

The frozen evaluation set is `backend/tests/prompts.json`: ten prompts, six single-entity and four
two-entity, collectively exercising every permitted field type. These prompts are fixed. Amending
one after metric collection begins invalidates comparison across runs; additions shall be made under
a new version identifier.

---

## 5. Acceptance criteria

Acceptance is specified separately, in `docs/ACCEPTANCE.md`. In summary:

- **Generation succeeds** when the produced application starts and serves requests inside the
  sandbox (level L3).
- **Tests pass** when the generated suite executes and reports no failures (level L5).

These are independent outcomes. An application that runs but fails its own tests is a valid and
reportable result, and is precisely the case the review ↔ test loop exists to address. Failure of a
run is classified into exactly one category at the lowest level that failed, forming the failure
taxonomy reported in Phase 8.

---

## 6. Out of scope

The following are outside this specification and are recorded as future work:

- Deployment and lifecycle management of generated applications (classic SDLC phases 5–6).
- Generation of anything other than CRUD REST APIs within the stated domain.
- Multi-user collaboration on a single run.
- Editing generated code within the platform.
- Horizontal scaling of the platform or concurrent sandbox execution beyond a single host.
