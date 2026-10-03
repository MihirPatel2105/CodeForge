"""Bound HTTP uploads before routing, including requests without Content-Length."""

import asyncio

from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    def __init__(self, app, max_bytes: int = 1_048_576, timeout_seconds: float = 30):
        self.app = app
        self.max_bytes = max_bytes
        self.timeout_seconds = timeout_seconds

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            length = -1
        if length < 0:
            return await self.reject(scope, receive, send, 400, "Invalid request size.")
        if length > self.max_bytes:
            return await self.reject(scope, receive, send, 413, "Request is too large.")
        body = bytearray()
        size = 0
        try:
            async with asyncio.timeout(self.timeout_seconds):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    size += len(message.get("body", b""))
                    if size > self.max_bytes:
                        return await self.reject(scope, receive, send, 413, "Request is too large.")
                    body.extend(message.get("body", b""))
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await self.reject(scope, receive, send, 408, "Request timed out.")
        consumed = False

        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)

    @staticmethod
    async def reject(scope, receive, send, status, message):
        response = JSONResponse(
            {"error": {"code": "request_size", "message": message, "run_id": None}}, status
        )
        await response(scope, receive, send)
