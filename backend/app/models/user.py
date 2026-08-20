from datetime import datetime

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import ASCENDING, IndexModel


class User(Document):
    email: EmailStr
    hashed_password: str  # never the plaintext; see NFR-3
    # Defaulted rather than required so accounts created before sign-up collected names
    # still load; `last_name` is genuinely optional (see RegisterRequest).
    first_name: str = ""
    last_name: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    # Bumped whenever every existing session should stop working — currently only a
    # password change. JWTs are stateless, so without a counter to compare against, a
    # password changed because it leaked would leave the leaked sessions alive for the
    # token's full 24-hour life. Defaults to 0, and a token minted before this existed
    # carries no `tv` claim and is read as 0, so nobody is signed out by the upgrade.
    token_version: int = 0

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]
