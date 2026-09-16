"""Provider preflight diagnostics that do not contact external services."""

import httpx

from scripts.preflight import _mistral_429_message


def test_mistral_zero_runtime_allowance_is_not_reported_as_a_cooldown():
    headers = httpx.Headers(
        {
            "x-ratelimit-limit-req-minute": "0",
            "x-ratelimit-remaining-req-minute": "0",
        }
    )
    assert _mistral_429_message(headers) == (
        "account has zero runtime request allowance (Admin limits may disagree)"
    )


def test_mistral_transient_limit_reports_retry_after_when_available():
    headers = httpx.Headers({"x-ratelimit-limit-req-minute": "60", "retry-after": "12"})
    assert _mistral_429_message(headers) == "rate limited right now; retry after 12s"
