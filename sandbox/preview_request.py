"""Execute one in-container ASGI request without publishing a network port."""

import base64
import contextlib
import json
import sys

from fastapi.testclient import TestClient

PREFIX = "CODEFORGE_PREVIEW_RESULT="


def main() -> None:
    sys.path.insert(0, "/app")
    request = json.loads(base64.b64decode(sys.argv[1], validate=True))
    with (
        open("/dev/null", "w") as quiet,
        contextlib.redirect_stdout(quiet),
        contextlib.redirect_stderr(quiet),
    ):
        from main import app

        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.request(
                request["method"],
                request["path"],
                json=request.get("body"),
                headers={"content-type": "application/json"},
            )
    print(
        PREFIX
        + json.dumps(
            {
                "status": response.status_code,
                "content_type": response.headers.get("content-type", ""),
                "body": response.text[:100_000],
                "truncated": len(response.text) > 100_000,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - generated code can fail in arbitrary ways
        print(
            PREFIX + json.dumps({"error": f"{type(exc).__name__}: {exc}"[:300]}),
            flush=True,
        )
