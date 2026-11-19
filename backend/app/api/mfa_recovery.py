"""Admin-approved recovery grants only authenticator replacement, never a session."""

import hmac
from datetime import UTC, datetime, timedelta

from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Request, Response
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.api.auth import _record_failed_login, _replace_recovery_codes, _send_quietly
from app.config import settings
from app.core import email_templates
from app.core.abuse_limits import check_reauthentication_limit
from app.core.deps import AdminUser
from app.core.email import send_email, send_security_alert_email
from app.core.exceptions import AuthError, ConflictError, NotFoundError
from app.core.security import (
    _totp,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_reset_token,
    generate_totp_secret,
    hash_recovery_code,
    hash_reset_token,
    totp_uri,
    verify_password,
)
from app.core.user_updates import update_user
from app.models import (
    AdminAuditLog,
    MfaRecovery,
    PasskeyChallenge,
    PasswordResetToken,
    RecoveryCode,
    User,
)

router = APIRouter(tags=["MFA recovery"])
GENERIC = (
    "If this account is eligible, your recovery request will be reviewed. "
    "Check your registered email after approval."
)


class RecoveryRequest(BaseModel):
    email: EmailStr
    invite_token: str = Field(min_length=20, max_length=128)


class RecoveryReview(BaseModel):
    approve: bool
    current_password: str = Field(min_length=1, max_length=256)
    reason: str = Field(min_length=3, max_length=240)


class RecoveryInvite(BaseModel):
    email: EmailStr
    current_password: str = Field(min_length=1, max_length=256)
    reason: str = Field(min_length=3, max_length=240)


class RecoveryVerify(BaseModel):
    token: str = Field(min_length=20, max_length=128)
    password: str = Field(min_length=1, max_length=256)
    recovery_code: str = Field(min_length=1, max_length=80)


class RecoveryComplete(BaseModel):
    setup_token: str = Field(min_length=20, max_length=128)
    code: str = Field(pattern=r"^\d{6}$")


class RecoveryMessage(BaseModel):
    message: str


class RecoverySetup(BaseModel):
    setup_token: str
    secret: str
    provisioning_uri: str


class RecoveryResult(RecoveryMessage):
    codes: list[str]


class RecoveryQueueItem(BaseModel):
    id: str
    email: str
    created_at: str


class RecoveryQueue(BaseModel):
    items: list[RecoveryQueueItem]


def now() -> datetime:
    return datetime.now(UTC)


async def eligible(user_id: str, version: int) -> User:
    user = await User.get(user_id)
    if (
        user is None
        or user.is_suspended
        or user.password_reset_required
        or not user.email_verified
        or not user.totp_enabled
        or user.token_version != version
    ):
        raise AuthError("This recovery request is no longer valid. Request a new link.")
    if user.locked_until and user.locked_until.replace(tzinfo=UTC) > now():
        raise AuthError("Sign-in is temporarily locked. Try again later.")
    return user


@router.post("/admin/mfa-recovery/invite", response_model=RecoveryMessage)
async def invite_recovery(payload: RecoveryInvite, admin: AdminUser, request: Request) -> dict:
    await check_reauthentication_limit(request, str(admin.id))
    if len(payload.reason.strip()) < 3 or not verify_password(
        payload.current_password, admin.hashed_password
    ):
        raise AuthError("Confirm your password and provide a review reason.")
    user = await User.find_one(User.email == str(payload.email).strip().lower())
    if user is None:
        raise NotFoundError("Account not found")
    if str(user.id) == str(admin.id):
        raise ConflictError("An administrator cannot initiate their own recovery.")
    user = await eligible(str(user.id), user.token_version)
    collection = MfaRecovery.get_pymongo_collection()
    # A second click or staff member cannot invalidate a live invitation/recovery.
    try:
        entry = await collection.find_one_and_update(
            {
                "user_id": str(user.id),
                "$or": [
                    {"expires_at": {"$lte": now()}},
                    {"token_version": {"$ne": user.token_version}},
                    {"status": {"$in": ["rejected", "completed"]}},
                ],
            },
            {
                "$set": {
                    "status": "inviting",
                    "token_hash": None,
                    "secret_encrypted": None,
                    "token_version": user.token_version,
                    "attempts": 0,
                    "created_at": now(),
                    "expires_at": now() + timedelta(hours=24),
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        raise ConflictError("An active recovery invitation or request already exists.") from None
    token = generate_reset_token()
    await collection.update_one(
        {"_id": entry["_id"], "status": "inviting"},
        {"$set": {"status": "invited", "token_hash": hash_reset_token(token)}},
    )
    url = f"{settings.app_base_url}/recover-2fa/request/{token}"
    try:
        mail = email_templates.recovery_invitation(to=user.email, url=url)
        await send_email(to=user.email, subject=mail.subject, text=mail.text, html=mail.html)
    except Exception:
        await collection.update_one(
            {"_id": entry["_id"], "status": "invited"},
            {"$set": {"status": "rejected", "token_hash": None}},
        )
        raise
    await AdminAuditLog(
        admin_user_id=str(admin.id),
        admin_email=admin.email,
        action="mfa_recovery.invited",
        target_type="user",
        target_id=str(user.id),
        reason=payload.reason.strip(),
    ).insert()
    return {
        "message": (
            "Review invitation sent to the registered email. "
            "The request appears after the user submits it."
        )
    }


@router.post("/auth/mfa-recovery/request", response_model=RecoveryMessage)
async def request_recovery(payload: RecoveryRequest, background: BackgroundTasks) -> dict:
    user = await User.find_one(User.email == str(payload.email).strip().lower())
    if user and user.email_verified and user.totp_enabled and not user.is_suspended:
        # The registered email must match the account bound to the staff-issued invite.
        created = await MfaRecovery.get_pymongo_collection().find_one_and_update(
            {
                "user_id": str(user.id),
                "status": "invited",
                "token_hash": hash_reset_token(payload.invite_token),
                "token_version": user.token_version,
                "expires_at": {"$gt": now()},
            },
            {
                "$set": {
                    "status": "pending",
                    "token_hash": None,
                    "created_at": now(),
                    "expires_at": now() + timedelta(hours=24),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if created and settings.admin_email:
            background.add_task(
                _send_quietly,
                "MFA recovery request",
                send_security_alert_email,
                to=settings.admin_email,
                title="MFA recovery requested",
                detail=(
                    f"The invited user {user.email} submitted a recovery request. "
                    f"Review it in {settings.app_base_url}/admin/recovery. "
                    "Never request their password or recovery codes by email."
                ),
            )
    return {"message": GENERIC}


@router.get("/admin/mfa-recovery", response_model=RecoveryQueue)
async def list_recovery(admin: AdminUser) -> dict:
    entries = (
        await MfaRecovery.find({"status": "pending", "expires_at": {"$gt": now()}})
        .sort("created_at")
        .limit(50)
        .to_list()
    )
    items = []
    for entry in entries:
        user = await User.get(entry.user_id)
        if user:
            items.append(
                {
                    "id": str(entry.id),
                    "email": user.email,
                    "created_at": entry.created_at.replace(tzinfo=UTC).isoformat(),
                }
            )
    return {"items": items}


@router.post("/admin/mfa-recovery/{request_id}/review", response_model=RecoveryMessage)
async def review_recovery(
    request_id: str, payload: RecoveryReview, admin: AdminUser, request: Request
) -> dict:
    await check_reauthentication_limit(request, str(admin.id))
    if len(payload.reason.strip()) < 3 or not verify_password(
        payload.current_password, admin.hashed_password
    ):
        raise AuthError("Confirm your password and provide a review reason.")
    try:
        entry = await MfaRecovery.get(request_id)
    except (InvalidId, ValueError):
        entry = None
    if entry is None:
        raise NotFoundError("Recovery request not found")
    if entry.user_id == str(admin.id):
        raise ConflictError("An administrator cannot approve their own recovery.")
    user = await eligible(entry.user_id, entry.token_version)
    claimed = await MfaRecovery.get_pymongo_collection().find_one_and_update(
        {"_id": entry.id, "status": "pending", "expires_at": {"$gt": now()}},
        {"$set": {"status": "sending" if payload.approve else "rejected"}},
    )
    if claimed is None:
        raise ConflictError("This request has already been reviewed or expired.")
    token = generate_reset_token()
    if payload.approve:
        await MfaRecovery.get_pymongo_collection().update_one(
            {"_id": entry.id},
            {
                "$set": {
                    "status": "approved",
                    "token_hash": hash_reset_token(token),
                    "expires_at": now() + timedelta(minutes=15),
                }
            },
        )
        try:
            url = f"{settings.app_base_url}/recover-2fa/{token}"
            mail = email_templates.recovery_approved(to=user.email, url=url)
            await send_email(to=user.email, subject=mail.subject, text=mail.text, html=mail.html)
        except Exception:
            await MfaRecovery.get_pymongo_collection().update_one(
                {"_id": entry.id, "status": "approved"},
                {"$set": {"status": "pending", "token_hash": None}},
            )
            raise
    await AdminAuditLog(
        admin_user_id=str(admin.id),
        admin_email=admin.email,
        action="mfa_recovery.approved" if payload.approve else "mfa_recovery.rejected",
        target_type="user",
        target_id=entry.user_id,
        reason=payload.reason.strip(),
    ).insert()
    return {
        "message": "Recovery email sent to the registered address."
        if payload.approve
        else "Recovery request rejected."
    }


async def claim(token: str, status: str, next_status: str) -> dict:
    entry = await MfaRecovery.get_pymongo_collection().find_one_and_update(
        {
            "token_hash": hash_reset_token(token),
            "status": status,
            "expires_at": {"$gt": now()},
            "attempts": {"$lt": 5},
        },
        {"$set": {"status": next_status}, "$inc": {"attempts": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not entry:
        raise AuthError(
            "Recovery link expired, already used, or too many attempts. Request a new link."
        )
    return entry


@router.post("/auth/mfa-recovery/verify", response_model=RecoverySetup)
async def verify_recovery(
    payload: RecoveryVerify, background: BackgroundTasks, response: Response
) -> dict:
    response.headers["Cache-Control"] = "no-store"
    entry = await claim(payload.token, "approved", "verifying")
    collection = MfaRecovery.get_pymongo_collection()
    try:
        user = await eligible(entry["user_id"], entry["token_version"])
        if not verify_password(payload.password, user.hashed_password):
            await _record_failed_login(user, background)
            raise AuthError("Password or recovery code is not correct.")
        consumed = await RecoveryCode.get_pymongo_collection().find_one_and_delete(
            {"user_id": str(user.id), "code_hash": hash_recovery_code(payload.recovery_code)}
        )
        if not consumed:
            await _record_failed_login(user, background)
            raise AuthError("Password or recovery code is not correct.")
        secret = generate_totp_secret()
        setup_token = generate_reset_token()
        await collection.update_one(
            {"_id": entry["_id"], "status": "verifying"},
            {
                "$set": {
                    "status": "setup",
                    "token_hash": hash_reset_token(setup_token),
                    "secret_encrypted": encrypt_totp_secret(secret),
                    "attempts": 0,
                }
            },
        )
        return {
            "setup_token": setup_token,
            "secret": secret,
            "provisioning_uri": totp_uri(secret, user.email),
        }
    except Exception:
        await collection.update_one(
            {"_id": entry["_id"], "status": "verifying"}, {"$set": {"status": "approved"}}
        )
        raise


@router.post("/auth/mfa-recovery/complete", response_model=RecoveryResult)
async def complete_recovery(
    payload: RecoveryComplete, background: BackgroundTasks, response: Response
) -> dict:
    response.headers["Cache-Control"] = "no-store"
    entry = await claim(payload.setup_token, "setup", "completing")
    try:
        user = await eligible(entry["user_id"], entry["token_version"])
        secret = decrypt_totp_secret(entry["secret_encrypted"])
        counter = int(now().timestamp()) // 30

        accepted = next(
            (
                step
                for step in (counter - 1, counter, counter + 1)
                if hmac.compare_digest(payload.code, _totp(secret, step))
            ),
            None,
        )
        if accepted is None:
            raise AuthError("The new authenticator code is not correct.")
        user = await update_user(
            user,
            {
                "totp_enabled": True,
                "totp_secret_encrypted": entry["secret_encrypted"],
                "totp_last_counter": accepted,
                "failed_login_attempts": 0,
                "locked_until": None,
            },
            revoke=True,
        )
        codes = await _replace_recovery_codes(str(user.id))
        await PasswordResetToken.find(PasswordResetToken.user_id == str(user.id)).delete()
        await PasskeyChallenge.find(PasskeyChallenge.user_id == str(user.id)).delete()
        await MfaRecovery.get_pymongo_collection().update_one(
            {"_id": entry["_id"]},
            {"$set": {"status": "completed", "token_hash": None, "secret_encrypted": None}},
        )
        background.add_task(
            _send_quietly,
            "MFA recovery completed",
            send_security_alert_email,
            to=user.email,
            title="Authenticator replaced",
            detail=(
                "Your authenticator was replaced through account recovery. "
                "Existing sessions and recovery codes were invalidated. "
                "Sign in using your new authenticator. "
                "If this was not you, contact support immediately."
            ),
        )
        return {
            "codes": codes,
            "message": "Authenticator replaced. Save your new recovery codes, then sign in.",
        }
    except Exception:
        await MfaRecovery.get_pymongo_collection().update_one(
            {"_id": entry["_id"], "status": "completing"}, {"$set": {"status": "setup"}}
        )
        raise
