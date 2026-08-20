from datetime import datetime

from beanie import Document
from pymongo import ASCENDING, IndexModel


class RevokedToken(Document):
    """One token that has been signed out, held until it would have expired anyway.

    `token_version` on the user revokes *every* token at once, which is right for "sign
    out everywhere" and wrong for an ordinary sign-out: it would sign out the phone in
    your pocket because you closed a laptop lid. Revoking by `jti` names one token, so a
    sign-out ends exactly the session that asked — including any copy of that token
    taken from another browser.

    The list only ever holds tokens that have not yet expired: Mongo deletes each row on
    the token's own expiry, after which the signature is refused anyway and remembering
    it would be pointless. That bounds the collection by how many sign-outs happen in a
    token lifetime, not by how many have ever happened.
    """

    jti: str
    # The moment the token would expire on its own. Doubles as the TTL trigger.
    expires_at: datetime
    revoked_at: datetime

    class Settings:
        name = "revoked_tokens"
        indexes = [
            IndexModel([("jti", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
