from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "codeforge"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24h; long enough to survive a demo session

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

    otp_length: int = 6
    otp_ttl_minutes: int = 10
    # A six-digit code is only a million guesses, so the attempt cap — not the code
    # length — is what actually makes it hard to brute force.
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60

    reset_token_ttl_minutes: int = 10
    reset_resend_cooldown_seconds: int = 60

    @property
    def email_verification_enabled(self) -> bool:
        """Off unless SMTP credentials are present.

        Without this a missing password would make sign-up impossible rather than
        unverified, which would take the whole demo down. `main.py` logs loudly at
        startup when it is off, so "disabled" can never be silent.
        """
        return bool(self.smtp_user and self.smtp_password)


settings = Settings()
