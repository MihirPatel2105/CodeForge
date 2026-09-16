"""Check that a designed endpoint responds before pytest changes application state."""

import os
import re

from fastapi.testclient import TestClient


def main() -> None:
    from main import app

    method = os.environ["CODEFORGE_PROBE_METHOD"].upper()
    path = re.sub(
        r"\{[^/{}]+\}", "000000000000000000000000", os.environ["CODEFORGE_PROBE_PATH"]
    )
    with TestClient(app) as client:
        response = client.request(
            method, path, json={} if method in {"POST", "PUT", "PATCH"} else None
        )
    if response.status_code < 500:
        print(f"CODEFORGE_BOOT_OK {response.status_code}", flush=True)
    else:
        print(f"CODEFORGE_BOOT_FAILED {response.status_code}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - generated code may fail in any way
        print(f"CODEFORGE_BOOT_FAILED {type(exc).__name__}: {exc}"[:300], flush=True)
