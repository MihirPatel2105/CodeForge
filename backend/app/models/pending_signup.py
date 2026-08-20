from datetime import datetime

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import ASCENDING, IndexModel


class PendingSignup(Document):
    """A sign-up that has been paid for with a password but not yet with a code.

    No `User` exists until the code is verified. The alternative — create the account
    immediately and carry a `verified` flag — leaves half-real accounts behind for every
    abandoned sign-up, and makes every read path responsible for remembering to check
    the flag. Here an unverified address simply has no account.

    The password is hashed on arrival, exactly as it would be on the `User`, so this
    collection is no more sensitive than the one it feeds.
    """

    email: EmailStr
    hashed_password: str
    first_name: str = ""
    last_name: str = ""

    code_hash: str  # never the code itself — this row is as guessable as its contents
    expires_at: datetime
    attempts: int = 0
    last_sent_at: datetime = Field(default_factory=datetime.now)
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "pending_signups"
        indexes = [
            # One pending sign-up per address: a second attempt replaces the first
            # rather than leaving two live codes for the same inbox.
            IndexModel([("email", ASCENDING)], unique=True),
            # Mongo deletes expired rows itself, so an abandoned sign-up cannot sit
            # around holding an address hostage. `expireAfterSeconds=0` means "when
            # the date in this field passes".
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
