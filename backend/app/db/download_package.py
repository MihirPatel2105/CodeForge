"""Add local run instructions to a generated source archive at download time."""

import ast
import io
import zipfile

REQUIREMENTS = """fastapi==0.115.6
email-validator==2.2.0
uvicorn==0.34.0
beanie==2.2.0
pymongo==4.16.0
pytest==8.3.4
httpx==0.28.1
"""

DOCKERFILE = """FROM mongo:8
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \\
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN mkdir -p /app /data/db && chown -R mongodb:mongodb /app /data/db
COPY . /app
RUN chmod +x /app/start.sh && chown -R mongodb:mongodb /app
USER mongodb
WORKDIR /app
EXPOSE 8000
CMD ["/app/start.sh"]
"""

COMPOSE = """services:
  api:
    build: .
    ports:
      - "${API_PORT:-8000}:8000"
    volumes:
      - api_data:/data/db
volumes:
  api_data:
"""

START = """#!/bin/sh
set -eu
mongod --dbpath /data/db --bind_ip 127.0.0.1 --quiet > /tmp/mongod.log 2>&1 &
mongo_pid=$!
trap 'kill "$mongo_pid" 2>/dev/null || true' EXIT
ready=0
for attempt in $(seq 1 60); do
    if python -c "import socket; socket.create_connection(('127.0.0.1',27017),.5)" 2>/dev/null; then
        ready=1
        break
    fi
    sleep 0.5
done
if [ "$ready" -ne 1 ]; then
    echo "MongoDB failed to start" >&2
    exit 1
fi
uvicorn main:app --host 0.0.0.0 --port 8000
"""

README = """# Your generated API

## Run it

1. Install and open Docker Desktop.
2. Open a terminal in this folder.
3. Run `docker compose up --build`.
4. Open http://localhost:8000/docs to see every endpoint and its required fields.
   Use the Try it out button to send a request.

Port 8000 is the default. If it is already in use, copy `.env.example` to `.env`, set
`API_PORT=8001`, and open http://localhost:8001/docs instead.

The API is at http://localhost:8000. MongoDB runs inside the API container and its data
is saved in a Docker volume. Stop with Ctrl-C, then `docker compose down`. Do not use
`down -v` unless you want to delete the API data.

## Make a request

In a second terminal, list the available routes:

```bash
curl http://localhost:8000/openapi.json
```

Open `/docs`, choose a route, enter the example JSON, and click **Execute**. The page
shows the exact cURL request you can copy into your own project. For a route with an
`{id}` placeholder, first create a record and use the ID returned in its response.

## Run the included tests

```bash
docker compose exec api pytest -q
```

## Use this API elsewhere

This download runs on your computer. `localhost` works only on that computer. To call
the API from another device or hosted app, publish it in CodeForge and use the published
URL and key from your server.
"""


def add_run_guide(payload: bytes) -> bytes:
    """Enrich old and new file-tree zips without changing their stored evidence."""
    source = io.BytesIO(payload)
    try:
        with zipfile.ZipFile(source) as original:
            if "main.py" not in original.namelist():
                return payload
            routes = []
            try:
                tree = ast.parse(original.read("main.py"))
                for node in tree.body:
                    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        continue
                    for decorator in node.decorator_list:
                        if not isinstance(decorator, ast.Call) or not isinstance(
                            decorator.func, ast.Attribute
                        ):
                            continue
                        if decorator.func.attr not in {"get", "post", "put", "patch", "delete"}:
                            continue
                        if decorator.args and isinstance(decorator.args[0], ast.Constant):
                            path = decorator.args[0].value
                            if isinstance(path, str):
                                routes.append(f"- `{decorator.func.attr.upper()} {path}`")
            except (SyntaxError, UnicodeDecodeError):
                pass
            readme = README
            if routes:
                readme += "\n## Endpoints\n\n" + "\n".join(routes) + "\n"
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
                for member in original.infolist():
                    archive.writestr(member, original.read(member))
                additions = {
                    "README.md": readme,
                    "requirements.txt": REQUIREMENTS,
                    "Dockerfile": DOCKERFILE,
                    "compose.yaml": COMPOSE,
                    ".env.example": "# Optional host port for the API\nAPI_PORT=8000\n",
                    "start.sh": START,
                    ".dockerignore": "__pycache__\n.pytest_cache\n.venv\n.env\n",
                }
                existing = set(original.namelist())
                for name, content in additions.items():
                    if name not in existing:
                        archive.writestr(name, content)
            return output.getvalue()
    except zipfile.BadZipFile:
        return payload
