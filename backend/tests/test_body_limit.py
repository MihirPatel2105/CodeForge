import asyncio
import json

from app.core.body_limit import BodyLimitMiddleware


def _request(chunks, length=None):
    called = []
    responses = []
    remaining = iter(chunks)

    async def receive():
        return next(remaining)

    async def send(message):
        responses.append(message)

    async def app(scope, receive, send):
        body = b""
        while True:
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body", False):
                break
        called.append(body)

    headers = [] if length is None else [(b"content-length", length)]
    asyncio.run(
        BodyLimitMiddleware(app, max_bytes=8)({"type": "http", "headers": headers}, receive, send)
    )
    return called, responses


def test_rejects_declared_oversize_without_reading_body():
    called, responses = _request([], b"9")
    assert not called
    assert responses[0]["status"] == 413


def test_chunked_oversize_never_reaches_route():
    called, responses = _request(
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"6789", "more_body": True},
        ]
    )
    assert not called
    assert responses[0]["status"] == 413
    assert json.loads(responses[1]["body"])["error"]["code"] == "request_size"


def test_exact_boundary_replays_chunks():
    called, responses = _request(
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"678", "more_body": False},
        ]
    )
    assert called == [b"12345678"]
    assert not responses


def test_invalid_length_is_rejected():
    for value in [b"-1", b"invalid"]:
        called, responses = _request([], value)
        assert not called
        assert responses[0]["status"] == 400


def test_disconnect_does_not_invoke_route():
    called, responses = _request([{"type": "http.disconnect"}])
    assert not called
    assert not responses


def test_slow_upload_times_out_before_route():
    async def scenario():
        responses = []

        async def receive():
            await asyncio.sleep(1)

        async def send(message):
            responses.append(message)

        async def app(scope, receive, send):
            raise AssertionError("Incomplete uploads must not reach the route")

        await BodyLimitMiddleware(app, timeout_seconds=0.01)(
            {"type": "http", "headers": []}, receive, send
        )
        assert responses[0]["status"] == 408

    asyncio.run(scenario())
