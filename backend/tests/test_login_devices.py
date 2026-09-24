"""Security regressions for browser history and mailed sign-in responses."""

from urllib.parse import urlparse

from pymongo import MongoClient

from app.config import settings


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _verify_address(email: str) -> None:
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db]["users"].update_one(
            {"email": email}, {"$set": {"email_verified": True}}
        )


def test_new_device_notice_and_owner_can_revoke_that_browser(client, registered_user, monkeypatch):
    _verify_address(registered_user["email"])
    notices: list[dict] = []

    async def capture(**kwargs):
        notices.append(kwargs)

    monkeypatch.setattr(settings, "smtp_user", "test@example.com")
    monkeypatch.setattr(settings, "smtp_password", "test-secret")
    monkeypatch.setattr("app.api.auth.send_new_device_email", capture)

    login = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
        headers={
            "X-CodeForge-Device": "9bbcc213-e374-41e4-bd87-8dc730fb572c",
            "User-Agent": "Mozilla/5.0 (Mac OS X) AppleWebKit/537.36 Chrome/124.0",
        },
    )
    assert login.status_code == 200
    assert len(notices) == 1
    assert notices[0]["label"] == "Chrome on macOS"
    token = login.json()["access_token"]
    devices = client.get("/auth/devices", headers=_headers(token)).json()
    current = next(device for device in devices if device["current"])
    assert current["label"] == "Chrome on macOS"

    response = client.post(
        f"/auth/devices/{current['id']}/sign-out", headers=registered_user["headers"]
    )
    assert response.status_code == 204
    assert client.get("/auth/me", headers=_headers(token)).status_code == 401
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 200


def test_not_me_link_revokes_all_and_cannot_be_replayed(client, registered_user, monkeypatch):
    _verify_address(registered_user["email"])
    notices: list[dict] = []

    async def capture(**kwargs):
        notices.append(kwargs)

    monkeypatch.setattr(settings, "smtp_user", "test@example.com")
    monkeypatch.setattr(settings, "smtp_password", "test-secret")
    monkeypatch.setattr("app.api.auth.send_new_device_email", capture)

    login = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
        headers={"X-CodeForge-Device": "41303f15-5af7-49eb-b015-c502674bd39a"},
    )
    token = login.json()["access_token"]
    alert_token = urlparse(notices[0]["review_url"]).path.rsplit("/", 1)[-1]
    response = client.post(
        "/auth/sign-in-alert/respond", json={"token": alert_token, "response": "not_me"}
    )
    assert response.status_code == 200
    assert client.get("/auth/me", headers=_headers(token)).status_code == 401
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401
    assert (
        client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": registered_user["password"]},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/sign-in-alert/respond", json={"token": alert_token, "response": "me"}
        ).status_code
        == 401
    )


def test_known_device_sign_in_does_not_repeat_alert(client, registered_user, monkeypatch):
    _verify_address(registered_user["email"])
    notices: list[dict] = []

    async def capture(**kwargs):
        notices.append(kwargs)

    monkeypatch.setattr(settings, "smtp_user", "test@example.com")
    monkeypatch.setattr(settings, "smtp_password", "test-secret")
    monkeypatch.setattr("app.api.auth.send_new_device_email", capture)
    headers = {"X-CodeForge-Device": "540035b1-40f0-4d42-b92f-2c44965a3545"}
    tokens = []
    for _ in range(2):
        response = client.post(
            "/auth/login",
            json={"email": registered_user["email"], "password": registered_user["password"]},
            headers=headers,
        )
        assert response.status_code == 200
        tokens.append(response.json()["access_token"])
    assert len(notices) == 1
    alert_token = urlparse(notices[0]["review_url"]).path.rsplit("/", 1)[-1]
    assert (
        client.post(
            "/auth/sign-in-alert/respond", json={"token": alert_token, "response": "me"}
        ).status_code
        == 200
    )
    assert client.get("/auth/me", headers=_headers(tokens[0])).status_code == 200
