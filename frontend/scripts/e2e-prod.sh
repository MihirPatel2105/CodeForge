#!/usr/bin/env bash
# Run the Playwright suite against a production build and `next start`, as CI does, without
# touching the dev server.
#
# The dev server (next dev --turbopack) sometimes answers a real page with a 404 while it compiles
# under parallel load, which shows up as random "element not found" failures. A production build
# never does that. The build happens in a temporary copy so the running dev server's .next is
# left alone.
#
# Usage (from frontend/):
#   npm run test:e2e:prod                                  # whole suite
#   npm run test:e2e:prod -- tests/e2e/auth-horizon.spec.ts --workers=3
# Environment: E2E_PROD_PORT (default 3100), E2E_PROD_KEEP=1 to keep the build copy afterwards.
set -euo pipefail

FRONTEND="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${E2E_PROD_PORT:-3100}"
COPY="${TMPDIR:-/tmp}/codeforge-e2e-prod"
SERVER_PID=""
LISTENER_PID=""
READY_TIMEOUT_SECONDS=120

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  # npm starts Next.js as a child that renames itself `next-server`, so stopping npm is not
  # enough: stop the exact process that was listening on the port once the server came up.
  if [[ -n "$LISTENER_PID" ]] && kill -0 "$LISTENER_PID" 2>/dev/null; then
    kill "$LISTENER_PID" 2>/dev/null || true
  fi
  if [[ "${E2E_PROD_KEEP:-0}" != "1" && "$COPY" == */codeforge-e2e-prod ]]; then
    rm -rf "$COPY"
  fi
}
trap cleanup EXIT INT TERM

if curl --silent --output /dev/null "http://127.0.0.1:$PORT/"; then
  echo "Port $PORT is already in use. Set E2E_PROD_PORT to a free port." >&2
  exit 1
fi

echo "→ Copying the frontend to $COPY"
mkdir -p "$COPY"
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude test-results --exclude playwright-report \
  "$FRONTEND/" "$COPY/"
ln -sfn "$FRONTEND/node_modules" "$COPY/node_modules"

# Plain `next build` (webpack) rather than `npm run build` (Turbopack): Turbopack will not resolve
# packages through the copy's symlinked node_modules, which sits outside the copy's root.
echo "→ Building for production (next build)"
(cd "$COPY" && NEXT_TELEMETRY_DISABLED=1 npx next build > "$COPY/build.log" 2>&1) || {
  echo "Build failed; last lines of $COPY/build.log:" >&2
  tail -30 "$COPY/build.log" >&2
  exit 1
}

echo "→ Starting the production server on port $PORT"
(cd "$COPY" && NEXT_TELEMETRY_DISABLED=1 npm run start --silent -- --hostname 127.0.0.1 --port "$PORT" > "$COPY/start.log" 2>&1) &
SERVER_PID=$!

for _ in $(seq 1 "$READY_TIMEOUT_SECONDS"); do
  if curl --fail --silent --output /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "The production server exited; see $COPY/start.log" >&2
    exit 1
  fi
  sleep 1
done
curl --fail --silent --output /dev/null "http://127.0.0.1:$PORT/" || {
  echo "The production server did not answer within ${READY_TIMEOUT_SECONDS}s" >&2
  exit 1
}
LISTENER_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true)"

echo "→ Running Playwright against http://127.0.0.1:$PORT"
cd "$FRONTEND"
E2E_BASE_URL="http://127.0.0.1:$PORT" npx playwright test "$@"
