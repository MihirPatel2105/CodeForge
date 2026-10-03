"""Atomic user changes keep stale requests from restoring security state."""

from typing import Any

from pymongo import ReturnDocument

from app.core.exceptions import AuthError
from app.models import User


async def update_user(
    user: User, fields: dict[str, Any], *, revoke: bool = False, guarded: bool = True
) -> User:
    query: dict[str, Any] = {"_id": user.id}
    if guarded:
        query["hashed_password"] = user.hashed_password
        # Older accounts predate these fields. Compare their documented defaults,
        # rather than accidentally refusing every security update on such accounts.
        defaults = {
            "token_version": 0,
            "is_suspended": False,
            "password_reset_required": False,
            "totp_enabled": False,
            "totp_secret_encrypted": None,
        }
        query["$expr"] = {
            "$and": [
                {"$eq": [{"$ifNull": [f"${name}", default]}, {"$literal": getattr(user, name)}]}
                for name, default in defaults.items()
            ]
        }
    update: dict[str, Any] = {"$set": fields} if fields else {}
    if revoke:
        update["$inc"] = {"token_version": 1}
    document = await User.get_pymongo_collection().find_one_and_update(
        query, update, return_document=ReturnDocument.AFTER
    )
    if document is None:
        raise AuthError("Account security changed. Sign in again.")
    return User.model_validate(document)
