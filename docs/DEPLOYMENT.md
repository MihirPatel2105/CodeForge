# Deployment preparation

CodeForge's agreed layout is a Next.js frontend on Vercel and a Docker-capable host for the
FastAPI backend and sandbox. The browser needs a public HTTPS API origin; `localhost:8000`
inside a visitor's browser points at the visitor's computer. MongoDB Atlas holds application
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

The host needs Docker Engine with Compose, enough space for the backend and sandbox images,
outbound access to Atlas and the configured AI providers, and a clone of this repository.
The backend container mounts the host Docker socket because it launches isolated sibling
sandboxes; access to that socket is privileged. Limit host access accordingly.

Create `backend/.env` from `backend/.env.example`. Keep it private. Set at least:

```dotenv
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.<id>.mongodb.net/?appName=<cluster>
MONGO_DB=codeforge_deploy
JWT_SECRET=<unique-random-value-at-least-32-characters>
CORS_ORIGINS=["https://app.example.com"]
APP_BASE_URL=https://app.example.com
SMTP_USER=<mail-account>
SMTP_PASSWORD=<app-password>
GROQ_API_KEY=<provider-key>
```

Use real values, never commit this file. The frontend origin controls CORS, email links,
and passkey verification. Set the other available provider keys for fallback. The static
configuration check requires one active provider key; the live provider check below tests
whether an agent can actually reach a model. Configure Atlas network access for the backend
host and a database user with access to `MONGO_DB`. Use a separate database name and a new
JWT secret for this deployment so it cannot read the localhost demo's users, runs, or sessions.
If both environments use the same provider keys, their free-tier request quotas still overlap.

Create `deployment.env` from `deployment.env.example` and replace all placeholder secrets.
The Langfuse database password must be URL-safe alphanumeric text because Compose places it
inside `DATABASE_URL`. Do not rotate these values without planning the Langfuse database
credentials and session impact. `deployment.env` is ignored by Git.

Run the static checks from the repository root:

```bash
docker compose --env-file deployment.env -f compose.deploy.yml config --quiet
cd backend
.venv/bin/python scripts/check_deployment.py --api-url https://api.example.com
cd ..
```

If the virtual environment is not installed, use the container command after starting the
stack. The check prints configuration problems without printing secrets. It does not contact
Atlas, the API endpoint, or AI providers.

## 3. Start and verify the backend stack

```bash
docker build -t codeforge-sandbox:latest ./sandbox
docker compose --env-file deployment.env -f compose.deploy.yml up -d --build
docker compose --env-file deployment.env -f compose.deploy.yml ps
docker compose --env-file deployment.env -f compose.deploy.yml exec -T backend python scripts/check_deployment.py --api-url https://api.example.com
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
Use the existing Next.js build script and `npm` lockfile. Set the project environment variable
`NEXT_PUBLIC_API_URL=https://api.example.com` for Production. This value is baked into the
browser bundle at build time, so redeploy the frontend after changing it. Point the frontend
domain at the stable origin used by `APP_BASE_URL` and `CORS_ORIGINS`.

Do not add backend keys or MongoDB credentials to Vercel. Its frontend needs only the public
API URL. A deployed HTTPS page calling an HTTP API will be blocked by browsers.

## 5. Acceptance before inviting users

Verify a browser session on the real frontend and API origins: sign up with an email code,
sign in, create a project, start a run, approve both checkpoints, observe streaming updates,
and download the generated artifact. Test password reset and a passkey on the stable frontend
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
