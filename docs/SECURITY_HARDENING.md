# Security hardening status

## Completed controls

- Both Compose configurations omit host Docker socket mounts. Sandbox daemons use
  mutual TLS; development backend, MongoDB and Langfuse ports bind to localhost.
- SSE streams revalidate signed tokens, expiry, revocation, account state and run
  ownership before replay/event delivery and every idle heartbeat (15 seconds).
  Authentication or storage failures close the stream.
- The frontend proxy and backend bound uploads to 1 MiB, including chunked bodies,
  with a 30-second upload deadline. Rejected requests never reach application routes.
- Execution, preview and publication containers drop all capabilities, forbid
  privilege escalation, run without network and use a read-only root filesystem.
  Only disposable application/database volumes and a restricted 64 MiB tmpfs are
  writable. Published database volumes survive recreation. Older containers are
  replaced before reuse if they lack these controls.
- Frontend responses carry anti-framing, nosniff, referrer and permissions headers.
  Page responses use a fresh script nonce and strict CSP. Rendering is dynamic so
  cached HTML cannot reuse a nonce. Inline styles remain allowed for Motion.
- JWT signing/verification uses PyJWT while preserving existing claims and sessions.
  Vulnerable ECDSA dependencies were removed. Patchable npm/Python dependencies and
  sandbox packages were upgraded; shadcn tooling is a development dependency.

## Remaining upstream and infrastructure limits

The dependency scans still identify unpatched Chroma 1.5.9 advisories and a `braces`
advisory in development tooling. CodeForge uses an embedded, ephemeral Chroma client,
not the Chroma HTTP server. Its collection/embedding configuration comes from trusted
application code, never user-supplied configuration; telemetry and reset are disabled.
This reduces exposure but does not make the package advisories resolved. No stack
change or unsafe forced dependency downgrade was applied.

A separate TLS sandbox host is still required. Set `SANDBOX_DOCKER_HOST` and
`SANDBOX_DOCKER_CERTS_DIR` and build the sandbox image on that host. Without this
configuration, Compose sandbox execution is unavailable. Tests against the local
Docker daemon verify container controls, not separation from a future production host.
Actual remote-host isolation, certificates, firewall and public HTTPS headers must be
verified when deployment infrastructure exists. No production deployment was performed.

Dependency findings are a point-in-time check, not proof against all possible attacks.

## Verification on 2026-10-03

- Full backend suite with live sandbox/publication coverage: 456 passed, 12 skipped.
- Three additional open-stream tests verified real token revocation, password-reset
  token generation changes and account suspension; focused stream/sandbox run: 28 passed.
- Production frontend build, lint and TypeScript checks passed.
- CI browser regression set, including CSP and chunked proxy rejection: 31 passed.
- Frontend production dependency audit: zero advisories.
- Sandbox Python dependency audit: zero advisories.
- Backend Python dependency audit: Chroma only (five records, four unique advisories).

The local Docker tests preserve named publication data while migrating a container
that lacks the new restrictions, and confirm disposable volumes do not leak. Tests
do not exercise paid providers or deploy public infrastructure.
