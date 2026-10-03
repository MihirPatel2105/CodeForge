"""Shared limits for unauthenticated endpoints, backed by Redis."""

import hashlib
import hmac
import ipaddress
import logging
import time
from typing import TYPE_CHECKING

from fastapi import Request
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError

from app.config import settings
from app.core.exceptions import RateLimitError, SecurityServiceError

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Attempts per window, counted before the route runs. Existing per-account lockout and
# one-time challenge checks still apply after these coarse client limits.
LIMITS: dict[str, tuple[int, int]] = {
    "/auth/register": (10, 3600),
    "/auth/verify-email": (20, 600),
    "/auth/resend-code": (10, 3600),
    "/auth/login": (30, 600),
    "/auth/login/complete": (20, 600),
    "/auth/totp/setup": (10, 600),
    "/auth/totp/verify": (20, 600),
    "/auth/totp/disable": (10, 600),
    "/auth/recovery-codes/regenerate": (10, 600),
    "/auth/forgot-password": (10, 3600),
    "/auth/reset-password": (20, 3600),
    "/auth/sign-in-alert/respond": (20, 600),
    "/auth/passkeys/login/options": (30, 600),
    "/auth/passkeys/login/verify": (20, 600),
    "/auth/passkeys/mfa/options": (30, 600),
    "/auth/passkeys/mfa/verify": (20, 600),
}

_INCREMENT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}
"""


async def check_admin_limit(request: Request, user_id: str) -> None:
    """Shared per-account limits cannot be bypassed by changing session or IP."""
    if not settings.redis_url:
        # Production config already requires Redis; local development can be offline.
        return
    mutation = request.method not in {"GET", "HEAD", "OPTIONS"}
    bucket = "write" if mutation else "read"
    identity = hmac.new(settings.jwt_secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()
    try:
        count, _ttl = await request.app.state.redis.eval(
            _INCREMENT, 1, f"codeforge:admin:{bucket}:{identity}", 60
        )
    except RedisError:
        logger.exception("Admin limiter is unavailable")
        raise SecurityServiceError("Security checks are unavailable. Try again shortly.") from None
    if count > (20 if mutation else 180):
        raise RateLimitError("Too many admin requests. Try again shortly.")


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    if settings.proxy_ip_secret:
        claimed_ip = request.headers.get("x-codeforge-client-ip", "")
        timestamp = request.headers.get("x-codeforge-client-time", "")
        signature = request.headers.get("x-codeforge-client-signature", "")
        try:
            ipaddress.ip_address(claimed_ip)
            timestamp_value = int(timestamp)
            if abs(time.time() - timestamp_value) <= 60:
                expected = hmac.new(
                    settings.proxy_ip_secret.encode(),
                    f"{claimed_ip}.{timestamp}".encode(),
                    hashlib.sha256,
                ).hexdigest()
                if hmac.compare_digest(signature, expected):
                    return claimed_ip
        except ValueError:
            pass
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return peer

    networks = [ipaddress.ip_network(cidr) for cidr in settings.trusted_proxy_cidrs]
    if not any(address in network for network in networks):
        return peer

    # Walk from the nearest trusted proxy towards the browser. Ignore headers from
    # untrusted peers, including a spoofed leftmost X-Forwarded-For entry.
    for value in reversed(request.headers.get("x-forwarded-for", "").split(",")):
        try:
            forwarded = ipaddress.ip_address(value.strip())
        except ValueError:
            return peer
        if not any(forwarded in network for network in networks):
            return str(forwarded)
    return peer


async def check_abuse_limit(request: Request) -> JSONResponse | None:
    if request.method != "POST" or request.url.path not in LIMITS or not settings.redis_url:
        return None

    redis: Redis = request.app.state.redis
    limit, window = LIMITS[request.url.path]
    identity = hmac.new(
        settings.jwt_secret.encode(), _client_ip(request).encode(), hashlib.sha256
    ).hexdigest()
    key = f"codeforge:abuse:{request.url.path}:{identity}"
    try:
        count, ttl = await redis.eval(_INCREMENT, 1, key, window)
    except RedisError:
        logger.exception("Redis abuse limiter is unavailable")
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "service_unavailable",
                    "message": "Please try again shortly.",
                    "run_id": None,
                }
            },
        )
    if count <= limit:
        return None
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(max(ttl, 1))},
        content={
            "error": {
                "code": "rate_limited",
                "message": "Too many requests. Please try again shortly.",
                "run_id": None,
            }
        },
    )


async def _account_limit(
    request: Request, user_id: str, bucket: str, limit: int, window: int
) -> None:
    if not settings.redis_url:
        return
    # One bucket spans all reauthentication routes, sessions and IP addresses.
    identities = (user_id, _client_ip(request))
    for scope, value in zip(("account", "client"), identities, strict=True):
        identity = hmac.new(
            settings.jwt_secret.encode(), value.encode(), hashlib.sha256
        ).hexdigest()
        try:
            count, _ttl = await request.app.state.redis.eval(
                _INCREMENT, 1, f"codeforge:{bucket}:{scope}:{identity}", window
            )
        except RedisError:
            logger.exception("Account limiter is unavailable")
            raise SecurityServiceError(
                "Security checks are unavailable. Try again shortly."
            ) from None
        if count > limit:
            raise RateLimitError("Too many requests. Try again shortly.")


async def check_reauthentication_limit(request: Request, user_id: str) -> None:
    await _account_limit(request, user_id, "reauth", 10, 600)


async def check_run_submission_limit(request: Request, user_id: str) -> None:
    await _account_limit(request, user_id, "run-submit", 5, 60)
