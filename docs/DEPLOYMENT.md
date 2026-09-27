# Deployment preparation

CodeForge's agreed layout is a Next.js frontend on Vercel and a Docker-capable host for the
FastAPI backend and sandbox. The browser calls the frontend's same-origin `/api/backend` route;
the Next.js server calls the HTTPS API origin. MongoDB Atlas holds application
data. Langfuse and its database stay on the backend host.

This guide prepares a deployment. It does not publish the site or change DNS.

## 1. Choose stable HTTPS origins

Decide on one frontend origin (for example, `https://app.example.com`) and one API origin
(for example, `https://api.example.com`). The API origin must forward HTTPS requests,
including streaming responses, to `127.0.0.1:8000` on the backend host. The HTTPS proxy or
tunnel and DNS are host-specific; provision them before exposing the frontend. Keep ports
8000 and 3000 private. Do not open the Docker API or the Langfuse database to the internet.
For `/runs/{id}/stream`, disable proxy response buffering and allow long-lived connections;
otherwise the dashboard can receive run events late or lose its stream.

Passkeys use the frontend hostname as their relying-party ID. Use a stable frontend hostname
for passkey registration and sign-in. Vercel's changing preview URLs are not included in
production CORS settings and should not be used for passkey acceptance testing.

## 2. Configure the backend host

Use two separate hosts: one for the API stack and one dedicated to untrusted-code
sandboxes. The production backend has no host Docker socket mount. It connects to the
sandbox host's Docker daemon with mutual TLS. Follow
[Docker's TLS daemon guide](https://docs.docker.com/engine/security/protect-access/)
to provision a CA, a server certificate, and a client certificate. Restrict port 2376
at the sandbox host firewall to the API host's private address. Never expose the daemon
to the public internet or share the sandbox host with other workloads or secrets.
The backend can still control this *separate* sandbox host; a compromised backend
therefore remains a risk to that host. This split protects the API host from direct
Docker socket access. Local `docker-compose.yml` keeps its socket for development.

Place `ca.pem`, `cert.pem`, and `key.pem` in a private client-certificate directory on
the API host. Set `SANDBOX_DOCKER_HOST` and `SANDBOX_DOCKER_CERTS_DIR` in `deployment.env`.
Build the sandbox image on the remote daemon before starting the API stack:

```bash
DOCKER_HOST=tcp://sandbox-host.example.com:2376 \
DOCKER_TLS_VERIFY=1 \
DOCKER_CERT_PATH=/absolute/path/to/sandbox-client-certs \
docker build -t codeforge-sandbox:latest ./sandbox
```

Keep the sandbox daemon's data and named volumes persistent; published API containers
and volumes live there. Existing local Docker volumes are not migrated automatically.
Compose also starts a private Redis container for shared limits on public authentication
routes. It has no published port and stores only expiring counters. The backend waits for
Redis at startup; protected routes return `503` if Redis becomes unavailable later.
The Next.js route signs the visitor IP for backend rate limits with `CODEFORGE_PROXY_IP_SECRET`.
Set the same value as `PROXY_IP_SECRET` on the backend. Vercel supplies a sanitized client IP;
only Vercel's ingress IP is signed. On a self-hosted Next.js server, requests fall back to
the proxy's peer IP until a trusted ingress integration is implemented. Direct API clients
still use their peer IP.
If a separate reverse proxy forwards direct API requests, configure `TRUSTED_PROXY_CIDRS` with
**only** its source IP/CIDR. Do not trust arbitrary forwarded headers.

Create `backend/.env` from `backend/.env.example`. Keep it private. Set at least:

```dotenv
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.<id>.mongodb.net/?appName=<cluster>
MONGO_DB=codeforge_deploy
CODEFORGE_ENV=production
JWT_SECRET=<unique-random-value-at-least-32-characters>
PROXY_IP_SECRET=<another-unique-random-value-at-least-32-characters>
API_PUBLIC_BASE_URL=https://api.example.com
CORS_ORIGINS=["https://app.example.com"]
APP_BASE_URL=https://app.example.com
SMTP_USER=<mail-account>
SMTP_PASSWORD=<app-password>
GROQ_API_KEY=<provider-key>
```

Use real values, never commit this file. Production startup rejects a weak JWT secret,
missing SMTP or Redis, missing proxy secret, and non-HTTPS origins. The frontend origin
controls CORS, email links, and passkey verification. Set the other available provider keys for fallback. The static
configuration check requires one active provider key; the live provider check below tests
whether an agent can actually reach a model. Configure Atlas network access for the backend
host and a database user with access to `MONGO_DB`. Use a separate database name and a new
JWT secret for this deployment so it cannot read the localhost demo's users, runs, or sessions.
If both environments use the same provider keys, their free-tier request quotas still overlap.

Create `deployment.env` from `deployment.env.example` and replace all placeholder secrets.
The Langfuse database password must be URL-safe alphanumeric text because Compose places it
inside `DATABASE_URL`. Do not rotate these values without planning the Langfuse database
credentials and session impact. `deployment.env` is ignored by Git.

Check the Compose configuration from the repository root:

```bash
docker compose --env-file deployment.env -f compose.deploy.yml config --quiet
```

The backend container validates the client certificate files and remote Docker TLS
settings at startup. Its deployment check prints configuration problems without
printing secrets; the live Docker ping below checks the actual connection.

## 3. Start and verify the backend stack

```bash
docker compose --env-file deployment.env -f compose.deploy.yml up -d --build
docker compose --env-file deployment.env -f compose.deploy.yml ps
docker compose --env-file deployment.env -f compose.deploy.yml exec -T backend python scripts/check_deployment.py --api-url https://api.example.com
docker compose --env-file deployment.env -f compose.deploy.yml exec -T backend python -c 'import docker; client = docker.from_env(); print(client.ping())'
docker compose --env-file deployment.env -f compose.deploy.yml exec -T backend python scripts/preflight.py
curl -fsS http://127.0.0.1:8000/health
curl -fsS https://api.example.com/health
```

The backend image includes its operational scripts. A green `/health` means the API started;
the provider preflight tests live model availability, but free daily quota can still expire
during a full run. In Langfuse, create a project and put its public and secret keys into
`backend/.env`, then recreate the backend container so traces use those keys.

## 4. Configure Vercel

Import the repository as a Vercel project and set **Root Directory** to `frontend`.
Use the existing Next.js build script and `npm` lockfile. Set these server-side Production
environment variables in Vercel:

```dotenv
CODEFORGE_API_INTERNAL_URL=https://api.example.com
CODEFORGE_FRONTEND_ORIGIN=https://app.example.com
CODEFORGE_PROXY_IP_SECRET=<same-value-as-backend-PROXY_IP_SECRET>
```

Point the frontend domain at the stable origin used by `APP_BASE_URL` and `CORS_ORIGINS`.
The browser never receives the JWT: the Next.js proxy sets a host-only, HttpOnly session
cookie and forwards authenticated calls. It rejects cross-origin state-changing requests.
Existing browser sessions from the old `localStorage` implementation must sign in again.

Do not add backend JWT, AI, or MongoDB credentials to Vercel. Its proxy needs only its own
IP-signing secret and the API origin. Use HTTPS between Vercel and the backend.

## 5. Acceptance before inviting users

Verify a browser session on the real frontend and API origins: sign up with an email code,
sign in, create a project, start a run, approve both checkpoints, observe streaming updates,
and download the generated artifact. Confirm the browser has no JWT in `localStorage` or API
response bodies and that the session cookie is HttpOnly, Secure and SameSite=Lax. Test CSRF
origin rejection, sign-out, password reset and a passkey on the stable frontend
domain. Run two full prompts from a cold start, including one that exercises the repair loop.
Use the admin health page and backend logs for failures; check Langfuse traces if configured.

The 10-prompt evaluation and the non-technical viewer check in `docs/PHASES.md` are separate
project acceptance gates. A local build or green health check does not close them. Record
the test date and result before declaring the public deployment ready.

For routine shutdown, run:

```bash
docker compose --env-file deployment.env -f compose.deploy.yml stop
```

Do not use `down -v` unless intentionally deleting Langfuse data. Atlas data is outside this
Compose stack; arrange its backup separately.
