# ACCEPTANCE.md — What Counts as Success

Phase 1 deliverable. Defines, unambiguously, when a run counts as a success. Every number in the
Phase 8 evaluation and the report chapter resolves back to this file. If a criterion here is vague,
the corresponding metric is arguable — so each one is written as a mechanical check.

---

## 1. Two independent outcomes

`RunMetrics` (see `docs/STATE_AND_API.md` §6) carries `generation_succeeded` and `tests_passed` as
**separate** booleans. They are not the same claim and must never be collapsed:

| Metric | Question it answers | CLAUDE.md §10 wording |
|---|---|---|
| `generation_succeeded` | Did the pipeline produce code that actually runs? | "% of prompts producing runnable code" |
| `tests_passed` | Did that code pass its own generated tests? | "% of generated apps passing their own generated tests" |

A run can be `generation_succeeded=True, tests_passed=False`. That is a meaningful, reportable
result — it is exactly the population the review ↔ test loop is supposed to act on.

---

## 2. Acceptance levels

Each level is a gate: a run reaches level N only if it passed every level below. Levels are
evaluated against the **final** file tree in state, whatever the loop count.

### L0 — Run terminated cleanly
The graph reached a terminal `RunStatus` without an unhandled exception. Hitting `MAX_LOOPS` still
qualifies: `failed_max_loops` is a designed outcome, not a crash.

### L1 — Complete file tree
- `state["files"]` is non-empty.
- Required app files all present: `main.py`, `models.py`, `schemas.py`, `database.py`.
- `state["test_files"]` contains `test_main.py`.
- No file is empty or whitespace-only.
- No placeholder markers in any file: `TODO`, `...` as a statement body, `rest of the code`,
  `implementation here`, `pass  #`.

### L2 — Syntactically valid
Every `.py` file parses:
```python
ast.parse(content, filename=path)   # raises SyntaxError -> L2 fail
```

### L3 — Application boots  ← **`generation_succeeded = True` at this level**
Inside the sandbox container:
- `mongod` starts and accepts a connection on `localhost:27017`.
- The FastAPI app imports without raising (`from main import app`).
- At least one endpoint declared in `Design.endpoints` responds with an HTTP status `< 500`.

A 404 or 422 counts as booting. A 500, an import error, or a Beanie-init failure does not.

### L4 — Test suite executes
- pytest exits with code `0` or `1` (passed / tests-failed). Exit codes `2`–`5` mean the suite never
  properly ran — collection error, usage error, or no tests collected — and fail this level.
- The parsed report has `total > 0`.

### L5 — All tests pass  ← **`tests_passed = True` at this level**
`failed == 0` and `total > 0`.

`test_pass_ratio = passed / total`, reported for every run that reached L4. Runs that never reached
L4 record `test_pass_ratio = 0.0`, not null — they produced zero passing tests.

---

## 3. Which runs count

The denominator is `10 canonical prompts × N repetitions`, per RAG mode.

**Excluded from all metrics** (infrastructure noise, not system performance):
- Docker daemon unavailable, image missing, or host out of disk.
- Every provider returned 429 before a single completion succeeded — record as a quota event, but
  it measures free-tier availability, not CodeForge.
- Run cancelled by an operator.

**Included:**
- Runs that hit `MAX_LOOPS`. Loop exhaustion is a system outcome, not an excuse.
- Runs where a provider fallback fired mid-run and then succeeded.

**Evaluation runs must auto-approve both human checkpoints.** The graph interrupts before the PM and
Architect nodes; an unattended harness would stall there forever. The harness sets approval
programmatically and records `approvals` as auto-granted, so eval runs stay distinguishable from
demo runs.

---

## 4. Failure taxonomy

Every run that fails to reach L5 gets exactly one `failure_category`, assigned at the **lowest**
level that failed. This is the Phase 8 table.

| Category | Assigned when |
|---|---|
| `schema` | L1/L2 — incomplete tree, placeholder content, or a syntax error |
| `objectid` | L3/L5 — failure traced to returning a raw Beanie `Document` or an unserialized `ObjectId` |
| `timeout` | L3/L4 — sandbox hard timeout or container killed |
| `quota` | L0 — all providers exhausted mid-run (`failed_llm`) |
| `loop_exhausted` | Reached `MAX_LOOPS` with blocking findings or failing tests outstanding |
| `other` | Anything unclassified — should stay small; a growing bucket means this table needs a row |

`objectid` is called out separately because CLAUDE.md §8 predicts it as the #1 failure mode. Keeping
it out of `other` is what lets the report state whether that prediction held.

---

## 5. Human approval checkpoints

Confirms and extends `docs/AGENTS.md` §7.

| Checkpoint | Graph behaviour | State |
|---|---|---|
| After PM | `interrupt_before` architect | `awaiting_approval = "pm"` |
| After Architect | `interrupt_before` coder | `awaiting_approval = "architect"` |
| Final delivery | No interrupt — the run has already reached a terminal status | see below |

The first two pause the graph and are resumed via `POST /runs/{id}/approve`.

**Final delivery is not a graph interrupt.** By the time code is delivered the run is finished;
approving it is a record of human judgement, not a gate. It therefore needs no `awaiting_approval`
value and does not block anything. `RunState.approvals` already accepts an arbitrary phase key, so
it is stored as `approvals["final"]` with no schema change required.

A rejection at PM or Architect ends the run as `rejected`. Rejected runs are excluded from
generation metrics — a human stopped it, so the system was never given the chance to succeed or
fail.
