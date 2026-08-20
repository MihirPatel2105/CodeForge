"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthError
from app.core.security import decode_access_token
from app.models import RevokedToken, User

# auto_error=False so a missing header raises our AuthError, keeping the response body in
# the project's error shape rather than FastAPI's default.
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise AuthError("Missing bearer token")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token has no subject")

    user = await User.get(user_id)
    if user is None:
        raise AuthError("User no longer exists")

    # A token minted before the last password change is refused. Absent claim reads as
    # 0 so tokens issued before this check existed keep working.
    if payload.get("tv", 0) != user.token_version:
        raise AuthError("Session ended. Please sign in again.")

    # And a token that has been signed out is refused, wherever it is presented from.
    # One indexed lookup per request; the collection only holds tokens that have not yet
    # expired, so it stays small no matter how long the deployment runs.
    jti = payload.get("jti")
    if jti and await RevokedToken.find_one(RevokedToken.jti == jti) is not None:
        raise AuthError("Session ended. Please sign in again.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_token_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    """The decoded claims of the token on this request.

    Sign-out needs to name the exact token it was called with, which `CurrentUser` has
    already thrown away by the time a route sees it. Decoding twice is cheap — it is an
    HMAC verification, not a database call — and far clearer than smuggling the payload
    out through request state.
    """
    if credentials is None:
        raise AuthError("Missing bearer token")
    return decode_access_token(credentials.credentials)


TokenClaims = Annotated[dict, Depends(get_token_claims)]


async def get_owned(model: type, doc_id: str, user_id: str, label: str):
    """Fetch a document by id, but only if it belongs to `user_id`.

    A document owned by someone else returns 404, not 403: a 403 would confirm the id
    exists, letting a caller probe for other users' project and run ids.
    """
    from bson.errors import InvalidId

    from app.core.exceptions import NotFoundError

    try:
        doc = await model.get(doc_id)
    except (InvalidId, ValueError):
        # A malformed id is a lookup miss, not a server error.
        raise NotFoundError(f"{label} not found") from None

    if doc is None or doc.user_id != user_id:
        raise NotFoundError(f"{label} not found")
    return doc
