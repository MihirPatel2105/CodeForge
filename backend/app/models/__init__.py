from app.models.admin_audit import AdminAuditLog
from app.models.device import Device
from app.models.login_session import LoginSession
from app.models.passkey import PasskeyChallenge, PasskeyCredential
from app.models.password_reset import PasswordResetToken
from app.models.pending_signup import PendingSignup
from app.models.project import Project
from app.models.revoked_token import RevokedToken
from app.models.run import Run
from app.models.sign_in_alert import SignInAlert
from app.models.user import User

# Registered with Beanie on startup; keep this list in sync with the Documents above.
DOCUMENT_MODELS = [
    User,
    PendingSignup,
    PasswordResetToken,
    RevokedToken,
    Device,
    LoginSession,
    PasskeyCredential,
    PasskeyChallenge,
    SignInAlert,
    Project,
    Run,
    AdminAuditLog,
]

__all__ = [
    "AdminAuditLog",
    "DOCUMENT_MODELS",
    "Device",
    "LoginSession",
    "PasskeyChallenge",
    "PasskeyCredential",
    "PasswordResetToken",
    "PendingSignup",
    "Project",
    "RevokedToken",
    "Run",
    "SignInAlert",
    "User",
]
