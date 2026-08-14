# CodeForge

A multi-agent AI platform that automates the software development life cycle. Describe an app in
plain English and five role-based agents — PM, Architect, Coder, Reviewer, Tester — collaborate
through a LangGraph workflow to produce a working, tested CRUD REST API, executed live in a Docker
sandbox and streamed to a dashboard.

Architecture and stack decisions live in [CLAUDE.md](CLAUDE.md); build plan in
[docs/PHASES.md](docs/PHASES.md).

## Prerequisites

- Docker Desktop
- Python 3.11
- Node.js 20+
- git

## Local setup

```bash
git clone https://github.com/MihirPatel2105/CodeForge.git
cd CodeForge
```

### 1. Environment file

Each developer keeps their own `.env` — it is never committed.

```bash
cp backend/.env.example backend/.env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # paste into JWT_SECRET
```

Add your own free-tier API keys. Groq is the minimum needed to run anything; the rest back the
fallback chains. Do not share keys between team members — free tiers are rate-limited per account.

| Key | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) |
| `CEREBRAS_API_KEY` | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) |
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) — AI Studio, **not** Google Cloud/Vertex, which is paid |

### 2. Start the stack

```bash
docker compose up -d
```

Brings up `mongo`, `backend` (:8000), and `langfuse` (:3000). First run pulls ~1GB of images.

### 3. Langfuse keys (second pass)

These do not exist until Langfuse is running, so this step comes after `compose up`:

1. Open <http://localhost:3000>, sign up, create an organization, then a project.
2. **Settings → API Keys → Create new API key.**
3. Copy both into `backend/.env` as `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`.

The secret key is displayed only once. Langfuse runs locally, so these keys are per-machine — one
developer's keys will not work for another.

### 4. Backend dev environment

Needed for tests, linting, and running uvicorn directly. Create the venv at `backend/.venv` so the
committed VS Code interpreter setting resolves.

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cd .. && pre-commit install     # git hooks are not cloned; install once per clone
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is **not** part of docker-compose and runs separately. Port 3000 is taken by Langfuse,
so Next.js will offer 3001.

## Verify the setup

```bash
curl localhost:8000/health                            # {"status":"ok"}

cd backend && source .venv/bin/activate
pytest                                                # 1 passed
PYTHONPATH=. python scripts/smoke_llm.py              # completion + Langfuse trace
```

The smoke script makes one LiteLLM call through Groq and traces it to Langfuse — it verifies keys,
routing, and observability in one shot. Check the trace appears in the Langfuse UI.

## Notes

- **No hot-reload in the backend container.** `uvicorn` runs without `--reload`, so changes to
  `backend/app/` need `docker compose restart backend`. For active development, run uvicorn from
  the venv on the host instead.
- **After any `requirements.txt` change, rebuild:** `docker compose build backend`. The container
  mounts `backend/app` but bakes dependencies into the image, so new code arrives without its
  new packages and the container crash-loops on `ModuleNotFoundError`.
- `docker compose down` stops the stack; add `-v` to also wipe the Mongo and Langfuse volumes.
- Ollama is the last-resort fallback in every model chain. Install it and pull one small model
  (`ollama pull qwen2.5:3b`) before Phase 3.

## Contributing

1. Fork the repository and create a branch off `main`.
2. Make your changes.
3. Open a pull request describing what changed and why.

## License

[MIT](LICENSE)
