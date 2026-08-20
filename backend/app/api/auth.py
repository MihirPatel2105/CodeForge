"""Auth routes. CodeForge issues its own JWTs and verifies them itself.

Sign-up is two steps when email verification is configured: `register` takes the details
and mails a code, `verify-email` exchanges the code for an account and a session. No
`User` document exists in between — see `models/pending_signup.py` for why.
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, status

from app.config import settings
from app.core.deps import CurrentUser, TokenClaims
from app.core.email import (
    send_account_deleted_email,
    send_password_changed_email,
    send_password_reset_email,
    send_verification_code,
    send_welcome_email,
)
from app.core.exceptions import AuthError, ConflictError, NotFoundError, RateLimitError
from app.core.security import (
    create_access_token,
    generate_otp,
    generate_reset_token,
    hash_otp,
    hash_password,
    hash_reset_token,
    verify_otp,
    verify_password,
)
from app.db.artifacts import delete_run_artifacts
from app.graph import executor
from app.models import PasswordResetToken, PendingSignup, Project, RevokedToken, Run, User
from app.schemas.api import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    DeleteAccountResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendCodeRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


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
async def register(payload: RegisterRequest) -> RegisterResponse:
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
        )
        await user.insert()
        return RegisterResponse(
            email=user.email,
            verification_required=False,
            access_token=create_access_token(str(user.id), token_version=user.token_version),
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
async def verify_email(payload: VerifyEmailRequest, background: BackgroundTasks) -> TokenResponse:
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

    return TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version)
    )


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


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    user = await User.find_one(User.email == payload.email)
    # Same message whether the email is unknown or the password is wrong, so the endpoint
    # cannot be used to enumerate registered addresses. An unverified sign-up has no
    # User document at all, so it lands here too — nothing extra to check.
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AuthError("Incorrect email or password")

    return TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version)
    )


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
    payload: ResetPasswordRequest, background: BackgroundTasks
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
    # Same as an explicit password change: every session this token might have been
    # phished alongside, or any that predate the reset, stops working at once.
    user.token_version += 1
    await user.save()

    # Single-use: gone whether it succeeded or not, so the same link cannot be replayed.
    await reset.delete()

    background.add_task(
        _send_quietly,
        "Password-changed notice",
        send_password_changed_email,
        to=user.email,
        first_name=user.first_name,
    )

    return TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version)
    )


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
    payload: ChangePasswordRequest, user: CurrentUser, background: BackgroundTasks
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
    return TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version)
    )


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        created_at=user.created_at,
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
    if not verify_password(payload.password, user.hashed_password):
        # Same wording as a failed login. Confirming that the token's owner exists but
        # the password was wrong is fine — the caller already proved they hold a session
        # for this account — but there is no reason to phrase it differently.
        raise AuthError("Incorrect password")

    uid = str(user.id)
    # Read off the document before it is deleted — afterwards there is nothing to read
    # the address from, and this is the last message this address will ever get.
    email, first_name = user.email, user.first_name
    runs = await Run.find(Run.user_id == uid).to_list()
    run_ids = [str(run.id) for run in runs]

    # Stop anything still executing before its documents are removed, or the graph would
    # carry on writing state for a run that no longer exists.
    for run_id in run_ids:
        executor.cancel(run_id)

    # Children first: if this fails partway, the account is still there to find the
    # leftovers by. Deleting the user first would strand them with no owner to search on.
    artifacts_deleted = await delete_run_artifacts(run_ids)
    runs_deleted = (await Run.find(Run.user_id == uid).delete()).deleted_count
    projects_deleted = (await Project.find(Project.user_id == uid).delete()).deleted_count
    # An abandoned sign-up for the same address would otherwise outlive the account and
    # block re-registering with it until Mongo's TTL sweep caught up.
    await PendingSignup.find(PendingSignup.email == user.email).delete()
    await user.delete()

    logger.info(
        "Account %s deleted: %d runs, %d projects, %d artifacts",
        uid,
        runs_deleted,
        projects_deleted,
        artifacts_deleted,
    )
    background.add_task(
        _send_quietly,
        "Account-deleted notice",
        send_account_deleted_email,
        to=email,
        first_name=first_name,
        projects=projects_deleted,
        runs=runs_deleted,
    )

    return DeleteAccountResponse(
        projects_deleted=projects_deleted,
        runs_deleted=runs_deleted,
        artifacts_deleted=artifacts_deleted,
    )
