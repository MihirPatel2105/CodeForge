from datetime import datetime

from beanie import Document
from pymongo import ASCENDING, IndexModel


class SignInAlert(Document):
    user_id: str
    device_hash: str
    token_hash: str
    expires_at: datetime
    resolved_at: datetime | None = None
    resolution: str | None = None

    class Settings:
        name = "sign_in_alerts"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
