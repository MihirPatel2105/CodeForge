def test_register_returns_token(client):
    response = client.post(
        "/auth/register", json={"email": "new@example.com", "password": "secret12345"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_register_rejects_duplicate_email(client, registered_user):
    response = client.post(
        "/auth/register",
        json={"email": registered_user["email"], "password": "another12345"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_register_rejects_short_password(client):
    response = client.post("/auth/register", json={"email": "short@example.com", "password": "abc"})
    assert response.status_code == 422


def test_register_rejects_invalid_email(client):
    response = client.post(
        "/auth/register", json={"email": "not-an-email", "password": "secret12345"}
    )
    assert response.status_code == 422


def test_login_succeeds(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_rejects_wrong_password(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_login_unknown_email_matches_wrong_password_message(client, registered_user):
    """Both failures must read identically or the endpoint enumerates accounts."""
    unknown = client.post(
        "/auth/login", json={"email": "ghost@example.com", "password": "secret12345"}
    )
    wrong = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "wrongpassword"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


def test_me_returns_current_user(client, registered_user):
    response = client.get("/auth/me", headers=registered_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == registered_user["email"]
    assert isinstance(body["id"], str)  # never a raw ObjectId


def test_me_requires_a_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_rejects_a_malformed_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401


def test_me_rejects_a_token_signed_with_another_secret(client, registered_user):
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    forged = jwt.encode(
        {"sub": "someone", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "not-the-real-secret",
        algorithm="HS256",
    )
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_expired_token_is_rejected(client, registered_user):
    from app.core.security import create_access_token

    expired = create_access_token("someone", expires_minutes=-1)
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
