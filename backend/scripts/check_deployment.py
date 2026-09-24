"""Check deployment configuration without contacting MongoDB or AI providers."""

import argparse
import sys
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402


def _https_origin(value: str) -> str | None:
    try:
        parsed = urlsplit(value)
        if parsed.port == 0:
            return None
    except ValueError:
        return None
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def deployment_errors(config: Settings, api_url: str) -> list[str]:
    errors: list[str] = []

    frontend_origin = _https_origin(config.app_base_url)
    if not frontend_origin:
        errors.append("APP_BASE_URL must be an HTTPS frontend origin without a path")

    if not config.cors_origins or any(
        _https_origin(origin) is None for origin in config.cors_origins
    ):
        errors.append("CORS_ORIGINS must contain only explicit HTTPS frontend origins")
    elif frontend_origin not in {_https_origin(origin) for origin in config.cors_origins}:
        errors.append("APP_BASE_URL must be present in CORS_ORIGINS")

    if not _https_origin(api_url):
        errors.append("The public API URL must be an HTTPS origin without a path")

    mongo = urlsplit(config.mongo_uri)
    if mongo.scheme not in {"mongodb", "mongodb+srv"} or not mongo.hostname:
        errors.append("MONGO_URI must be a valid MongoDB connection URI")
    elif mongo.hostname.lower() in {"localhost", "127.0.0.1", "mongo"}:
        errors.append("MONGO_URI must reach a MongoDB server outside this deployment stack")

    if (
        len(config.jwt_secret) < 32
        or config.jwt_secret.startswith("dev-")
        or config.jwt_secret == "change-me"
    ):
        errors.append("JWT_SECRET must be a unique random value of at least 32 characters")

    if not config.smtp_user or not config.smtp_password:
        errors.append("SMTP_USER and SMTP_PASSWORD are required for verified public sign-up")

    if not any((config.groq_api_key, config.openrouter_api_key, config.mistral_api_key)):
        errors.append("Configure at least one active AI provider key")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True, help="Public HTTPS API origin")
    args = parser.parse_args()
    errors = deployment_errors(Settings(), args.api_url)
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print("Deployment configuration passed static checks.")
    print("Run live health and provider checks next.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
