import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.config import settings as live_settings
from app.main import app
from scripts.check_deployment import deployment_errors


def _config(tmp_path, **overrides: object) -> Settings:
    for name in ("ca.pem", "cert.pem", "key.pem"):
        (tmp_path / name).write_text("test certificate")
    values = {
        "codeforge_env": "production",
        "app_base_url": "https://app.example.com",
        "api_public_base_url": "https://api.example.com",
        "cors_origins": ["https://app.example.com"],
        "mongo_uri": "mongodb+srv://user:secret@cluster.example.mongodb.net/",
        "redis_url": "redis://redis:6379/0",
        "proxy_ip_secret": "another-unique-random-secret-that-is-long-enough",
        "jwt_secret": "a-unique-random-secret-that-is-long-enough",
        "smtp_user": "sender@example.com",
        "smtp_password": "mail-secret",
        "groq_api_key": "provider-key",
        "docker_host": "tcp://sandbox.example.com:2376",
        "docker_tls_verify": "1",
        "docker_cert_path": str(tmp_path),
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_deployment_config_accepts_hosted_origins_and_database(tmp_path) -> None:
    assert deployment_errors(_config(tmp_path), "https://api.example.com") == []


def test_deployment_config_rejects_local_defaults_and_missing_email(tmp_path) -> None:
    errors = deployment_errors(
        _config(
            tmp_path,
            app_base_url="http://localhost:3001",
            cors_origins=["http://localhost:3001"],
            mongo_uri="mongodb://mongo:27017",
            jwt_secret="change-me",
            smtp_user=None,
        ),
        "http://localhost:8000",
    )
    assert len(errors) >= 6


def test_production_startup_rejects_missing_auth_controls(tmp_path) -> None:
    errors = _config(
        tmp_path,
        jwt_secret="dev-secret-change-me",
        smtp_password=None,
        redis_url="",
        proxy_ip_secret="",
    ).production_security_errors()
    assert any("JWT_SECRET" in error for error in errors)
    assert any("SMTP_USER" in error for error in errors)
    assert any("REDIS_URL" in error for error in errors)
    assert any("PROXY_IP_SECRET" in error for error in errors)


def test_production_app_refuses_to_start_with_weak_jwt_secret(monkeypatch) -> None:
    monkeypatch.setattr(live_settings, "codeforge_env", "production")
    monkeypatch.setattr(live_settings, "jwt_secret", "dev-secret-change-me")
    with pytest.raises(RuntimeError, match="Unsafe production configuration: JWT_SECRET"):
        with TestClient(app):
            pass


def test_deployment_config_rejects_malformed_public_api_port(tmp_path) -> None:
    assert "The public API URL must be an HTTPS origin without a path" in deployment_errors(
        _config(tmp_path), "https://api.example.com:not-a-port"
    )


def test_production_rejects_host_socket_or_unverified_remote_daemon(tmp_path) -> None:
    errors = _config(
        tmp_path,
        docker_host="unix:///var/run/docker.sock",
        docker_tls_verify="",
    ).production_security_errors()
    assert any("DOCKER_HOST" in error for error in errors)
    assert any("DOCKER_TLS_VERIFY" in error for error in errors)
    assert any(
        "DOCKER_CERT_PATH" in error
        for error in _config(
            tmp_path, docker_cert_path="/missing/certs"
        ).production_security_errors()
    )
