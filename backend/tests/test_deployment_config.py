from app.config import Settings
from scripts.check_deployment import deployment_errors


def _config(**overrides: object) -> Settings:
    values = {
        "app_base_url": "https://app.example.com",
        "cors_origins": ["https://app.example.com"],
        "mongo_uri": "mongodb+srv://user:secret@cluster.example.mongodb.net/",
        "jwt_secret": "a-unique-random-secret-that-is-long-enough",
        "smtp_user": "sender@example.com",
        "smtp_password": "mail-secret",
        "groq_api_key": "provider-key",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_deployment_config_accepts_hosted_origins_and_database() -> None:
    assert deployment_errors(_config(), "https://api.example.com") == []


def test_deployment_config_rejects_local_defaults_and_missing_email() -> None:
    errors = deployment_errors(
        _config(
            app_base_url="http://localhost:3001",
            cors_origins=["http://localhost:3001"],
            mongo_uri="mongodb://mongo:27017",
            jwt_secret="change-me",
            smtp_user=None,
        ),
        "http://localhost:8000",
    )
    assert len(errors) == 6


def test_deployment_config_rejects_malformed_public_api_port() -> None:
    assert "The public API URL must be an HTTPS origin without a path" in deployment_errors(
        _config(), "https://api.example.com:not-a-port"
    )
