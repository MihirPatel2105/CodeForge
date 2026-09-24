#!/bin/sh
# The generated app and Mongo remain private inside this container. Docker keeps the
# container running across host restarts; its named volume keeps the application data.
set -u
rm -f /tmp/codeforge-deployment-ready

mongod --dbpath /data/db --bind_ip 127.0.0.1 --quiet > /tmp/deployment-mongod.log 2>&1 &
MONGO_PID=$!
trap 'kill "$MONGO_PID" 2>/dev/null || true' EXIT TERM INT

i=0
while [ "$i" -lt 60 ]; do
    if python -c "import socket;socket.create_connection(('127.0.0.1',27017),0.5)" 2>/dev/null; then
        touch /tmp/codeforge-deployment-ready
        wait "$MONGO_PID"
        exit $?
    fi
    i=$((i + 1))
    sleep 0.5
done

echo "Deployment MongoDB did not start" >&2
exit 70
