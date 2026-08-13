from app.models.project import Project
from app.models.run import Run
from app.models.user import User

# Registered with Beanie on startup; keep this list in sync with the Documents above.
DOCUMENT_MODELS = [User, Project, Run]

__all__ = ["DOCUMENT_MODELS", "Project", "Run", "User"]
