# UI_BRIEF.md — Design brief for the CodeForge dashboard

Hand this to the designer. It describes what must be on screen and why, not how it should
look — visual direction is the designer's call, within the constraints in §8.

---

## 1. What the product does

A user types a plain-English description of a small web API. Five AI agents — **PM,
Architect, Coder, Reviewer, Tester** — work through it in sequence, like a software team.
The generated code is then **executed for real** in an isolated container and its tests
are run. The user watches all of this happen live and approves the work at two points.

The single most important thing to convey: **this is a team of agents collaborating, and
when the Reviewer or the tests find a problem, the work goes back to the Coder and around
again.** That loop is the product's whole reason for existing. If a viewer cannot see the
loop happen, the design has failed.

## 2. Who is watching

A university faculty panel during a live demo, and the student presenting. Assume the
audience is technical in general but knows nothing about this system. They will watch one
run from start to finish, roughly 3–5 minutes, and must be able to describe afterwards
what happened. **Clarity beats density everywhere.** This is a screen to be read from
across a room, not an admin console.

## 3. Screens

Five screens. The Live Run screen is 80% of the value — design it first and best.

### 3.1 Sign in / Register
Minimal. Email + password, toggle between the two modes. One card, centred.

### 3.2 Projects
A list of the user's projects, and a way to create one (name + optional description).
Each row shows the project name and how many runs it has. Clicking opens Project Detail.

### 3.3 Project detail / run history
A table or list of past runs for a project. Each row: the prompt (truncated), the outcome,
number of loop iterations, how long it took, when it ran. Clicking a row opens that run in
the Live Run screen, replayed from history.

Plus the entry point for a new run: a prompt textarea, and a toggle labelled something like
"Use example library" (this switches retrieval on and off; it exists so the two modes can
be compared).

### 3.4 Live Run — the centrepiece
See §4. This is where the demo happens.

### 3.5 Result summary
Shown when a run finishes, either inline at the bottom of the Live Run screen or as its own
view. Contains: final outcome, how many loop iterations it took, tests passed vs total,
total elapsed time, and a download link for the generated code.

---

## 4. The Live Run screen in detail

Four regions. The designer decides the arrangement; the pipeline and the timeline are the
two that matter most.

### 4.1 Pipeline (the hero element)

Six stages in order:

```
PM  →  Architect  →  Coder  →  Reviewer  →  Tester  →  Sandbox
```

Each stage is a card showing the agent's name, a one-line description of its job, and its
current state. **Plus the loop:** a visible return path from Reviewer back to Coder, and
from Sandbox back to Coder. When the loop fires, the viewer must see the work travel
backwards and the iteration counter increase. This should be the most eye-catching moment
in the whole demo — it is the project's core contribution.

Agent card states, all four of which need a distinct visual treatment:

| State | Meaning |
|---|---|
| `idle` | Not reached yet |
| `working` | Currently running — needs a sense of live activity |
| `done` | Finished successfully |
| `failed` | Could not produce valid output |

Cards also show, when relevant: which AI model answered (e.g. "groq/gpt-oss-120b"), how
long the step took, and a one-line summary of what it produced ("4 endpoints designed",
"3 findings, 1 blocking").

There is a real subtlety worth designing for: a stage can run **more than once**. The
Coder card in iteration 2 is the same card doing a second pass, not a new stage. Consider
an iteration badge.

### 4.2 Live timeline

A chronological feed of what is happening, newest at the bottom, auto-scrolling. Entries
are short, human sentences, each with a timestamp, the agent it came from, and an icon or
colour for the kind of event.

Real examples, taken from an actual run:

```
10:00:04   PM         Identified entity: Book (title, author, year, genres)
10:00:06   PM         Completed — 1 entity, 4 operations, 5.1s
10:00:06   —          Waiting for your approval
10:00:20   —          Approved
10:00:28   Architect  5 endpoints designed, all with explicit response models
10:00:52   Coder      Wrote database.py (289 bytes)
10:00:56   Coder      Wrote main.py (2,318 bytes)
10:01:03   Reviewer   DELETE /books/{id} returns the Document directly — ObjectId is
                      not serialisable
10:01:04   Reviewer   3 findings, 2 blocking
10:01:04   ⟳ LOOP     Iteration 1 — sending 2 blocking findings back to the Coder
10:01:15   Coder      Rewrote main.py — added BookResponse to the DELETE route
10:01:21   Reviewer   1 finding, 0 blocking — passed
10:01:41   Sandbox    8 passed in 1.42s
10:01:42   —          Run completed in 1m 42s
```

**The `LOOP` entry must stand out strongly.** It is the moment the demo is built around.

### 4.3 Code and output

A file browser for the generated application — typically four files plus a test file — with
syntax-highlighted Python. Files appear one by one as they are written, so a "new" or
"updated" affordance is useful, especially when a fix pass rewrites a single file.

Alongside it, a terminal-style panel showing the sandbox's real output:

```
collected 8 items
test_main.py ........                    [100%]
8 passed in 1.42s
```

And a test result summary: how many passed out of how many, with failures expandable to
show the assertion that failed.

### 4.4 Approval bar

Twice per run the pipeline **pauses and waits for a human**: after the PM produces
requirements, and after the Architect produces a design. This must be unmissable — the run
is stopped and nothing proceeds until the user acts.

The bar shows what is being approved (the requirements, or the design, rendered readably —
not raw JSON), an **Approve** action, a **Reject** action, and an optional note field. On
approve the pipeline resumes; on reject the run ends.

---

## 5. Vocabulary to use on screen

Use these exact words; they map to real system states.

**Run outcomes:** `queued`, `running`, `awaiting approval`, `succeeded`, `failed — loop
limit reached`, `failed — sandbox error`, `failed — AI providers unavailable`, `rejected`,
`cancelled`.

Note that "failed — loop limit reached" is a *designed* outcome, not a crash: the system
tried three times, could not fix the code, and stopped deliberately while keeping what it
produced. It should not look like an error state.

**Review finding severities:** `blocking` (the code will not work), `warning` (works but
fragile), `nit` (style only). Only `blocking` triggers the loop — the visual weighting
should reflect that.

**The five agents and their jobs:**

| Agent | One-line description for the card |
|---|---|
| PM | Turns the request into structured requirements |
| Architect | Designs the endpoints and data models |
| Coder | Writes the application code |
| Reviewer | Checks the code against a fixed checklist |
| Tester | Writes the test suite |
| Sandbox | Runs the code and its tests for real |

---

## 6. Data the UI receives

Everything arrives as a live event stream. The full list of event types is in
`frontend/lib/types.ts`, and `frontend/lib/mock-run.ts` is a complete recorded run the
designer can use as realistic sample content.

The fourteen event types, in the order a run produces them:

`run.started`, `agent.started`, `agent.message`, `agent.completed`, `agent.failed`,
`approval.required`, `approval.resolved`, `loop.iteration`, `file.written`,
`sandbox.started`, `sandbox.output`, `tests.result`, `run.completed`, `run.failed`.

---

## 7. States the design must cover

Please provide each of these; they are all real and all get seen during a demo.

1. **Empty** — no projects yet, no runs yet.
2. **Prompt entry** — before a run starts.
3. **Running** — mid-pipeline, one agent working, earlier ones done.
4. **Awaiting approval** — pipeline paused, approval bar demanding attention.
5. **Loop firing** — the moment work returns to the Coder, iteration badge incrementing.
6. **Success** — all tests passed.
7. **Partial failure** — code runs but some tests fail (this is common and normal).
8. **Loop limit reached** — three attempts, still failing, stopped deliberately.
9. **Agent failed** — one agent could not produce output; the run continues or stops.
10. **Connection lost** — the live stream dropped and is reconnecting.

State 7 deserves emphasis: in practice most runs end here rather than in state 6. A design
that only looks good when everything passes will look wrong most of the time.

---

## 8. Constraints

- **Stack:** Next.js 15 (App Router), Tailwind CSS, **shadcn/ui**. Please build from
  shadcn primitives rather than bespoke components — buttons, cards, dialogs, tabs, badges,
  scroll areas, separators.
- **Light theme only** (changed 2026-08-19; this section previously required both).
  A dark theme's black levels are unreliable on an unknown projector, so the product
  ships the single appearance it can vouch for rather than two it cannot both test.
  There is no theme switch. The terminal panel stays dark regardless — it reproduces
  real console output, and a light-on-white terminal would misrepresent it.
- **Responsive**, but optimise for a laptop screen shown on a projector. Legibility at
  distance matters more than fitting more in.
- **No external assets** — no icon fonts, no remote images. Lucide icons (shipped with
  shadcn) are available.
- **Motion:** welcome for the live/working states and especially for the loop, but it must
  not make the screen hard to read. Nothing that spins forever with no meaning.
- **No fabricated data in the design** — please use the real strings from §4.2 and
  `mock-run.ts`. Placeholder lorem text hides whether the layout survives real content
  (some findings are two lines long; some prompts are one sentence).

---

## 9. What we need back

1. The **Live Run screen** in at least these states: running, awaiting approval, loop
   firing, success, partial failure.
2. The other four screens at a single representative state each.
3. The **agent card** in all four states, as a component study.
4. A **timeline entry** study covering an ordinary message, a blocking finding, and a loop
   iteration.
5. Colour tokens and type scale, in both themes.

Component-level fidelity is more useful to us than polished full-page mockups: we will be
rebuilding this in shadcn/ui, so knowing the spacing, weights and colour roles of the
pieces matters more than a pretty composition.

---

## 10. The one-sentence test

If a faculty member watches the screen for four minutes and can afterwards say *"the
reviewer found a bug, sent it back, and the coder fixed it"* — the design has done its job.
