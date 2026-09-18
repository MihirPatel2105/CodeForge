#!/usr/bin/env bash
# Start CodeForge for local development or a live demo.
#
#   ./start.sh             start the full project
#   ./start.sh --demo      start it after a live AI-provider preflight
#   ./start.sh --check     verify prerequisites without changing anything
#   ./start.sh --stop      stop the Docker services
#
# While the project is running, Ctrl-C stops both the frontend and Docker stack.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
COMPOSE_FILE="$ROOT/docker-compose.yml"

PORT=3001
SANDBOX_IMAGE="codeforge-sandbox:latest"
MODE="start"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: ./start.sh [--demo | --check | --stop | --help]

  no option   Start Docker services and the frontend
  --demo      Also verify the configured AI providers before starting the frontend
  --check     Check prerequisites without starting or installing anything
  --stop      Stop the CodeForge Docker services
  --help      Show this help
EOF
}

case "${1:-}" in
  "") MODE="start" ;;
  --demo) MODE="demo" ;;
  --check) MODE="check" ;;
  --stop) MODE="stop" ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; die "Unknown option: $1" ;;
esac

command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install Docker Desktop first."

if [[ "$MODE" == "stop" ]]; then
  if ! docker info >/dev/null 2>&1; then
    ok "Docker is already stopped"
    exit 0
  fi
  docker compose -f "$COMPOSE_FILE" stop
  ok "CodeForge Docker services stopped"
  exit 0
fi

bold "1/4  Prerequisites"

command -v npm >/dev/null 2>&1 || die "Node.js/npm is not installed. Install Node.js 20 or newer."
command -v curl >/dev/null 2>&1 || die "curl is required but was not found."
command -v lsof >/dev/null 2>&1 || die "lsof is required but was not found."
[[ -f "$ROOT/backend/.env" ]] || die "backend/.env is missing. Create it from backend/.env.example."
[[ -d "$FRONTEND" ]] || die "Frontend directory not found: $FRONTEND"

ok "Required commands and backend/.env present"

if [[ "$MODE" == "check" ]]; then
  CHECK_FAILED=false

  if docker info >/dev/null 2>&1; then
    ok "Docker engine ready"
    if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
      ok "Sandbox image present"
    else
      warn "Sandbox image missing; normal startup will build it automatically"
      CHECK_FAILED=true
    fi
  else
    warn "Docker engine is not running"
    CHECK_FAILED=true
  fi

  if [[ -d "$FRONTEND/node_modules" ]]; then
    ok "Frontend dependencies present"
  else
    warn "Frontend dependencies missing; normal startup will install them"
    CHECK_FAILED=true
  fi

  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port $PORT is already in use"
    CHECK_FAILED=true
  else
    ok "Port $PORT available"
  fi

  if $CHECK_FAILED; then
    warn "Setup needs attention; run ./start.sh to repair/start what it can"
    exit 1
  fi

  bold "Environment is ready."
  exit 0
fi

bold "2/4  Docker"

if ! docker info >/dev/null 2>&1; then
  warn "Docker engine is not running — starting Docker Desktop…"
  if [[ "$(uname -s)" != "Darwin" ]]; then
    die "Start the Docker engine, then run this command again."
  fi
  open -a Docker 2>/dev/null || die "Could not launch Docker Desktop. Open it manually."

  for _ in $(seq 1 90); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done

  docker info >/dev/null 2>&1 || die "Docker did not become ready in 3 minutes. Check Docker Desktop."
fi
ok "Docker engine ready"

if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
  ok "Sandbox image present"
else
  warn "Sandbox image missing — building it now (first run only)…"
  docker build -t "$SANDBOX_IMAGE" "$ROOT/sandbox"
  ok "Sandbox image built"
fi

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  warn "Frontend dependencies missing — installing them now (first run only)…"
  if [[ -f "$FRONTEND/package-lock.json" ]]; then
    (cd "$FRONTEND" && npm ci)
  else
    (cd "$FRONTEND" && npm install)
  fi
fi
ok "Frontend dependencies present"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  die "Port $PORT is already in use. Stop that process, then run ./start.sh again."
fi

bold "3/4  Backend stack"

STACK_STARTED=false
cleanup() {
  if $STACK_STARTED; then
    printf "\n"
    warn "Stopping CodeForge services…"
    docker compose -f "$COMPOSE_FILE" stop >/dev/null 2>&1 || true
    ok "CodeForge stopped"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

docker compose -f "$COMPOSE_FILE" up -d
STACK_STARTED=true
ok "Containers started"

printf "  waiting for the backend to answer"
BACKEND_READY=false
for _ in $(seq 1 45); do
  if curl -fsS -m 2 http://localhost:8000/health >/dev/null 2>&1; then
    BACKEND_READY=true
    break
  fi
  printf "."
  sleep 2
done
printf "\n"

if ! $BACKEND_READY; then
  docker compose -f "$COMPOSE_FILE" logs --tail=30 backend >&2 || true
  die "Backend did not become healthy in 90 seconds."
fi
ok "Backend healthy on :8000"

if [[ "$MODE" == "demo" ]]; then
  warn "Running live AI-provider preflight…"
  if ! docker compose -f "$COMPOSE_FILE" exec -T backend python scripts/preflight.py; then
    die "No working model chain is available. Wait for provider limits before the demo."
  fi
  ok "Every agent has a working model provider"
fi

bold "4/4  Ready"
printf "\n"
printf "  App        \033[1mhttp://localhost:%s\033[0m\n" "$PORT"
printf "  API        http://localhost:8000\n"
printf "  Tracing    http://localhost:3000\n"
printf "\n"
printf "  Keep this terminal open. Press Ctrl-C to stop everything.\n\n"

cd "$FRONTEND"
npm run dev -- -p "$PORT"
