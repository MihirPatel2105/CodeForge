import hashlib
import hmac
import time

from redis.exceptions import ConnectionError
from starlette.requests import Request

from app.config import settings
from app.core.abuse_limits import _client_ip


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.unavailable = False

    async def eval(self, script: str, numkeys: int, key: str, window: int) -> tuple[int, int]:
        if self.unavailable:
            raise ConnectionError("offline")
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key], window

    async def aclose(self) -> None:
        pass


def test_login_limit_is_shared_and_ignores_untrusted_forwarded_header(client, monkeypatch):
    redis = FakeRedis()
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")

    for index in range(30):
        response = client.post(
            "/auth/login",
            json={"email": "missing@example.com", "password": "Wrong12345"},
            headers={"X-Forwarded-For": f"203.0.113.{index + 1}"},
        )
        assert response.status_code == 401

    response = client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "Wrong12345"},
    )
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert response.headers["Retry-After"] == "600"
    assert len(redis.counts) == 1


def test_auth_route_rejects_when_configured_redis_is_unavailable(client, monkeypatch):
    redis = FakeRedis()
    redis.unavailable = True
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")

    response = client.post("/auth/forgot-password", json={"email": "missing@example.com"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert client.get("/health").status_code == 200


def test_login_limit_is_separate_from_registration_limit(client, monkeypatch):
    redis = FakeRedis()
    client.app.state.redis = redis
    monkeypatch.setattr(settings, "redis_url", "redis://test")

    login = client.post(
        "/auth/login", json={"email": "missing@example.com", "password": "Wrong12345"}
    )
    registration = client.post(
        "/auth/register",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "new@example.com",
            "password": "Secret12345",
        },
    )
    assert login.status_code == 401
    assert registration.status_code == 201
    assert len(redis.counts) == 2


def test_forwarded_ip_only_comes_from_a_trusted_proxy(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", ["10.0.0.0/8"])
    headers = [(b"x-forwarded-for", b"198.51.100.1, 203.0.113.8")]

    untrusted = Request({"type": "http", "client": ("192.0.2.4", 1234), "headers": headers})
    assert _client_ip(untrusted) == "192.0.2.4"

    trusted = Request({"type": "http", "client": ("10.0.0.5", 1234), "headers": headers})
    assert _client_ip(trusted) == "203.0.113.8"


def test_signed_proxy_ip_is_accepted_but_unsigned_or_tampered_ip_is_not(monkeypatch):
    secret = "a-long-random-proxy-secret-for-testing"
    monkeypatch.setattr(settings, "proxy_ip_secret", secret)
    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret.encode(), f"203.0.113.8.{timestamp}".encode(), hashlib.sha256
    ).hexdigest()
    headers = [
        (b"x-codeforge-client-ip", b"203.0.113.8"),
        (b"x-codeforge-client-time", timestamp.encode()),
        (b"x-codeforge-client-signature", signature.encode()),
    ]
    valid = Request({"type": "http", "client": ("192.0.2.4", 1234), "headers": headers})
    assert _client_ip(valid) == "203.0.113.8"

    tampered = Request(
        {
            "type": "http",
            "client": ("192.0.2.4", 1234),
            "headers": [(b"x-codeforge-client-ip", b"203.0.113.9"), *headers[1:]],
        }
    )
    assert _client_ip(tampered) == "192.0.2.4"
