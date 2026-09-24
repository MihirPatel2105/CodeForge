"""Optional WebAuthn passkeys; passwords and existing TOTP remain available."""

import base64
import json
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Request, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.api.auth import _send_quietly, finish_login
from app.config import settings
from app.core.deps import CurrentUser
from app.core.email import send_security_alert_email
from app.core.exceptions import (
    AccountSuspendedError,
    AuthError,
    ConflictError,
    NotFoundError,
    RateLimitError,
)
from app.core.security import decrypt_totp_secret, hash_reset_token, verify_password, verify_totp
from app.models import PasskeyChallenge, PasskeyCredential, User

router = APIRouter(prefix="/auth/passkeys", tags=["auth"])
CHALLENGE_LIFETIME = timedelta(minutes=5)


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _now() -> datetime:
    return datetime.now(UTC)


def _rp_id() -> str:
    host = urlsplit(settings.app_base_url).hostname
    if not host:
        raise RuntimeError("APP_BASE_URL must contain a hostname for passkeys")
    return host


def _origins() -> list[str]:
    # Never trust an origin sent in the browser's request body. Only configured
    # frontend origins for the RP host can complete a ceremony.
    rp_id = _rp_id()
    configured = [settings.app_base_url.rstrip("/"), *settings.cors_origins]
    return list(
        dict.fromkeys(
            origin.rstrip("/") for origin in configured if urlsplit(origin).hostname == rp_id
        )
    )


async def _new_challenge(purpose: str, challenge: bytes, user_id: str | None = None) -> str:
    challenge_id = secrets.token_urlsafe(32)
    await PasskeyChallenge(
        challenge_id=challenge_id,
        challenge=_b64(challenge),
        purpose=purpose,
        user_id=user_id,
        expires_at=_now() + CHALLENGE_LIFETIME,
    ).insert()
    return challenge_id


async def _consume(challenge_id: str, purpose: str, user_id: str | None = None) -> PasskeyChallenge:
    query: dict[str, str] = {"challenge_id": challenge_id, "purpose": purpose}
    if user_id is not None:
        query["user_id"] = user_id
    document = await PasskeyChallenge.get_pymongo_collection().find_one_and_delete(query)
    if document is None:
        raise AuthError("This passkey request is invalid or has expired. Try again.")
    challenge = PasskeyChallenge.model_validate(document)
    expires_at = challenge.expires_at
    if (expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)) <= _now():
        raise AuthError("This passkey request is invalid or has expired. Try again.")
    return challenge


def _reauth(user: User, password: str, totp_code: str | None) -> None:
    if not verify_password(password, user.hashed_password):
        raise AuthError("Your current password is not correct")
    if user.totp_enabled and (
        not user.totp_secret_encrypted
        or not totp_code
        or not verify_totp(totp_code, decrypt_totp_secret(user.totp_secret_encrypted))
    ):
        raise AuthError("The two-factor code is not correct")


class PasskeyReauth(BaseModel):
    current_password: str
    totp_code: str | None = None


class PasskeyOptions(BaseModel):
    challenge_id: str
    options: dict


class PasskeyRegistration(BaseModel):
    challenge_id: str
    credential: dict
    label: str = Field(min_length=1, max_length=60)


class PasskeyAssertion(BaseModel):
    challenge_id: str
    credential: dict


class PasskeyMfa(BaseModel):
    ticket: str
    totp_code: str = Field(min_length=6, max_length=8)


class PasskeyLoginResult(BaseModel):
    access_token: str | None = None
    mfa_required: bool = False
    mfa_ticket: str | None = None


class PasskeyInfo(BaseModel):
    id: str
    label: str
    created_at: datetime
    last_used_at: datetime | None


@router.get("", response_model=list[PasskeyInfo])
async def list_passkeys(user: CurrentUser) -> list[PasskeyInfo]:
    credentials = await PasskeyCredential.find(PasskeyCredential.user_id == str(user.id)).to_list()
    return [
        PasskeyInfo(
            id=str(credential.id),
            label=credential.label,
            created_at=credential.created_at,
            last_used_at=credential.last_used_at,
        )
        for credential in credentials
    ]


@router.post("/register/options", response_model=PasskeyOptions)
async def registration_options(payload: PasskeyReauth, user: CurrentUser) -> PasskeyOptions:
    _reauth(user, payload.current_password, payload.totp_code)
    existing = await PasskeyCredential.find(PasskeyCredential.user_id == str(user.id)).to_list()
    if len(existing) >= 10:
        raise RateLimitError(
            "This account already has 10 passkeys. Remove one before adding another."
        )
    options = generate_registration_options(
        rp_id=_rp_id(),
        rp_name="CodeForge",
        user_name=user.email,
        user_id=str(user.id).encode(),
        user_display_name=user.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id))
            for item in existing
        ],
    )
    challenge_id = await _new_challenge("register", options.challenge, str(user.id))
    return PasskeyOptions(challenge_id=challenge_id, options=json.loads(options_to_json(options)))


@router.post("/register/verify", response_model=PasskeyInfo, status_code=status.HTTP_201_CREATED)
async def register_passkey(
    payload: PasskeyRegistration, user: CurrentUser, background: BackgroundTasks
) -> PasskeyInfo:
    challenge = await _consume(payload.challenge_id, "register", str(user.id))
    try:
        verified = verify_registration_response(
            credential=payload.credential,
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_origins(),
            require_user_verification=True,
        )
    except (WebAuthnException, ValueError, KeyError, TypeError) as exc:
        raise AuthError("Passkey verification failed. Try adding it again.") from exc
    credential = PasskeyCredential(
        user_id=str(user.id),
        credential_id=_b64(verified.credential_id),
        public_key=_b64(verified.credential_public_key),
        sign_count=verified.sign_count,
        label=payload.label.strip(),
    )
    if not credential.label:
        raise AuthError("Give this passkey a name")
    try:
        await credential.insert()
    except DuplicateKeyError as exc:
        raise ConflictError("This passkey is already registered") from exc
    if user.email_verified and settings.email_verification_enabled:
        background.add_task(
            _send_quietly,
            "Passkey-added notice",
            send_security_alert_email,
            to=user.email,
            title="Passkey added",
            detail=f'A passkey named "{credential.label}" was added to your account.',
        )
    return PasskeyInfo(
        id=str(credential.id),
        label=credential.label,
        created_at=credential.created_at,
        last_used_at=None,
    )


@router.post("/{passkey_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_passkey(
    passkey_id: str, payload: PasskeyReauth, user: CurrentUser, background: BackgroundTasks
) -> None:
    _reauth(user, payload.current_password, payload.totp_code)
    try:
        credential = await PasskeyCredential.get(passkey_id)
    except ValueError:
        credential = None
    if credential is None or credential.user_id != str(user.id):
        raise NotFoundError("Passkey not found")
    await credential.delete()
    if user.email_verified and settings.email_verification_enabled:
        background.add_task(
            _send_quietly,
            "Passkey-removed notice",
            send_security_alert_email,
            to=user.email,
            title="Passkey removed",
            detail=f'A passkey named "{credential.label}" was removed from your account.',
        )


@router.post("/login/options", response_model=PasskeyOptions)
async def login_options() -> PasskeyOptions:
    options = generate_authentication_options(
        rp_id=_rp_id(), user_verification=UserVerificationRequirement.REQUIRED
    )
    challenge_id = await _new_challenge("login", options.challenge)
    return PasskeyOptions(challenge_id=challenge_id, options=json.loads(options_to_json(options)))


@router.post("/login/verify", response_model=PasskeyLoginResult)
async def login_passkey(
    payload: PasskeyAssertion, background: BackgroundTasks, request: Request
) -> PasskeyLoginResult:
    challenge = await _consume(payload.challenge_id, "login")
    credential_id = payload.credential.get("id")
    if not isinstance(credential_id, str):
        raise AuthError("Passkey verification failed")
    credential = await PasskeyCredential.find_one(PasskeyCredential.credential_id == credential_id)
    if credential is None:
        raise AuthError("Passkey verification failed")
    user = await User.get(credential.user_id)
    if user is None:
        raise AuthError("Passkey verification failed")
    try:
        verified = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_origins(),
            credential_public_key=base64url_to_bytes(credential.public_key),
            credential_current_sign_count=credential.sign_count,
            require_user_verification=True,
        )
    except (WebAuthnException, ValueError, KeyError, TypeError) as exc:
        raise AuthError("Passkey verification failed") from exc
    if verified.credential_id != base64url_to_bytes(credential.credential_id):
        raise AuthError("Passkey verification failed")
    if user.is_suspended:
        raise AccountSuspendedError("This account is suspended. Contact the administrator.")
    if user.password_reset_required:
        raise AuthError("Reset your password before signing in again.")
    if user.locked_until:
        locked_until = user.locked_until
        if (locked_until if locked_until.tzinfo else locked_until.replace(tzinfo=UTC)) > _now():
            raise RateLimitError(
                "Too many failed attempts. Try again after the account lock expires."
            )
    credential.sign_count = verified.new_sign_count
    credential.last_used_at = _now()
    await credential.save()
    if user.totp_enabled:
        ticket = secrets.token_urlsafe(32)
        await PasskeyChallenge(
            challenge_id=hash_reset_token(ticket),
            challenge="",
            purpose="mfa",
            user_id=str(user.id),
            expires_at=_now() + CHALLENGE_LIFETIME,
        ).insert()
        return PasskeyLoginResult(mfa_required=True, mfa_ticket=ticket)
    return PasskeyLoginResult(access_token=await finish_login(user, background, request))


@router.post("/login/complete", response_model=PasskeyLoginResult)
async def complete_passkey_login(
    payload: PasskeyMfa, background: BackgroundTasks, request: Request
) -> PasskeyLoginResult:
    challenge = await _consume(hash_reset_token(payload.ticket), "mfa")
    user = await User.get(challenge.user_id) if challenge.user_id else None
    if user is None or not user.totp_enabled or not user.totp_secret_encrypted:
        raise AuthError("This sign-in request is invalid or has expired. Try again.")
    if not verify_totp(payload.totp_code, decrypt_totp_secret(user.totp_secret_encrypted)):
        raise AuthError("The two-factor code is not correct. Start passkey sign-in again.")
    if user.is_suspended or user.password_reset_required:
        raise AuthError("This account cannot sign in right now.")
    return PasskeyLoginResult(access_token=await finish_login(user, background, request))
