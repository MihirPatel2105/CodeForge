from datetime import datetime

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import ASCENDING, IndexModel


class User(Document):
    email: EmailStr
    hashed_password: str  # never the plaintext; see NFR-3
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]
