"""Provider preflight diagnostics that do not contact external services."""

import httpx

from scripts.preflight import (
    GROQ_DAILY_QUOTA_WARNING,
    _groq_429_message,
    _groq_probe_payload,
    _mistral_429_message,
)


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


def test_groq_probe_stays_cheap_and_daily_limit_warning_is_explicit():
    payload = _groq_probe_payload("openai/gpt-oss-120b")
    assert payload["max_tokens"] == 1
    assert payload["messages"] == [{"role": "user", "content": "Reply only OK"}]
    assert "not exposed" in GROQ_DAILY_QUOTA_WARNING
    assert "cannot guarantee" in GROQ_DAILY_QUOTA_WARNING


def test_groq_rate_limit_preserves_daily_window_and_retry_detail():
    response = httpx.Response(
        429,
        json={
            "error": {
                "message": (
                    "Rate limit reached on tokens per day. Please try again in 15m. "
                    "Need more tokens? Upgrade."
                )
            }
        },
    )
    assert _groq_429_message(response) == (
        "Rate limit reached on tokens per day. Please try again in 15m."
    )
