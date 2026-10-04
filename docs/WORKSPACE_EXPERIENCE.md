# Workspace experience

## Start and organize

The project composer offers task, book, and inventory templates. Choosing a template
is explicit; when a draft exists, the action says it replaces the draft. Guidance
keeps requests within the supported one- or two-entity CRUD domain.

Drafts save the prompt, example-library setting, and optional source run on the
current device, scoped to account and project. They are not cloud-synced. Any past
run can supply a prompt for another run. Revising a prior revision retains the
original source link when the prompt is reused.

Project management supports renaming, descriptions, archiving, and restoring.
Archiving only changes which Projects view lists the workspace. It does not delete
runs, stop active runs, or unpublish APIs. Run history supports server-side prompt
search and outcome filtering across paginated results.

## Review and revise checkpoints

The requirements checkpoint displays entities, field types, required/default rules,
user stories, and out-of-scope requirements. The design checkpoint displays routes,
request/response models, status codes, and design notes.

- Approve continues the existing graph from its checkpoint.
- Request changes requires a note and reruns the PM or Architect, then pauses again.
- Reject ends the run.

Each checkpoint allows at most three user-requested revisions, independent of the
existing autonomous review/test loop budgets. Revision notes are persisted in graph
state and supplied to the corresponding agent. The previous phase output is
invalidated before revision. Events distinguish revision requests from rejections.

The API checks ownership, phase, current status, and the client's revision number.
An atomic database claim prevents duplicate decisions from launching parallel work.
Old callers may omit the revision number; the new UI always sends it. Final human
judgement remains a record on a terminal run, not a pipeline restart.

## Build another API version

“Improve this API” is available on a successful run with passing tests. It creates a
new run with `parent_run_id`, the requested change, and a snapshot of the source
requirements/design/files. The PM receives the previous requirements, and the
Coder receives the corresponding source file to preserve unaffected behavior.

The new version goes through requirements/design approvals, review, and tests.
The source remains accessible; changed application/test files and source/current
test outcomes are compared in the new run's version panel. Publishing the new API
is explicit and uses its own existing Publish flow. This feature does not migrate
published data or replace a previous API's URL/key.

## Check API compatibility

Successful, tested revisions show **Check compatibility** in the version panel
and on Publish. Clicking it reads the source and new API's actual OpenAPI documents
through owner-only temporary previews, then compares them without an LLM call.
Both runs must belong to the same owner and project and have passing sandbox tests.
The check starts or reuses previews; existing preview data and published APIs are
not changed. Preview capacity and the existing 15-minute lifetime still apply.

Findings identify the affected endpoint and field, with three possible verdicts:

- **Breaking changes detected:** a removed endpoint/response status, newly required
  request input/body/parameter, incompatible value type or enum, tighter request
  limits, or a removed/weakened response field guarantee.
- **No breaking changes detected:** the supported checks found no incompatibility.
  Requests are checked for continued acceptance of old inputs; responses for
  preservation of values and guarantees old clients expect. Added optional fields
  and endpoints are normally compatible for clients that ignore extra fields.
- **Needs review:** the check is incomplete, including unavailable/truncated schemas,
  removed request fields/parameters, missing or recursive references, general schema
  compositions, formats/patterns, additional properties, non-JSON media, response
  headers, authentication, and changed server addresses. Known breaking findings
  take precedence in the headline; review findings remain visible alongside them.

Local schema references, nested objects/arrays, simple nullable schemas and plain
scalar `anyOf` unions (including FastAPI's validation-error location items)
are supported for OpenAPI 3.0/3.1. Each document is bounded to 64 KiB, 100 operations,
and 16 schema/reference levels; reports are capped at 200 findings plus a review
notice. The endpoint count covers shared operation comparisons. Reports are fresh
and are not persisted; reload or navigate to another page to check again. A retry
clears the previous result so a failed check cannot leave a clean verdict visible.

Warnings do not block publishing or change the approval pipeline. This checks
contract compatibility, not runtime behavior, actual response conformance, client
assumptions about extra fields, or database migrations. Those need separate tests.

Compatibility verification (2026-10-04): full backend suite **502 passed / 25
opt-in tests skipped**; production-browser workspace/tester/security checks **18
passed**; the live sandbox/route suite **25 passed**, followed by a final real-Docker
compatibility recheck **1 passed** after scalar-union support. Backend Ruff/format,
frontend ESLint/TypeScript, production build, and whitespace checks passed. Real
schema extraction used isolated fixture apps; this is not a live-provider generation
benchmark or the first-time human observer study.

## Updates and progress

The header inbox polls owner-scoped pending approvals and recent terminal runs.
Read markers and the optional browser-notification preference are scoped to the
account on this device. Browser notifications require an explicit user click and
browser permission, and work while CodeForge remains open. They are not background
push notifications after closing the app.

The live page reports stage elapsed time and last event time, shows a compact
vertical pipeline on small screens, and keeps the relevant next action available.
No estimated completion percentage is fabricated.

## API tester

Requests can be edited as JSON or through fields derived from the generated API's
OpenAPI request schema. Invalid typed numbers/structured values block sending in
field mode. Optional fields can be omitted. JSON remains available for complex
request shapes.

Saved requests persist on this device per account/run; loading one never sends it.
The last ten responses remain available during the current page visit, with stored
response previews bounded to 20 KB. A successful create response can supply its ID
to another route for the same collection. Reset clears remembered IDs and recent
responses. An optional CRUD walkthrough explains the sequence without sending
requests automatically.

## Verification and remaining human check

`backend/tests/test_workspace_experience.py` covers owner boundaries, archive/restore,
source immutability, filters, revision caps, stale decisions, and real LangGraph
rewinds. Its HTTP/Mongo/graph integration test replaces external model responses
with deterministic values. `frontend/tests/e2e/workspace-experience.spec.ts` covers
the user workflows, version comparisons, draft persistence, and mobile overflow.
The browser suite runs in the existing CI workflow.

Automated checks cannot satisfy the first-time human observer criterion in
`docs/USABILITY_CHECK.md`. A real novice walkthrough and live provider-generated
revision quality remain separate acceptance checks; neither is implied by mocked
model/browser tests or a successful production build.

Verification recorded for this implementation: backend suite 381 passed / 20
opt-in tests skipped; production-browser checks 17 passed; frontend lint, TypeScript,
production build, backend lint/format, and whitespace checks passed. These results
cover deterministic integration and browser behavior, not a live-provider quality
benchmark or the first-time human observer study.
