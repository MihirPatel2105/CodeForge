"""Auth routes. CodeForge issues its own JWTs and verifies them itself.

Sign-up is two steps when email verification is configured: `register` takes the details
and mails a code, `verify-email` exchanges the code for an account and a session. No
`User` document exists in between — see `models/pending_signup.py` for why.
"""

import logging
import secrets
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request, status
from pymongo import ReturnDocument

from app.config import settings
from app.core.account_deletion import delete_user_account
from app.core.deps import CurrentUser, TokenClaims, is_admin_user
from app.core.email import (
    send_account_deleted_email,
    send_new_device_email,
    send_password_changed_email,
    send_password_reset_email,
    send_security_alert_email,
    send_verification_code,
    send_welcome_email,
)
from app.core.exceptions import (
    AccountSuspendedError,
    AuthError,
    ConflictError,
    NotFoundError,
    RateLimitError,
)
from app.core.login_activity import issue_session, revoke_device_sessions
from app.core.security import (
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_otp,
    generate_reset_token,
    generate_totp_secret,
    hash_otp,
    hash_password,
    hash_reset_token,
    totp_uri,
    verify_otp,
    verify_password,
    verify_totp,
)
from app.models import (
    Device,
    LoginSession,
    PasskeyChallenge,
    PasskeyCredential,
    PasswordResetToken,
    PendingSignup,
    RevokedToken,
    SignInAlert,
    User,
)
from app.schemas.api import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    DeleteAccountResponse,
    DeviceResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginCompleteRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    ResetPasswordRequest,
    SignInAlertResponse,
    SignInAlertResponseRequest,
    TokenResponse,
    TotpDisableRequest,
    TotpSetupRequest,
    TotpSetupResponse,
    TotpVerifyRequest,
    UserResponse,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
PASSWORD_MFA_LIFETIME = timedelta(minutes=5)
PASSWORD_MFA_MAX_ATTEMPTS = 5


def _now() -> datetime:
    """Timezone-aware, because these values are compared against stored dates.

    Mongo returns datetimes as naive UTC, and comparing a naive to an aware datetime
    raises rather than returning a wrong answer — so stored dates are re-tagged on read
    (`_as_utc`) instead of this being made naive.
    """
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _issue_code(pending: PendingSignup) -> None:
    """Mint a fresh code, store its hash, and mail it.

    The document is saved only after the mail server accepts the message: if delivery
    fails, the previous code stays valid rather than the account being left waiting for
    a code that was never sent.
    """
    code = generate_otp()
    await send_verification_code(to=pending.email, code=code, first_name=pending.first_name)

    pending.code_hash = hash_otp(code)
    pending.expires_at = _now() + timedelta(minutes=settings.otp_ttl_minutes)
    pending.last_sent_at = _now()
    pending.attempts = 0  # a new code gets a full budget; the old one is gone
    await pending.save()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request) -> RegisterResponse:
    if await User.find_one(User.email == payload.email) is not None:
        raise ConflictError("An account with that email already exists")

    hashed = hash_password(payload.password)

    if not settings.email_verification_enabled:
        # No mail server configured: sign up exactly as before rather than making
        # registration impossible. `main.py` warns about this at startup.
        user = User(
            email=payload.email,
            hashed_password=hashed,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email_verified=False,
        )
        await user.insert()
        token, _, _ = await issue_session(user, request)
        return RegisterResponse(
            email=user.email,
            verification_required=False,
            access_token=token,
        )

    # A second attempt on the same address overwrites the first: the details may have
    # been corrected, and two live codes for one inbox is a worse experience than one.
    pending = await PendingSignup.find_one(PendingSignup.email == payload.email)
    if pending is None:
        pending = PendingSignup(
            email=payload.email,
            hashed_password=hashed,
            first_name=payload.first_name,
            last_name=payload.last_name,
            code_hash="",
            expires_at=_now(),
        )
        await pending.insert()
    else:
        _require_off_cooldown(pending)
        pending.hashed_password = hashed
        pending.first_name = payload.first_name
        pending.last_name = payload.last_name

    await _issue_code(pending)
    return RegisterResponse(
        email=pending.email,
        verification_required=True,
        # Re-tagged as UTC before it leaves: a naive ISO string is parsed by JavaScript
        # as *local* time, so the browser's countdown would be wrong by the client's
        # timezone offset — in IST, expired before it was shown.
        expires_at=_as_utc(pending.expires_at),
    )


def _require_off_cooldown(pending: PendingSignup) -> None:
    """Rate-limit sends, so the endpoint cannot be used to flood someone's inbox."""
    elapsed = (_now() - _as_utc(pending.last_sent_at)).total_seconds()
    remaining = settings.otp_resend_cooldown_seconds - elapsed
    if remaining > 0:
        raise RateLimitError(f"Please wait {int(remaining) + 1}s before requesting another code")


async def _send_quietly(what: str, send: Callable[..., Awaitable[None]], **kwargs: Any) -> None:
    """Deliver a notification, or shrug.

    Every caller runs this after the thing it describes has already happened — the
    account exists, the password moved, the data is gone. A mail server having a bad
    minute must not turn a completed operation into an error the user sees, so failures
    are logged rather than raised.
    """
    try:
        await send(**kwargs)
    except Exception:  # noqa: BLE001 — no notification is worth failing an operation over
        logger.exception("%s to %s failed", what, kwargs.get("to"))


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(
    payload: VerifyEmailRequest, background: BackgroundTasks, request: Request
) -> TokenResponse:
    pending = await PendingSignup.find_one(PendingSignup.email == payload.email)
    if pending is None:
        # Covers an unknown address, an expired row Mongo already swept, and a code
        # that was already used. One message for all three: which one it was is not
        # the caller's business.
        raise NotFoundError("No pending sign-up for that email. Please sign up again.")

    if _as_utc(pending.expires_at) <= _now():
        await pending.delete()
        raise AuthError("That code has expired. Please sign up again.")

    if pending.attempts >= settings.otp_max_attempts:
        await pending.delete()
        raise RateLimitError("Too many incorrect codes. Please sign up again.")

    if not verify_otp(payload.code, pending.code_hash):
        # Counted before the response is sent, so a client that gives up mid-request
        # still spends the attempt.
        pending.attempts += 1
        await pending.save()
        remaining = settings.otp_max_attempts - pending.attempts
        raise AuthError(f"That code is not correct. {remaining} attempt(s) left.")

    # Last check before creating the account: the address could have been registered by
    # another sign-up while this code was in the inbox.
    if await User.find_one(User.email == pending.email) is not None:
        await pending.delete()
        raise ConflictError("An account with that email already exists")

    user = User(
        email=pending.email,
        hashed_password=pending.hashed_password,
        first_name=pending.first_name,
        last_name=pending.last_name,
        email_verified=True,
    )
    await user.insert()
    await pending.delete()  # the code cannot be replayed

    # After the response, not before it: an SMTP round trip is seconds, and nobody
    # should watch a spinner for a message they have not opened yet. This is the one
    # place it is sent, so it arrives exactly once — on the run that creates the account.
    background.add_task(
        _send_quietly,
        "Welcome email",
        send_welcome_email,
        to=user.email,
        first_name=user.first_name,
    )

    token, _, _ = await issue_session(user, request)
    return TokenResponse(access_token=token)


@router.post("/resend-code", response_model=RegisterResponse)
async def resend_code(payload: ResendCodeRequest) -> RegisterResponse:
    pending = await PendingSignup.find_one(PendingSignup.email == payload.email)
    if pending is None:
        raise NotFoundError("No pending sign-up for that email. Please sign up again.")

    _require_off_cooldown(pending)
    await _issue_code(pending)
    return RegisterResponse(
        email=pending.email,
        verification_required=True,
        # Re-tagged as UTC before it leaves: a naive ISO string is parsed by JavaScript
        # as *local* time, so the browser's countdown would be wrong by the client's
        # timezone offset — in IST, expired before it was shown.
        expires_at=_as_utc(pending.expires_at),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest, background: BackgroundTasks, request: Request
) -> LoginResponse:
    user = await User.find_one(User.email == payload.email)
    # Same message whether the email is unknown or the password is wrong, so the endpoint
    # cannot be used to enumerate registered addresses. An unverified sign-up has no
    # User document at all, so it lands here too — nothing extra to check.
    if user is None:
        raise AuthError("Incorrect email or password")

    now = _now()
    if user.locked_until and _as_utc(user.locked_until) > now:
        raise RateLimitError("Too many failed attempts. Try again after the account lock expires.")

    if not verify_password(payload.password, user.hashed_password):
        await _record_failed_login(user, background)
        raise AuthError("Incorrect email or password")

    if user.is_suspended:
        raise AccountSuspendedError("This account is suspended. Contact the administrator.")

    if user.password_reset_required:
        raise AuthError("Reset your password before signing in again.")

    passkey = await PasskeyCredential.find_one(PasskeyCredential.user_id == str(user.id))
    methods: list[str] = []
    if user.totp_enabled:
        methods.append("totp")
    if passkey is not None:
        methods.append("passkey")

    if methods:
        ticket = secrets.token_urlsafe(32)
        await PasskeyChallenge(
            challenge_id=hash_reset_token(ticket),
            challenge="",
            purpose="password_mfa",
            user_id=str(user.id),
            expires_at=now + PASSWORD_MFA_LIFETIME,
            token_version=user.token_version,
        ).insert()
        return LoginResponse(mfa_required=True, mfa_ticket=ticket, mfa_methods=methods)

    token = await finish_login(user, background, request)
    return LoginResponse(access_token=token)


async def _record_failed_login(user: User, background: BackgroundTasks) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= settings.login_max_attempts:
        user.locked_until = _now() + timedelta(minutes=settings.login_lockout_minutes)
        user.failed_login_attempts = 0
        background.add_task(
            _send_quietly,
            "Security alert",
            send_security_alert_email,
            to=user.email,
            title="Account temporarily locked",
            detail=(
                f"CodeForge blocked sign-in for {settings.login_lockout_minutes} minutes "
                "after repeated failed attempts."
            ),
        )
    await user.save()


async def password_mfa_user(ticket: str) -> User:
    challenge = await PasskeyChallenge.find_one(
        PasskeyChallenge.challenge_id == hash_reset_token(ticket),
        PasskeyChallenge.purpose == "password_mfa",
    )
    if challenge is None or _as_utc(challenge.expires_at) <= _now() or not challenge.user_id:
        raise AuthError("This verification request has expired. Sign in again.")
    user = await User.get(challenge.user_id)
    if user is None or challenge.token_version != user.token_version:
        raise AuthError("This verification request has expired. Sign in again.")
    if user.is_suspended or user.password_reset_required:
        raise AuthError("This account cannot sign in right now.")
    if user.locked_until and _as_utc(user.locked_until) > _now():
        raise RateLimitError("Too many failed attempts. Try again after the account lock expires.")
    return user


async def consume_password_mfa_ticket(ticket: str, user: User) -> None:
    consumed = await PasskeyChallenge.get_pymongo_collection().find_one_and_delete(
        {
            "challenge_id": hash_reset_token(ticket),
            "purpose": "password_mfa",
            "user_id": str(user.id),
            "expires_at": {"$gt": _now()},
            "token_version": user.token_version,
        }
    )
    if consumed is None:
        raise AuthError("This verification request has expired. Sign in again.")


@router.post("/login/complete", response_model=TokenResponse)
async def complete_password_login(
    payload: LoginCompleteRequest, background: BackgroundTasks, request: Request
) -> TokenResponse:
    user = await password_mfa_user(payload.ticket)
    if not user.totp_enabled or not user.totp_secret_encrypted:
        raise AuthError("Authenticator codes are not enabled for this account.")
    attempted = await PasskeyChallenge.get_pymongo_collection().find_one_and_update(
        {
            "challenge_id": hash_reset_token(payload.ticket),
            "purpose": "password_mfa",
            "user_id": str(user.id),
            "expires_at": {"$gt": _now()},
            "attempts": {"$lt": PASSWORD_MFA_MAX_ATTEMPTS},
        },
        {"$inc": {"attempts": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if attempted is None:
        raise RateLimitError("Too many verification attempts. Sign in again.")
    if not verify_totp(payload.totp_code, decrypt_totp_secret(user.totp_secret_encrypted)):
        await _record_failed_login(user, background)
        raise AuthError("The two-factor code is not correct")
    await consume_password_mfa_ticket(payload.ticket, user)
    return TokenResponse(access_token=await finish_login(user, background, request))


async def finish_login(user: User, background: BackgroundTasks, request: Request) -> str:
    """Apply the same session and new-device alert rules to every sign-in method."""
    now = _now()
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    await user.save()
    token, device, is_new = await issue_session(user, request)
    if is_new and user.email_verified and settings.email_verification_enabled:
        alert_token = generate_reset_token()
        await SignInAlert(
            user_id=str(user.id),
            device_hash=device.device_hash,
            token_hash=hash_reset_token(alert_token),
            expires_at=now + timedelta(hours=24),
        ).insert()
        background.add_task(
            _send_quietly,
            "New-device sign-in notice",
            send_new_device_email,
            to=user.email,
            label=device.label,
            ip_address=device.ip_address,
            occurred_at=now,
            review_url=f"{settings.app_base_url}/sign-in-alert/{alert_token}",
        )
    return token


@router.post("/totp/setup", response_model=TotpSetupResponse)
async def setup_totp(payload: TotpSetupRequest, user: CurrentUser) -> TotpSetupResponse:
    if not verify_password(payload.current_password, user.hashed_password):
        raise AuthError("Your current password is not correct")
    secret = generate_totp_secret()
    user.totp_secret_encrypted = encrypt_totp_secret(secret)
    user.totp_enabled = False
    await user.save()
    return TotpSetupResponse(secret=secret, provisioning_uri=totp_uri(secret, user.email))


@router.post("/totp/verify", status_code=status.HTTP_204_NO_CONTENT)
async def enable_totp(payload: TotpVerifyRequest, user: CurrentUser) -> None:
    if not user.totp_secret_encrypted:
        raise ConflictError("Start two-factor setup before verifying a code")
    if not verify_totp(payload.code, decrypt_totp_secret(user.totp_secret_encrypted)):
        raise AuthError("The two-factor code is not correct")
    user.totp_enabled = True
    await user.save()


@router.post("/totp/disable", response_model=TokenResponse)
async def disable_totp(
    payload: TotpDisableRequest, user: CurrentUser, request: Request
) -> TokenResponse:
    if not verify_password(payload.current_password, user.hashed_password):
        raise AuthError("Your current password is not correct")
    if not user.totp_enabled or not user.totp_secret_encrypted:
        raise ConflictError("Two-factor authentication is not enabled")
    if not verify_totp(payload.code, decrypt_totp_secret(user.totp_secret_encrypted)):
        raise AuthError("The two-factor code is not correct")
    user.totp_enabled = False
    user.totp_secret_encrypted = None
    user.token_version += 1
    await user.save()
    token, _, _ = await issue_session(user, request)
    return TokenResponse(access_token=token)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest, background: BackgroundTasks
) -> ForgotPasswordResponse:
    """Start a password reset. Always answers the same way.

    The response is identical whether or not the address has an account, and it returns
    before any email is sent — scheduled as a background task rather than awaited — so
    there is no timing difference between "sent" and "nothing to send" either. Without
    both of those this endpoint would double as a way to check who has signed up.
    """
    user = await User.find_one(User.email == payload.email)
    if user is not None:
        background.add_task(_send_reset_link, user)
    return ForgotPasswordResponse()


async def _send_reset_link(user: User) -> None:
    """Issue a token and mail it, or do nothing if one was issued too recently.

    One token at a time per account, the same rule `PendingSignup` follows for sign-up
    codes: a fresh request replaces the previous link rather than leaving two live ones,
    and the cooldown is measured against the newest one's creation time.
    """
    uid = str(user.id)
    existing = await PasswordResetToken.find_one(PasswordResetToken.user_id == uid)
    if existing is not None:
        elapsed = (_now() - _as_utc(existing.created_at)).total_seconds()
        if elapsed < settings.reset_resend_cooldown_seconds:
            return
        await existing.delete()

    token = generate_reset_token()
    await PasswordResetToken(
        user_id=uid,
        email=user.email,
        token_hash=hash_reset_token(token),
        expires_at=_now() + timedelta(minutes=settings.reset_token_ttl_minutes),
    ).insert()

    reset_url = f"{settings.app_base_url}/reset-password/{token}"
    try:
        await send_password_reset_email(
            to=user.email, reset_url=reset_url, first_name=user.first_name
        )
    except Exception:  # noqa: BLE001 — a failed send here has no caller left to tell
        logger.exception("Password reset email to %s failed", user.email)


@router.post("/reset-password", response_model=TokenResponse)
async def reset_password(
    payload: ResetPasswordRequest, background: BackgroundTasks, request: Request
) -> TokenResponse:
    """Exchange a reset link for a new password and a session.

    The token names the account on its own — nothing else identifies who is resetting
    what, which is the entire point of a mailed link. One message covers a token that
    never existed, one already used, and one that expired: which of those it was is not
    the caller's business, the same reasoning `/verify-email` applies to a bad code.
    """
    reset = await PasswordResetToken.find_one(
        PasswordResetToken.token_hash == hash_reset_token(payload.token)
    )
    if reset is None or _as_utc(reset.expires_at) <= _now():
        if reset is not None:
            await reset.delete()
        raise AuthError("This link is invalid or has expired. Request a new one.")

    user = await User.get(reset.user_id)
    if user is None:
        # The account was deleted after the link was sent.
        await reset.delete()
        raise AuthError("This link is invalid or has expired. Request a new one.")

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_required = False
    # Same as an explicit password change: every session this token might have been
    # phished alongside, or any that predate the reset, stops working at once.
    user.token_version += 1
    await user.save()

    # Single-use: gone whether it succeeded or not, so the same link cannot be replayed.
    await reset.delete()
    await SignInAlert.find(SignInAlert.user_id == str(user.id)).delete()
    # A reset link is the recovery path after credential compromise. A passkey added
    # by the attacker must not survive the reset and reopen the account.
    await PasskeyCredential.find(PasskeyCredential.user_id == str(user.id)).delete()
    await PasskeyChallenge.find(PasskeyChallenge.user_id == str(user.id)).delete()

    background.add_task(
        _send_quietly,
        "Password-changed notice",
        send_password_changed_email,
        to=user.email,
        first_name=user.first_name,
    )

    token, _, _ = await issue_session(user, request)
    return TokenResponse(access_token=token)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out(user: CurrentUser, claims: TokenClaims) -> None:
    """End this session on the server, not just in the browser that asked.

    Deleting the token client-side is not a sign-out: the token stays valid until it
    expires, so a copy taken from local storage keeps working. Recording its `jti` here
    means the session is over the moment this returns, wherever that copy is presented
    from — while every other device this account is signed in on carries on untouched.

    Idempotent, and deliberately forgiving: a token with no `jti` predates this feature
    and a second call for the same one is not an error. Neither case should show the
    user a failure on their way out.
    """
    jti = claims.get("jti")
    if not jti:
        return

    if await RevokedToken.find_one(RevokedToken.jti == jti) is not None:
        return

    # Kept only until the token would have expired anyway; after that the signature is
    # refused on its own and Mongo's TTL sweep drops the row.
    expires_at = datetime.fromtimestamp(claims["exp"], tz=UTC)
    await RevokedToken(jti=jti, expires_at=expires_at, revoked_at=_now()).insert()
    session = await LoginSession.find_one(LoginSession.jti == jti)
    if session is not None:
        session.revoked_at = _now()
        await session.save()


@router.post("/sign-out-everywhere", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out_everywhere(user: CurrentUser) -> None:
    """End every session on every device, including the one calling this.

    Ordinary sign-out is a client-side act: it deletes the token from that browser and
    the server is never told. That is the right default — signing out of a laptop should
    not sign out a phone — but it means a token copied elsewhere keeps working until it
    expires. This is the escape hatch for when that matters.

    Bumping the generation is the whole implementation: `get_current_user` refuses any
    token whose `tv` is behind the account's, so every issued token dies at once. No
    replacement is handed back — the point is to be signed out.
    """
    user.token_version += 1
    await user.save()


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, background: BackgroundTasks, request: Request
) -> TokenResponse:
    """Replace the account password and end every other session.

    The current password is required even though the caller already holds a valid token:
    the token is what an attacker who walked up to an unlocked laptop would have, and it
    should not be enough to lock the owner out of their own account.
    """
    if not verify_password(payload.current_password, user.hashed_password):
        raise AuthError("Your current password is not correct")

    if verify_password(payload.new_password, user.hashed_password):
        # Not a security control — it just means the request did nothing, and silently
        # succeeding would look identical to a change that worked.
        raise ConflictError("The new password is the same as your current one")

    user.hashed_password = hash_password(payload.new_password)
    # Every token issued before this moment stops working, which is the point: if the
    # old password leaked, the sessions it opened have to die with it.
    user.token_version += 1
    await user.save()

    # Whoever owns this address hears about it, whether or not they are the one who did
    # it — that is the entire value of the message.
    background.add_task(
        _send_quietly,
        "Password-changed notice",
        send_password_changed_email,
        to=user.email,
        first_name=user.first_name,
    )

    # A fresh token for the browser doing the changing, so the person who just proved
    # they own the account is not the one signed out by their own action.
    token, _, _ = await issue_session(user, request)
    return TokenResponse(access_token=token)


@router.get("/devices", response_model=list[DeviceResponse])
async def list_devices(user: CurrentUser, claims: TokenClaims) -> list[DeviceResponse]:
    """Show browsers with at least one valid, tracked session."""
    uid = str(user.id)
    now = _now()
    sessions = await LoginSession.find(
        LoginSession.user_id == uid,
        LoginSession.token_version == user.token_version,
        LoginSession.expires_at > now,
        LoginSession.revoked_at == None,  # noqa: E711 — Beanie query expression
    ).to_list()
    by_device: dict[str, list[LoginSession]] = {}
    for session in sessions:
        by_device.setdefault(session.device_hash, []).append(session)
    devices = await Device.find(Device.user_id == uid).to_list()
    return [
        DeviceResponse(
            id=str(device.id),
            label=device.label,
            ip_address=device.ip_address,
            first_seen_at=_as_utc(device.first_seen_at),
            last_seen_at=_as_utc(device.last_seen_at),
            active_sessions=len(by_device[device.device_hash]),
            current=any(s.jti == claims.get("jti") for s in by_device[device.device_hash]),
        )
        for device in sorted(devices, key=lambda item: item.last_seen_at, reverse=True)
        if device.device_hash in by_device
    ]


@router.post("/devices/{device_id}/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out_device(device_id: str, user: CurrentUser) -> None:
    from app.core.deps import get_owned

    device = await get_owned(Device, device_id, str(user.id), "Device")
    await revoke_device_sessions(str(user.id), device.device_hash)


@router.post("/sign-in-alert/respond", response_model=SignInAlertResponse)
async def respond_to_sign_in_alert(payload: SignInAlertResponseRequest) -> SignInAlertResponse:
    """A mailed one-time link is proof of inbox access; GET never changes account state."""
    alert = await SignInAlert.find_one(SignInAlert.token_hash == hash_reset_token(payload.token))
    if alert is None or alert.resolved_at or _as_utc(alert.expires_at) <= _now():
        raise AuthError("This sign-in link is invalid or has expired.")
    user = await User.get(alert.user_id)
    if user is None:
        raise AuthError("This sign-in link is invalid or has expired.")

    if payload.response == "not_me":
        user.token_version += 1
        user.password_reset_required = True
        await user.save()
        await PasskeyCredential.find(PasskeyCredential.user_id == str(user.id)).delete()
        await PasskeyChallenge.find(PasskeyChallenge.user_id == str(user.id)).delete()
        device = await Device.find_one(
            Device.user_id == alert.user_id, Device.device_hash == alert.device_hash
        )
        if device is not None:
            await device.delete()
        message = "All sessions and passkeys ended. Reset your password before signing in again."
    else:
        message = "Sign-in confirmed. Your sessions are unchanged."
    alert.resolved_at = _now()
    alert.resolution = payload.response
    await alert.save()
    return SignInAlertResponse(message=message)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        created_at=user.created_at,
        is_admin=is_admin_user(user),
        email_verified=user.email_verified,
        totp_enabled=user.totp_enabled,
    )


@router.post("/delete-account", response_model=DeleteAccountResponse)
async def delete_account(
    payload: DeleteAccountRequest, user: CurrentUser, background: BackgroundTasks
) -> DeleteAccountResponse:
    """Close an account and remove everything it owns.

    Deliberately a POST rather than `DELETE /auth/me`: this needs a body carrying the
    password and the typed confirmation, and bodies on DELETE are permitted by the spec
    but dropped by enough proxies and clients to be a bad bet.

    Re-authenticating here rather than trusting the bearer token is the point of the
    endpoint: a token left behind on a shared machine should not be enough to destroy
    somebody's work.
    """
    if is_admin_user(user):
        raise ConflictError(
            "The configured administrator account cannot delete itself. Change ADMIN_EMAIL first."
        )

    if not verify_password(payload.password, user.hashed_password):
        # Same wording as a failed login. Confirming that the token's owner exists but
        # the password was wrong is fine — the caller already proved they hold a session
        # for this account — but there is no reason to phrase it differently.
        raise AuthError("Incorrect password")

    # Read off the document before it is deleted — afterwards there is nothing to read
    # the address from, and this is the last message this address will ever get.
    email, first_name = user.email, user.first_name
    result = await delete_user_account(user)
    background.add_task(
        _send_quietly,
        "Account-deleted notice",
        send_account_deleted_email,
        to=email,
        first_name=first_name,
        projects=result.projects_deleted,
        runs=result.runs_deleted,
    )

    return DeleteAccountResponse(
        projects_deleted=result.projects_deleted,
        runs_deleted=result.runs_deleted,
        artifacts_deleted=result.artifacts_deleted,
    )
