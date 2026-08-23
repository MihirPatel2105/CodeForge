"""The contact form.

One route, and it requires an account. Identity is taken from the token rather than the
request body: the sender's name and reply address are ones the server already verified at
sign-up, so a message cannot claim to come from someone it does not.
"""

import logging
import time

from fastapi import APIRouter, Request

from app.config import settings
from app.core.deps import CurrentUser
from app.core.email import (
    EmailDeliveryError,
    send_contact_ack,
    send_contact_message,
)
from app.core.exceptions import RateLimitError
from app.schemas.api import ContactRequest, ContactResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["contact"])

# One message per account per minute, and per client per minute.
#
# In-process and therefore per-worker: with several workers a determined sender gets one
# message per worker per window. That is accepted rather than overlooked — the mitigation
# it exists for is an accidental double-submit and casual noise, and a Mongo-backed
# counter would cost a round trip on every submission to tighten a bound nobody is
# pushing. Revisit if this ever runs behind more than one process.
_WINDOW_SECONDS = 60
_recent: dict[str, float] = {}


def _throttle(key: str) -> None:
    now = time.monotonic()

    # Opportunistic sweep: without it this dict grows for the life of the process.
    if len(_recent) > 512:
        for stale, seen in list(_recent.items()):
            if now - seen > _WINDOW_SECONDS:
                del _recent[stale]

    last = _recent.get(key)
    if last is not None and now - last < _WINDOW_SECONDS:
        raise RateLimitError("You just sent a message. Give it a minute before the next one.")
    _recent[key] = now


@router.post("/contact", response_model=ContactResponse)
async def contact(payload: ContactRequest, request: Request, user: CurrentUser) -> ContactResponse:
    """Forward a message to whoever runs this instance.

    Awaited rather than backgrounded, unlike the password-reset mail. That route has to
    answer identically whether or not an account exists, so it cannot let delivery affect
    the response; here the sender is waiting to be told their message went, and silently
    dropping it on an SMTP failure would be a lie they cannot detect.
    """
    if not settings.email_verification_enabled:
        # No SMTP credentials: there is no mailbox to deliver to. Say so rather than
        # accepting the message and discarding it.
        raise EmailDeliveryError("This server has no mail configured, so the form is off.")

    # Both come from the account, never from the request. The name was character-checked
    # at sign-up and the address was proved by the verification code, so neither needs
    # re-validating here — and neither can be spoofed.
    name = " ".join(filter(None, [user.first_name, user.last_name])) or user.email
    client = request.client.host if request.client else "unknown"
    user_key = f"user:{user.id}"

    _throttle(f"ip:{client}")
    _throttle(user_key)

    try:
        await send_contact_message(
            name=name,
            email=user.email,
            phone=payload.phone,
            message=payload.message,
        )
    except EmailDeliveryError:
        # Let the sender retry rather than burning their throttle slot on our failure.
        _recent.pop(f"ip:{client}", None)
        _recent.pop(user_key, None)
        logger.exception("Contact message from %s could not be delivered", user.email)
        raise

    # The acknowledgement is a courtesy and must not decide the outcome: the message the
    # team needs has already landed, so a failure here is logged and swallowed rather
    # than shown to the sender as a failure that would make them send it all over again.
    try:
        await send_contact_ack(to=user.email, name=name, message=payload.message)
        logger.info("Acknowledged contact message to %s", user.email)
    except Exception:  # noqa: BLE001 — nothing above this depends on the acknowledgement
        logger.warning("Could not acknowledge contact message to %s", user.email, exc_info=True)

    return ContactResponse()
