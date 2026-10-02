# Admin operations

The admin area provides an attention queue, run diagnostics, published API inventory,
user support information, monitoring comparisons, system observations and incident follow-up.
All operations endpoints require an administrator account.

## Attention and diagnostics

The queue includes active runs regardless of age and failures from the last seven days.
It returns up to 100 items, prioritizing active work before recent failures. The overview
shows the first 12 and the full matching count. No recorded update for 15 minutes marks
active work urgent; approvals waiting 30 minutes are also urgent. These are inspection
heuristics, not proof that execution has stopped. Failure guidance provides a safe
explanation and next step without exposing raw provider errors.

## Published APIs and user support

API hosting shows ownership, deployment state and read-only Docker observations:
startup readiness, current memory usage and start time. Unavailable Docker inspection
is shown as unknown. These observations do not establish historical uptime.

Stopping a published API requires an explicit reason and confirmation. It removes the
container and its runtime data volume using the existing deployment cleanup operation.
Both the request and successful completion are audited. Failed cleanup retains a deleting
record so an administrator can retry after Docker recovers. API keys are never included
in the inventory response.

User support shows actual runs created in the current UTC calendar month alongside
the configured limit, active unexpired sessions at the current token version, failed runs
and published APIs. Links open runs filtered to that account.

## Freshness, filters and incidents

Overview, monitoring, system, hosting, support and incident resources refresh every
minute while the page is visible and on returning to it. Timestamps indicate the last
successful fetch. Requests reject stale results and avoid overlapping refreshes.
Runs, users and audit filters are preserved in the URL; run tables have mobile cards.

Monitoring compares equal current and preceding time windows. Provider observations
come from recorded run attempts, not active probes; observations older than one hour
are marked stale, and providers with no recorded attempt are marked not observed.

Incidents group failures from the last seven days by outcome and UTC day. Administrators
can acknowledge or resolve a group with an internal note. Notes are retained (latest 30
per group), updates are audited, and a newer failure reopens the group. Grouping is a
follow-up aid, not automatic root-cause correlation. Incident state is stored in the
`admin_incidents` collection. This work does not close the phase observer or benchmark
requirements.

## Validation

Backend tests cover authorization, safe diagnostics, support counts, incident reopening,
equal comparison windows and deployment cleanup outcomes. Browser regressions cover
attention refresh, required stop reasons, incident notes, persistent run filters, mobile
layouts, monitoring periods, live search and user deletion safeguards. Docker stop actions
are mocked in these tests; they do not stop a user's published API.
