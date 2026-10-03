import asyncio
import json

from fastapi import Request

from app.core.exceptions import PreviewUnavailableError
from app.main import codeforge_error_handler


def test_validation_error_does_not_echo_request_input(client):
    secret = "database://service:secret-password@example.com"
    response = client.post("/auth/register", json={"email": secret, "password": secret})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert secret not in response.text


def test_typed_error_does_not_expose_internal_exception_message():
    secret = "database://service:secret-password@example.com"
    request = Request({"type": "http", "method": "GET", "path": "/"})
    response = asyncio.run(codeforge_error_handler(request, PreviewUnavailableError(secret)))

    assert response.status_code == 503
    body = json.loads(response.body)
    assert body["error"]["code"] == "preview_unavailable"
    assert secret not in response.body.decode()


def test_publish_limits_return_distinct_actionable_safe_messages():
    from app.core.exceptions import PublishedAccountLimitError, PublishedCapacityError

    request = Request({"type": "http", "method": "POST", "path": "/"})
    for error, code, action in (
        (PublishedAccountLimitError, "published_account_limit", "Unpublish your current API"),
        (PublishedCapacityError, "published_capacity_full", "All 2 hosting slots are occupied"),
    ):
        response = asyncio.run(codeforge_error_handler(request, error("private internal detail")))
        body = json.loads(response.body)
        assert response.status_code == 409
        assert body["error"]["code"] == code
        assert action in body["error"]["message"]
        assert "private internal detail" not in response.body.decode()
