"""Add local run instructions to a generated source archive at download time."""

import ast
import io
import zipfile
from pathlib import Path

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
      - "${API_PORT:-{API_PORT}}:8000"
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
4. Open http://localhost:{API_PORT}/docs to see every endpoint and its required fields.
   Use the Try it out button to send a request.

Port {API_PORT} is the default. If it is already in use, for example by another
downloaded API, copy `.env.example` to `.env`, set `API_PORT` to a free port such as
{NEXT_API_PORT}, and open http://localhost:{NEXT_API_PORT}/docs instead.

The API is at http://localhost:{API_PORT}. MongoDB runs inside the API container and its data
is saved in a Docker volume. Stop with Ctrl-C, then `docker compose down`. Do not use
`down -v` unless you want to delete the API data.

## Make a request

In a second terminal, list the available routes:

```bash
curl http://localhost:{API_PORT}/openapi.json
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


ADMIN_COMPOSE = """services:
  admin:
    build: ./admin-ui
    ports:
      - "127.0.0.1:${ADMIN_PORT:-{ADMIN_PORT}}:80"
    depends_on:
      - api
"""

ADMIN_README = """# Manage your collection

1. Install and open Docker Desktop.
2. In this folder run:
   `docker compose -f compose.yaml -f compose.admin.yaml up --build`
3. Open http://localhost:{ADMIN_PORT} to manage your records using forms and tables.
   The API docs stay at http://localhost:{API_PORT}/docs.

The UI discovers collections from the running API's OpenAPI schema. It supports
top-level collection routes with GET list responses (an array, or an object with
an items, results, or data array), POST creation, and matching /{id} routes for
editing and deletion. Unsupported operations stay available in the API docs.
Search filters the records currently loaded; use Previous/Next to browse APIs
that declare offset/skip plus limit pagination. Required query filters appear
above the table. Nested objects and arrays use JSON fields.

The UI sends requests to the API through its own container, so no CORS setup or
API key is needed. This is a local, single-user interface without authentication.
It binds to your computer's loopback address. Keep it local; adding public access
requires authentication. MongoDB data uses the API's existing Docker volume.

If a port is occupied, copy `.env.example` to `.env` and change `API_PORT` or
`ADMIN_PORT` (exactly these names; any other name is ignored). Stop with Ctrl-C and run
`docker compose -f compose.yaml -f compose.admin.yaml down`.
Your API-only instructions remain in README.md.

The editable React source is in admin-ui/app and admin-ui/lib. No extra AI call
is used to generate this UI. The API's sandbox tests cover the API; they do not
certify every form or workflow in this optional interface.
"""


# Host ports a download binds by default. Deliberately not 8000/3000: those belong to
# CodeForge's own backend and Langfuse, which are usually running on the same machine
# when someone opens a fresh download, so the defaults would never bind.
DEFAULT_API_PORT = 8100
DEFAULT_ADMIN_PORT = 3100


def _with_ports(template: str) -> str:
    return (
        template.replace("{NEXT_API_PORT}", str(DEFAULT_API_PORT + 1))
        .replace("{API_PORT}", str(DEFAULT_API_PORT))
        .replace("{ADMIN_PORT}", str(DEFAULT_ADMIN_PORT))
    )


def _env_example(*, include_admin_ui: bool) -> str:
    lines = [
        "# Optional host ports. Copy to .env and change them if a port is in use.",
        f"API_PORT={DEFAULT_API_PORT}",
    ]
    if include_admin_ui:
        lines.append(f"ADMIN_PORT={DEFAULT_ADMIN_PORT}")
    return "\n".join(lines) + "\n"


def add_run_guide(payload: bytes, *, include_admin_ui: bool = False) -> bytes:
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
            readme = _with_ports(README)
            if include_admin_ui:
                readme = readme.replace(
                    "# Your generated API\n",
                    "# Your generated API\n\n"
                    "This package includes an optional React collection manager. "
                    "Follow **ADMIN_UI.md** to start the API and UI together.\n",
                    1,
                )
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
                    "compose.yaml": _with_ports(COMPOSE),
                    ".env.example": _env_example(include_admin_ui=include_admin_ui),
                    "start.sh": START,
                    ".dockerignore": "__pycache__\n.pytest_cache\n.venv\n.env\n",
                }
                if include_admin_ui:
                    template = Path(__file__).resolve().parents[1] / "templates" / "admin_ui"
                    additions.update(
                        {
                            "admin-ui/" + file.relative_to(template).as_posix(): file.read_text()
                            for file in sorted(template.rglob("*"))
                            if file.is_file()
                        }
                    )
                    additions["compose.admin.yaml"] = _with_ports(ADMIN_COMPOSE)
                    additions["ADMIN_UI.md"] = _with_ports(ADMIN_README)
                existing = set(original.namelist())
                for name, content in additions.items():
                    if name not in existing:
                        archive.writestr(name, content)
            return output.getvalue()
    except zipfile.BadZipFile:
        return payload
