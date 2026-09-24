"""Device and session records for account security."""

import hashlib
import ipaddress
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import Request

from app.core.security import create_access_token, decode_access_token
from app.models import Device, LoginSession, RevokedToken, User


def _device_hash(request: Request) -> str:
    try:
        device_id = str(uuid.UUID(request.headers.get("x-codeforge-device", "")))
    except ValueError:
        device_id = secrets.token_hex(32)
    return hashlib.sha256(device_id.encode()).hexdigest()


def _device_label(request: Request) -> str:
    agent = request.headers.get("user-agent", "").lower()
    browser = next(
        (
            name
            for marker, name in (
                ("edg/", "Edge"),
                ("firefox/", "Firefox"),
                ("chrome/", "Chrome"),
                ("safari/", "Safari"),
            )
            if marker in agent
        ),
        "Browser",
    )
    system = next(
        (
            name
            for marker, name in (
                ("iphone", "iPhone"),
                ("ipad", "iPad"),
                ("android", "Android"),
                ("mac os", "macOS"),
                ("windows", "Windows"),
                ("linux", "Linux"),
            )
            if marker in agent
        ),
        "unknown device",
    )
    return f"{browser} on {system}"


async def issue_session(user: User, request: Request) -> tuple[str, Device, bool]:
    """Return token, device, and whether this browser is new for this account."""
    now = datetime.now(UTC)
    uid = str(user.id)
    fingerprint = _device_hash(request)
    device = await Device.find_one(Device.user_id == uid, Device.device_hash == fingerprint)
    is_new = device is None
    label = _device_label(request)
    ip = request.client.host if request.client else None
    try:
        if ip and not ipaddress.ip_address(ip).is_global:
            ip = None
    except ValueError:
        ip = None
    if device is None:
        device = Device(
            user_id=uid,
            device_hash=fingerprint,
            label=label,
            ip_address=ip,
            first_seen_at=now,
            last_seen_at=now,
        )
        await device.insert()
    else:
        device.label = label
        device.ip_address = ip
        device.last_seen_at = now
        await device.save()

    token = create_access_token(uid, token_version=user.token_version)
    claims = decode_access_token(token)
    await LoginSession(
        user_id=uid,
        device_hash=fingerprint,
        jti=claims["jti"],
        token_version=user.token_version,
        created_at=now,
        expires_at=datetime.fromtimestamp(claims["exp"], tz=UTC),
    ).insert()
    return token, device, is_new


async def revoke_device_sessions(user_id: str, device_hash: str) -> None:
    now = datetime.now(UTC)
    sessions = await LoginSession.find(
        LoginSession.user_id == user_id,
        LoginSession.device_hash == device_hash,
        LoginSession.expires_at > now,
        LoginSession.revoked_at == None,  # noqa: E711 — Beanie query expression
    ).to_list()
    for session in sessions:
        if await RevokedToken.find_one(RevokedToken.jti == session.jti) is None:
            await RevokedToken(
                jti=session.jti, expires_at=session.expires_at, revoked_at=now
            ).insert()
        session.revoked_at = now
        await session.save()
