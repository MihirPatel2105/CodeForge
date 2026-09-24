#!/bin/sh
# Keep a private MongoDB available for one short preview session. Docker removes the
# container automatically when this process exits, including after backend restarts.
set -u

mongod --dbpath /data/db --bind_ip 127.0.0.1 --quiet > /tmp/preview-mongod.log 2>&1 &
MONGO_PID=$!
trap 'kill "$MONGO_PID" 2>/dev/null || true' EXIT TERM INT

i=0
while [ "$i" -lt 60 ]; do
    if python -c "import socket;socket.create_connection(('127.0.0.1',27017),0.5)" 2>/dev/null; then
        touch /tmp/codeforge-preview-ready
        sleep 900
        exit 0
    fi
    i=$((i + 1))
    sleep 0.5
done

echo "Preview MongoDB did not start" >&2
exit 70
