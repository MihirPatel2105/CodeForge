# Admin operations

The admin area provides an attention queue, run diagnostics, published API inventory,
user support information, monitoring comparisons, system observations and incident follow-up.
All operations endpoints require an administrator account.

## Admin security

Admin access requires the configured `ADMIN_EMAIL` account, verified email, and an active
server-recorded login session at the account's current token version. The session must
have completed authenticator verification or a user-verified passkey assertion within
the last hour. Password-only, signup, password reset and recovery-code sessions do not
grant admin access. Old sessions have no strong-auth timestamp and fail closed.

To access admin after upgrading, enable an authenticator or passkey in account security
and sign in again with it. Recovery remains available for ordinary account access and
replacing lost authentication factors. An account whose email has not been verified
cannot operate admin controls; offline development fixtures simulate mail verification.

The browser checks access before mounting admin pages, removes them at expiry and when
the backend rejects the proof, and rechecks after returning to the tab. The server guard
enforces every admin endpoint, including exports, independently of the browser.
Admin responses use `Cache-Control: no-store`; CSV exports neutralize user-controlled
spreadsheet formulas. The existing HttpOnly cookie proxy and mutation origin checks
remain in place.

Redis applies shared per-account limits of 180 reads and 20 mutations per minute,
independent of token or IP. When configured Redis is unavailable, admin operations fail
closed with 503. Production startup requires Redis; offline development without Redis
does not apply these request counters. Existing sign-in/MFA limits remain unchanged.

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
