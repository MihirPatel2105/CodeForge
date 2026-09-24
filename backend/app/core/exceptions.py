"""Typed exceptions, handled centrally in `main.py`.

Routes raise these instead of building error responses, so every error leaves the API in
the shape `docs/STATE_AND_API.md` §3 specifies.
"""


class CodeForgeError(Exception):
    """Base class. `code` is the machine-readable value clients switch on."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, run_id: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.run_id = run_id


class NotFoundError(CodeForgeError):
    status_code = 404
    code = "not_found"


class AuthError(CodeForgeError):
    status_code = 401
    code = "unauthorized"


class PermissionError_(CodeForgeError):
    """Trailing underscore avoids shadowing the builtin `PermissionError`."""

    status_code = 403
    code = "forbidden"


class ConflictError(CodeForgeError):
    status_code = 409
    code = "conflict"


class ProviderExhaustedError(CodeForgeError):
    """Every model in an agent's chain failed — maps to run status `failed_llm`."""

    status_code = 503
    code = "llm_exhausted"

    def __init__(self, message: str, *, attempts: list | None = None) -> None:
        super().__init__(message)
        self.attempts = attempts or []


class RateLimitError(CodeForgeError):
    """Too many attempts, or too soon after the last one."""

    status_code = 429
    code = "rate_limited"


class AccountSuspendedError(CodeForgeError):
    status_code = 403
    code = "account_suspended"


class UsageLimitError(CodeForgeError):
    status_code = 409
    code = "usage_limit_reached"


class PreviewRequestError(CodeForgeError):
    status_code = 400
    code = "invalid_preview_request"


class PreviewUnavailableError(CodeForgeError):
    status_code = 503
    code = "preview_unavailable"
