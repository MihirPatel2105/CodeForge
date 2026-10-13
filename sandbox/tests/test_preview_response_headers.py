"""The playground receives useful response metadata without cookie/server headers."""

import base64
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

from fastapi import FastAPI, Response

from app.schemas.api import PreviewResult


def test_preview_script_emits_only_displayable_response_headers(monkeypatch, capsys):
    spec = importlib.util.spec_from_file_location(
        "preview_script", Path(__file__).parents[2] / "sandbox" / "preview_request.py"
    )
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    target = ModuleType("main")
    target.app = FastAPI()

    @target.app.get("/items")
    def items():
        return Response(
            '{"items":[]}',
            media_type="application/json",
            headers={
                "cache-control": "no-cache",
                "etag": '"v1"',
                "set-cookie": "session=private",
                "server": "internal-host",
                "x-api-key": "private",
                "location": "https://internal.example",
            },
        )

    monkeypatch.setitem(sys.modules, "main", target)
    payload = base64.b64encode(json.dumps({"method": "GET", "path": "/items"}).encode()).decode()
    monkeypatch.setattr(sys, "argv", ["preview_request.py", payload])
    script.main()
    result = json.loads(capsys.readouterr().out.split(script.PREFIX)[1])
    assert result["headers"] == {
        "content-type": "application/json",
        "content-length": "12",
        "cache-control": "no-cache",
        "etag": '"v1"',
    }
    public = PreviewResult(**result, duration_ms=1, session_started=False).model_dump()
    assert public["headers"] == result["headers"]
