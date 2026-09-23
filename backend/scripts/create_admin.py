"""Create the configured CodeForge administrator account once.

Run from ``backend/`` so pydantic-settings loads that directory's ``.env``::

    PYTHONPATH=. .venv/bin/python scripts/create_admin.py

The password is read interactively and only its bcrypt hash is stored. The command
refuses to overwrite an existing account; password changes use the normal application
flow instead.
"""

import asyncio
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db import connect, disconnect  # noqa: E402
from app.models import User  # noqa: E402
from app.schemas.api import password_failures  # noqa: E402


async def create_admin() -> int:
    email = (settings.admin_email or "").strip().lower()
    if not email:
        print("ADMIN_EMAIL is missing. Add it to backend/.env first.")
        return 1

    await connect()
    try:
        if await User.find_one(User.email == email) is not None:
            print(f"Admin account already exists: {email}")
            print("No password or account data was changed.")
            return 0

        password = getpass.getpass("New admin password: ")
        confirmation = getpass.getpass("Confirm password: ")
        if password != confirmation:
            print("Passwords do not match. No account was created.")
            return 1

        missing = password_failures(password)
        if missing:
            print("Password needs " + ", ".join(missing) + ".")
            return 1

        user = User(
            email=email,
            hashed_password=hash_password(password),
            first_name="CodeForge",
        )
        await user.insert()
        print(f"Created administrator account: {email}")
        return 0
    finally:
        await disconnect()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(create_admin()))
