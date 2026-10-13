# Failed Stage Retry Implementation Plan

**Goal:** Recover stopped provider failures without rerunning successful earlier stages.
**Scope:** Same run and checkpoint, three manual retries maximum. Preserve loop budgets, files, usage limits, ownership and human approvals. Coder recovery initially supports missing files before repair loops only. Other failure categories remain ineligible.
**Architecture:** A pure recovery policy selects the earliest missing output with an actual provider-exhaustion record. An owner-only GET/POST retry route validates the terminal checkpoint, atomically claims the run, reserves normal usage capacity, and dispatches a tracked executor task. A run.retried event resets only relevant UI stages, and SSE replay skips superseded terminal events.
**Tech Stack:** Existing FastAPI, LangGraph/Mongo checkpoints, Next.js and SSE.

1. Test recovery eligibility, preserved loop history and approval requirements; implement the policy and partial Coder recovery.
2. Test real in-memory graph recovery and existing interrupt behavior, route concurrency, ownership, limits and rollback; implement bounded admission and executor dispatch.
3. Test stream replay past earlier failures; add run.retried contract and retain monotonic event IDs.
4. Test retry in the browser, failure handling, repeated attempts and reload; add an existing-style retry button and reconnect support.
5. Run isolated backend tests, appropriate regression checks, frontend lint/type/build/browser checks. Review failure and cancellation paths. Do not spend real provider quota for validation.

Review focus: stale/missing checkpoints; two retry submissions racing; cancellation while reserving capacity; repeated failures across reloads; PM/Architect approvals after regeneration.

User approved implementation by saying “do it”; implementation proceeds in this chat.
