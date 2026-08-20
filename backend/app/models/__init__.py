from app.models.password_reset import PasswordResetToken
from app.models.pending_signup import PendingSignup
from app.models.project import Project
from app.models.revoked_token import RevokedToken
from app.models.run import Run
from app.models.user import User

# Registered with Beanie on startup; keep this list in sync with the Documents above.
DOCUMENT_MODELS = [User, PendingSignup, PasswordResetToken, RevokedToken, Project, Run]

__all__ = [
    "DOCUMENT_MODELS",
    "PasswordResetToken",
    "PendingSignup",
    "Project",
    "RevokedToken",
    "Run",
    "User",
]
