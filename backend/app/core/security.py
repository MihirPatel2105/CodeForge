"""Password hashing and JWT issue/verify.

CodeForge issues and verifies its own tokens — there is one backend, so there is no
cross-service secret to share (CLAUDE.md §8).
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.core.exceptions import AuthError

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def generate_reset_token() -> str:
    """A high-entropy string for the reset link, distinct from `generate_otp`.

    Nobody types this one — it travels as a URL — so there is no reason to keep it
    short the way a code someone reads off an email and keys in has to be. 32 bytes of
    `token_urlsafe` is unguessable and safe to put directly in a link.
    """
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    """Reset tokens are hashed with SHA-256, not bcrypt.

    Bcrypt is deliberately slow — that is what makes it right for a password or a
    six-digit OTP, both guessable by brute force. A 32-byte random token is not
    guessable at all; verifying it is an equality check on a lookup value, the same
    role a session id or an API key plays. SHA-256 keeps that lookup a single indexed
    query instead of forcing a table scan to bcrypt-compare every live token.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def generate_otp(length: int | None = None) -> str:
    """A numeric one-time code.

    `secrets`, not `random`: the latter is a Mersenne Twister seeded from the clock, and
    observing a few of its outputs is enough to predict the rest — which for a code that
    grants an account is the whole ballgame. Zero-padded so every code is the same
    length, including the one-in-ten that starts with a zero.
    """
    digits = length if length is not None else settings.otp_length
    return f"{secrets.randbelow(10**digits):0{digits}d}"


def hash_otp(code: str) -> str:
    """Codes are stored hashed, like passwords.

    A six-digit space is small enough to exhaust offline, so this is not the control that
    protects the code — the attempt cap and the ten-minute expiry are. What it does buy
    is that a leaked database does not hand over live codes in readable form.
    """
    return _pwd.hash(code)


def verify_otp(code: str, hashed: str) -> bool:
    return _pwd.verify(code, hashed)


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _totp(secret: str, counter: int) -> str:
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def verify_totp(code: str, secret: str, *, at_time: int | None = None) -> bool:
    cleaned = code.replace(" ", "").replace("-", "")
    if len(cleaned) != 6 or not cleaned.isdigit():
        return False
    counter = (at_time if at_time is not None else int(time.time())) // 30
    return any(hmac.compare_digest(cleaned, _totp(secret, counter + drift)) for drift in (-1, 0, 1))


def totp_uri(secret: str, email: str) -> str:
    from urllib.parse import quote

    label = quote(f"CodeForge:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer=CodeForge&algorithm=SHA1&digits=6&period=30"
    )


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode()).digest())
    return Fernet(key)


def encrypt_totp_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str) -> str:
    try:
        return _fernet().decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise AuthError("Two-factor configuration is invalid. Contact the administrator.") from exc


def create_access_token(
    subject: str, expires_minutes: int | None = None, token_version: int = 0
) -> str:
    """`subject` is the user id. Kept as a string because JWT `sub` must be a string.

    `tv` is the user's token generation; `get_current_user` refuses a token whose `tv`
    is behind the account's, which is how a password change ends other sessions.

    `jti` names this one token. Signing out records it as revoked, which ends that
    session — and any copy of it — without touching the account's other devices.
    """
    minutes = expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
        "tv": token_version,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        # Expired, wrong signature and malformed all collapse to one client-facing
        # message: distinguishing them tells an attacker which part they got right.
        raise AuthError("Invalid or expired token") from exc
