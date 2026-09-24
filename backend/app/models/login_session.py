from datetime import datetime

from beanie import Document
from pymongo import ASCENDING, IndexModel


class LoginSession(Document):
    user_id: str
    device_hash: str
    jti: str
    token_version: int
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    class Settings:
        name = "login_sessions"
        indexes = [
            IndexModel([("jti", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("device_hash", ASCENDING)]),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
