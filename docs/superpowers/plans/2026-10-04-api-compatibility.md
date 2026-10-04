# API compatibility implementation plan

**Goal:** explain breaking contract changes between a successful revision and its parent.

**Scope approved in chat:** deterministic OpenAPI comparisons, removed routes,
incompatible request/response fields, and warnings in the existing version panel.
Incomplete comparisons say “Needs review”. Publishing remains an explicit user action.

**Architecture:** reuse owner-checked temporary previews to read actual OpenAPI documents
on an explicit check. A pure comparator returns structured findings. A shared panel
displays the report in run versions and before publishing a revision. No new dependency,
LLM call, database collection, or change to agent generation.

## Tasks

- [x] Add regression tests for removed routes, newly required inputs, response removals,
  nested/reference schemas, nullable types, directional enum/type changes, and incomplete
  documents. Unsupported constraints must not silently become a compatible verdict.
- [x] Implement `compare_openapi(before, after)` in `backend/app/core/api_compatibility.py`
  and structured report schemas in `backend/app/schemas/api.py`.
- [x] Add `POST /runs/{id}/compatibility` to `backend/app/api/preview.py`: verify ownership
  and passed status of both runs before sandbox access; reject invalid lineage; fetch
  bounded documents sequentially; return a calm Needs-review report on unavailable previews.
- [x] Test the HTTP route, including cross-owner parents, unpublished/failed versions,
  malformed/truncated schemas, and provider/runtime details never reaching public reports.
- [x] Add typed client/report shapes and a reusable compatibility panel. Mount it for
  successful revisions in run versions and in Publish. Explicit checks, retry, readable
  status labels, affected operation/field, and limitations; no automatic publishing.
- [x] Add browser coverage to the existing workspace regression file for all verdicts,
  retry/loading, publish visibility, original-run absence, and mobile overflow.
- [x] Run backend suite, Ruff, frontend lint/types/build/browser checks. Review the diff,
  document limits and verification, commit exactly these files, and push the feature branch.

## Review focus

Request compatibility means accepting old inputs; response compatibility means returning
values old clients understand. Missing references, recursive schemas, unhandled compositions,
security/media changes and truncated documents require review. Published state, API keys,
and existing preview data are not modified by a compatibility check. Passing contract checks
does not prove runtime behavior or data migration safety. Phase 7's human-observer criterion
and Phase 8's provider benchmark remain open.

## Verification

Full backend suite: 502 passed / 25 opt-in skipped. Focused production-browser suite:
18 passed. Real sandbox/route suite: 25 passed, with the final compatibility live
recheck passing after scalar-union support. Ruff/format, ESLint, TypeScript,
production build, and whitespace checks passed. Implementation is ready for
commit and publication on `codex/api-compatibility`.
