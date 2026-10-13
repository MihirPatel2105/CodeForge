from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.preview import router
from app.core.deps import get_current_user


def test_endpoint_serializes_resolved_parameter_schema():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: object()
    document = (
        '{"paths":{"/items":{"get":{"parameters":[{'
        '"name":"limit","in":"query","schema":{"type":"integer","default":10}}]}}}}'
    )
    with (
        patch("app.api.preview._files_for_user", new_callable=AsyncMock, return_value=[]),
        patch(
            "app.api.preview._call",
            new_callable=AsyncMock,
            return_value={"status": 200, "body": document, "session_started": False},
        ),
    ):
        response = TestClient(app).get("/runs/example/preview")
    assert response.status_code == 200
    assert response.json()["operations"][0]["parameters"][0]["schema"] == {
        "type": "integer",
        "default": 10,
    }
