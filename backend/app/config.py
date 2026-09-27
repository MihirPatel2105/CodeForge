import ipaddress
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    codeforge_env: Literal["development", "production"] = "development"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "codeforge"
    redis_url: str = ""
    trusted_proxy_cidrs: list[str] = []
    proxy_ip_secret: str = ""
    docker_host: str = ""
    docker_tls_verify: str = ""
    docker_cert_path: str = ""

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24h; long enough to survive a demo session

    # One explicit operator account for the first admin-panel slice. Access is checked
    # on every /admin request by the backend; the frontend link is only navigation, not
    # the security boundary. Keeping this in the environment also means an existing
    # account can become the operator without rewriting user documents in Atlas.
    admin_email: str | None = None

    groq_api_key: str | None = None
    cerebras_api_key: str | None = None
    openrouter_api_key: str | None = None
    google_api_key: str | None = None
    mistral_api_key: str | None = None

    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = "http://localhost:3000"

    # Next.js dev defaults to 3000 and falls back to 3001 if that port is taken —
    # both are allowed so the frontend works either way during development.
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # --- Email verification ------------------------------------------------ #
    # SMTP over an app password, because it costs nothing (CLAUDE.md §2) and needs no
    # third-party service. Gmail's defaults are pre-filled; any provider works.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587  # STARTTLS. Use 465 only with an implicit-TLS server.
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str = "CodeForge"

    # Where the emails point people back to. Dev default matches the Next.js port this
    # project actually runs on; set it to the deployed origin in production.
    app_base_url: str = "http://localhost:3001"
    api_public_base_url: str = "http://localhost:8000"

    otp_length: int = 6
    otp_ttl_minutes: int = 10
    # A six-digit code is only a million guesses, so the attempt cap — not the code
    # length — is what actually makes it hard to brute force.
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60

    reset_token_ttl_minutes: int = 10
    reset_resend_cooldown_seconds: int = 60
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15
    admin_failure_alert_percent: float = 25.0
    admin_failure_alert_min_runs: int = 5

    @property
    def email_verification_enabled(self) -> bool:
        """Off unless SMTP credentials are present.

        Without this a missing password would make sign-up impossible rather than
        unverified, which would take the whole demo down. `main.py` logs loudly at
        startup when it is off, so "disabled" can never be silent.
        """
        return bool(self.smtp_user and self.smtp_password)

    def production_security_errors(self) -> list[str]:
        if self.codeforge_env != "production":
            return []

        errors: list[str] = []
        if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("dev-"):
            errors.append("JWT_SECRET must be a unique secret of at least 32 characters")
        if not self.email_verification_enabled:
            errors.append("SMTP_USER and SMTP_PASSWORD are required for verified sign-up")
        if not self.redis_url:
            errors.append("REDIS_URL is required for public auth rate limits")
        if len(self.proxy_ip_secret) < 32:
            errors.append("PROXY_IP_SECRET must be a unique secret of at least 32 characters")
        try:
            docker_url = urlsplit(self.docker_host)
            host = docker_url.hostname or ""
            remote = docker_url.scheme == "tcp" and bool(host) and bool(docker_url.port)
            remote = remote and not docker_url.username and not docker_url.password
            remote = remote and docker_url.path in ("", "/")
            remote = remote and not docker_url.query and not docker_url.fragment
            remote = remote and host.lower() not in {"localhost", "host.docker.internal"}
            try:
                remote = remote and not ipaddress.ip_address(host).is_loopback
            except ValueError:
                pass
        except ValueError:
            remote = False
        if not remote:
            errors.append("DOCKER_HOST must point to a separate TCP sandbox daemon")
        if self.docker_tls_verify != "1":
            errors.append("DOCKER_TLS_VERIFY must be 1 for the sandbox daemon")
        if not self.docker_cert_path or not all(
            (Path(self.docker_cert_path) / name).is_file()
            for name in ("ca.pem", "cert.pem", "key.pem")
        ):
            errors.append("DOCKER_CERT_PATH must contain ca.pem, cert.pem, and key.pem")
        for name, value in (
            ("APP_BASE_URL", self.app_base_url),
            ("API_PUBLIC_BASE_URL", self.api_public_base_url),
        ):
            if not self._is_https_origin(value):
                errors.append(f"{name} must be an HTTPS origin")
        if not self.cors_origins or any(
            not self._is_https_origin(origin) for origin in self.cors_origins
        ):
            errors.append("CORS_ORIGINS must contain only HTTPS origins")
        elif self.app_base_url.rstrip("/") not in {
            origin.rstrip("/") for origin in self.cors_origins
        }:
            errors.append("APP_BASE_URL must be present in CORS_ORIGINS")
        return errors

    @staticmethod
    def _is_https_origin(value: str) -> bool:
        try:
            parsed = urlsplit(value)
            if parsed.port == 0:
                return False
        except ValueError:
            return False
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and not parsed.username
            and not parsed.password
            and parsed.path in ("", "/")
            and not parsed.query
            and not parsed.fragment
        )


settings = Settings()
