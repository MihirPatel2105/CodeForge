#!/bin/sh
# Start mongod, wait for it, then run the generated test suite.
#
# Output contract (docs/STATE_AND_API.md §5): pytest's stdout and stderr become the
# container log, and its exit status becomes the container's. mongod's own chatter is
# kept in a separate file so it cannot be mistaken for test output.
set -u

MONGO_LOG=/tmp/mongod.log

mongod --dbpath /data/db --bind_ip 127.0.0.1 --quiet > "$MONGO_LOG" 2>&1 &
MONGO_PID=$!

# Wait for mongod to accept connections. There is no network, so this is a purely local
# check; the ceiling exists so a broken mongod fails the run instead of hanging it until
# the runner's timeout fires.
i=0
while [ "$i" -lt 60 ]; do
    if python -c "import socket;socket.create_connection(('127.0.0.1',27017),0.5)" 2>/dev/null; then
        break
    fi
    i=$((i + 1))
    sleep 0.5
done

if ! python -c "import socket;socket.create_connection(('127.0.0.1',27017),0.5)" 2>/dev/null; then
    echo "SANDBOX ERROR: mongod did not start within 30s" >&2
    tail -20 "$MONGO_LOG" >&2
    exit 70
fi

cd /app
# -p no:cacheprovider: /app is mounted read-only, and pytest's cache
# warnings would otherwise pollute every run's captured output.
python -m pytest -q --tb=short -p no:cacheprovider
PYTEST_STATUS=$?

kill "$MONGO_PID" 2>/dev/null
exit "$PYTEST_STATUS"
