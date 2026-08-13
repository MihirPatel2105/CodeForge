"""Password hashing and JWT issue/verify.

CodeForge issues and verifies its own tokens — there is one backend, so there is no
cross-service secret to share (CLAUDE.md §8).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.core.exceptions import AuthError

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    """`subject` is the user id. Kept as a string because JWT `sub` must be a string."""
    minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        # Expired, wrong signature and malformed all collapse to one client-facing
        # message: distinguishing them tells an attacker which part they got right.
        raise AuthError("Invalid or expired token") from exc
