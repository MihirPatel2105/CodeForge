"""Explain evidence without echoing provider errors or generated source."""

import re

from app.models.run import Run
from app.schemas.admin_operations import FailureGuidance

_RATE_LIMIT = re.compile(r"\b429\b|rate.?limit|quota|resource.?exhausted", re.I)


def failure_guidance(run: Run) -> FailureGuidance | None:
    if not run.status.startswith("failed_"):
        return None
    if run.status == "failed_llm":
        attempts = run.state.get("llm_attempts") or []
        limited = any(
            isinstance(item, dict)
            and not item.get("ok")
            and _RATE_LIMIT.search(str(item.get("error", "")))
            for item in attempts[-10:]
        )
        return FailureGuidance(
            category="provider_limit" if limited else "provider",
            stage="Model request",
            explanation="Recent model requests reached a provider limit."
            if limited
            else "The model request could not complete.",
            next_step=(
                "Review provider observations. Retry as a new run after availability recovers."
            ),
        )
    if run.status == "failed_sandbox":
        return FailureGuidance(
            category="sandbox",
            stage="Sandbox execution",
            explanation="The generated API could not finish sandbox execution.",
            next_step=(
                "Check Docker and sandbox availability, "
                "then inspect the run’s test evidence before retrying."
            ),
        )
    return FailureGuidance(
        category="repair_limit",
        stage="Review or tests",
        explanation="The workflow reached its repair limit before satisfying review or tests.",
        next_step=(
            "Inspect the final review and failed tests. "
            "Refine the prompt or validation rules before starting a new run."
        ),
    )
