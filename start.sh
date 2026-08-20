#!/usr/bin/env bash
#
# Start CodeForge for local development or a demo.
#
# Brings up the Docker stack (backend, mongo, langfuse), waits until the backend
# actually answers, then hands the terminal over to the Next.js dev server.
#
#   ./start.sh            start everything
#   ./start.sh --check    verify the environment and exit without starting anything
#
# Ctrl-C stops the frontend. The containers keep running; `docker compose down`
# stops those.

set -euo pipefail

# Resolve the repo from this script's own location, so it works from any
# directory and on any machine — not just the one it was written on.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"

PORT=3001
SANDBOX_IMAGE="codeforge-sandbox:latest"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

# ---------------------------------------------------------------------------
bold "1/4  Docker"

if ! command -v docker >/dev/null 2>&1; then
  die "Docker is not installed. Install Docker Desktop first."
fi

if ! docker info >/dev/null 2>&1; then
  # Installing Docker Desktop does not start its engine, and every compose
  # command fails until it is up. Launch it and wait rather than failing.
  warn "Docker engine is not running — starting Docker Desktop…"
  open -a Docker 2>/dev/null || die "Could not launch Docker Desktop. Open it manually."

  for _ in $(seq 1 90); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done

  docker info >/dev/null 2>&1 || die "Docker did not become ready in 3 minutes. Check Docker Desktop."
fi
ok "Docker engine ready"

# The sandbox image is not a compose service, so nothing builds it automatically.
# Without it every run gets to the Sandbox stage and dies there.
if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
  ok "Sandbox image present"
else
  warn "Sandbox image '$SANDBOX_IMAGE' is missing — generated apps cannot be tested."
  warn "Build it once with:  docker build -t $SANDBOX_IMAGE ./sandbox"
fi

# ---------------------------------------------------------------------------
bold "2/4  Backend stack"

[[ -f "$ROOT/backend/.env" ]] || warn "backend/.env not found — the backend will not start without it."

if $CHECK_ONLY; then
  ok "Skipping startup (--check)"
else
  docker compose -f "$ROOT/docker-compose.yml" up -d
  ok "Containers up"

  printf "  waiting for the backend to answer"
  for _ in $(seq 1 45); do
    if curl -fsS -m 2 http://localhost:8000/health >/dev/null 2>&1; then
      printf "\n"; ok "Backend healthy on :8000"
      break
    fi
    printf "."
    sleep 2
  done

  curl -fsS -m 2 http://localhost:8000/health >/dev/null 2>&1 || {
    printf "\n"
    warn "Backend did not answer in 90s. Check:  docker compose logs -f backend"
    warn "A hang here usually means Atlas is unreachable — see the setup guide."
  }
fi

# ---------------------------------------------------------------------------
bold "3/4  Frontend"

[[ -d "$FRONTEND" ]] || die "No frontend directory at $FRONTEND"

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  warn "node_modules missing — installing (this takes a minute)…"
  (cd "$FRONTEND" && npm install)
fi
ok "Dependencies present"

# Port 3000 belongs to Langfuse, so the frontend always runs on 3001. If something
# already holds it, say so plainly instead of letting Next silently pick another
# port and leaving you on the wrong URL.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  warn "Port $PORT is already in use — the frontend is probably already running."
  warn "Open http://localhost:$PORT , or stop the other process and re-run this."
  exit 0
fi

if $CHECK_ONLY; then
  ok "Port $PORT free"
  bold "Environment looks good."
  exit 0
fi

# ---------------------------------------------------------------------------
bold "4/4  Ready"
printf "\n"
printf "  App        \033[1mhttp://localhost:%s\033[0m\n" "$PORT"
printf "  API        http://localhost:8000\n"
printf "  Tracing    http://localhost:3000\n"
printf "\n"
printf "  Ctrl-C stops the frontend. Containers keep running.\n\n"

cd "$FRONTEND"
exec npm run dev -- -p "$PORT"
