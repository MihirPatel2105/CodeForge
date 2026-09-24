"""Passkey ceremonies must be single-use and keep the existing session/2FA rules."""

import base64
import hashlib
import json
import time
from types import SimpleNamespace

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.security import _totp


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def test_registration_requires_password_and_challenge_cannot_be_replayed(
    client, registered_user, monkeypatch
):
    headers = registered_user["headers"]
    denied = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": "wrong"},
    )
    assert denied.status_code == 401

    options = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    assert options.status_code == 200
    assert options.json()["options"]["authenticatorSelection"]["residentKey"] == "required"

    def fake_verify(**kwargs):
        assert kwargs["require_user_verification"] is True
        assert kwargs["expected_rp_id"] == "localhost"
        return SimpleNamespace(
            credential_id=b"credential-one",
            credential_public_key=b"public-key",
            sign_count=0,
        )

    monkeypatch.setattr("app.api.passkeys.verify_registration_response", fake_verify)
    payload = {"challenge_id": options.json()["challenge_id"], "credential": {}, "label": "Laptop"}
    response = client.post("/auth/passkeys/register/verify", headers=headers, json=payload)
    assert response.status_code == 201
    assert response.json()["label"] == "Laptop"
    replay = client.post("/auth/passkeys/register/verify", headers=headers, json=payload)
    assert replay.status_code == 401
    listing = client.get("/auth/passkeys", headers=headers)
    assert len(listing.json()) == 1


def test_passkey_login_issues_session_and_preserves_totp(client, registered_user, monkeypatch):
    headers = registered_user["headers"]
    # Reuse registration so the Beanie insert happens inside the TestClient portal.
    options = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    monkeypatch.setattr(
        "app.api.passkeys.verify_registration_response",
        lambda **kwargs: SimpleNamespace(
            credential_id=b"credential-one", credential_public_key=b"public-key", sign_count=0
        ),
    )
    added = client.post(
        "/auth/passkeys/register/verify",
        headers=headers,
        json={"challenge_id": options.json()["challenge_id"], "credential": {}, "label": "Laptop"},
    )
    assert added.status_code == 201

    def fake_auth(**kwargs):
        assert kwargs["require_user_verification"] is True
        return SimpleNamespace(credential_id=b"credential-one", new_sign_count=1)

    monkeypatch.setattr("app.api.passkeys.verify_authentication_response", fake_auth)
    login_options = client.post("/auth/passkeys/login/options")
    assert login_options.status_code == 200
    login_payload = {
        "challenge_id": login_options.json()["challenge_id"],
        "credential": {"id": "Y3JlZGVudGlhbC1vbmU"},
    }
    response = client.post("/auth/passkeys/login/verify", json=login_payload)
    assert response.status_code == 200
    assert response.json()["access_token"]
    signed_in = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert signed_in.status_code == 200
    assert client.post("/auth/passkeys/login/verify", json=login_payload).status_code == 401


def test_remove_passkey_requires_password_and_owner(client, registered_user, monkeypatch):
    headers = registered_user["headers"]
    options = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    monkeypatch.setattr(
        "app.api.passkeys.verify_registration_response",
        lambda **kwargs: SimpleNamespace(
            credential_id=b"credential-one", credential_public_key=b"public-key", sign_count=0
        ),
    )
    added = client.post(
        "/auth/passkeys/register/verify",
        headers=headers,
        json={"challenge_id": options.json()["challenge_id"], "credential": {}, "label": "Laptop"},
    )
    passkey_id = added.json()["id"]
    denied = client.post(
        f"/auth/passkeys/{passkey_id}/delete",
        headers=headers,
        json={"current_password": "wrong"},
    )
    assert denied.status_code == 401
    assert (
        client.post(
            f"/auth/passkeys/{passkey_id}/delete",
            headers=headers,
            json={"current_password": registered_user["password"]},
        ).status_code
        == 204
    )
    assert client.get("/auth/passkeys", headers=headers).json() == []


def test_passkey_login_keeps_totp_required(client, registered_user, monkeypatch):
    headers = registered_user["headers"]
    setup = client.post(
        "/auth/totp/setup",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    secret = setup.json()["secret"]
    code = _totp(secret, int(time.time()) // 30)
    assert client.post("/auth/totp/verify", headers=headers, json={"code": code}).status_code == 204

    denied = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    assert denied.status_code == 401
    options = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"], "totp_code": code},
    )
    assert options.status_code == 200
    monkeypatch.setattr(
        "app.api.passkeys.verify_registration_response",
        lambda **kwargs: SimpleNamespace(
            credential_id=b"credential-two", credential_public_key=b"public-key", sign_count=0
        ),
    )
    added = client.post(
        "/auth/passkeys/register/verify",
        headers=headers,
        json={"challenge_id": options.json()["challenge_id"], "credential": {}, "label": "Phone"},
    )
    assert added.status_code == 201
    monkeypatch.setattr(
        "app.api.passkeys.verify_authentication_response",
        lambda **kwargs: SimpleNamespace(credential_id=b"credential-two", new_sign_count=1),
    )
    login_options = client.post("/auth/passkeys/login/options").json()
    response = client.post(
        "/auth/passkeys/login/verify",
        json={
            "challenge_id": login_options["challenge_id"],
            "credential": {"id": "Y3JlZGVudGlhbC10d28"},
        },
    )
    assert response.status_code == 200
    assert response.json()["mfa_required"] is True
    assert response.json()["access_token"] is None
    ticket = response.json()["mfa_ticket"]
    wrong = client.post(
        "/auth/passkeys/login/complete", json={"ticket": ticket, "totp_code": "000000"}
    )
    assert wrong.status_code == 401
    assert (
        client.post(
            "/auth/passkeys/login/complete", json={"ticket": ticket, "totp_code": code}
        ).status_code
        == 401
    )
    fresh_options = client.post("/auth/passkeys/login/options").json()
    fresh = client.post(
        "/auth/passkeys/login/verify",
        json={
            "challenge_id": fresh_options["challenge_id"],
            "credential": {"id": "Y3JlZGVudGlhbC10d28"},
        },
    )
    complete = client.post(
        "/auth/passkeys/login/complete",
        json={"ticket": fresh.json()["mfa_ticket"], "totp_code": code},
    )
    assert complete.status_code == 200
    assert complete.json()["access_token"]


def test_password_reset_removes_passkeys(client, registered_user, monkeypatch):
    headers = registered_user["headers"]
    options = client.post(
        "/auth/passkeys/register/options",
        headers=headers,
        json={"current_password": registered_user["password"]},
    )
    monkeypatch.setattr(
        "app.api.passkeys.verify_registration_response",
        lambda **kwargs: SimpleNamespace(
            credential_id=b"credential-three", credential_public_key=b"public-key", sign_count=0
        ),
    )
    added = client.post(
        "/auth/passkeys/register/verify",
        headers=headers,
        json={"challenge_id": options.json()["challenge_id"], "credential": {}, "label": "Laptop"},
    )
    assert added.status_code == 201
    sent: list[str] = []

    async def capture_reset(*, to: str, reset_url: str, first_name: str) -> None:
        sent.append(reset_url)

    monkeypatch.setattr("app.api.auth.send_password_reset_email", capture_reset)
    assert (
        client.post("/auth/forgot-password", json={"email": registered_user["email"]}).status_code
        == 200
    )
    token = sent[0].rsplit("/", 1)[-1]
    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Brandnew12345"}
    )
    assert response.status_code == 200
    new_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/passkeys", headers=new_headers).json() == []


def test_real_signature_checks_origin_and_challenge(client, registered_user, monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public = private_key.public_key().public_numbers()
    cose_key = cbor2.dumps(
        {1: 2, 3: -7, -1: 1, -2: public.x.to_bytes(32, "big"), -3: public.y.to_bytes(32, "big")}
    )
    registration = client.post(
        "/auth/passkeys/register/options",
        headers=registered_user["headers"],
        json={"current_password": registered_user["password"]},
    ).json()
    monkeypatch.setattr(
        "app.api.passkeys.verify_registration_response",
        lambda **kwargs: SimpleNamespace(
            credential_id=b"real-assertion", credential_public_key=cose_key, sign_count=0
        ),
    )
    assert (
        client.post(
            "/auth/passkeys/register/verify",
            headers=registered_user["headers"],
            json={
                "challenge_id": registration["challenge_id"],
                "credential": {},
                "label": "Test key",
            },
        ).status_code
        == 201
    )

    def assertion(origin: str, challenge: str) -> dict:
        client_data = json.dumps(
            {"type": "webauthn.get", "challenge": challenge, "origin": origin}
        ).encode()
        auth_data = hashlib.sha256(b"localhost").digest() + b"\x05" + (1).to_bytes(4, "big")
        signed = auth_data + hashlib.sha256(client_data).digest()
        signature = private_key.sign(signed, ec.ECDSA(hashes.SHA256()))
        return {
            "id": _b64(b"real-assertion"),
            "rawId": _b64(b"real-assertion"),
            "type": "public-key",
            "response": {
                "authenticatorData": _b64(auth_data),
                "clientDataJSON": _b64(client_data),
                "signature": _b64(signature),
                "userHandle": None,
            },
        }

    wrong_options = client.post("/auth/passkeys/login/options").json()
    wrong = client.post(
        "/auth/passkeys/login/verify",
        json={
            "challenge_id": wrong_options["challenge_id"],
            "credential": assertion("https://evil.example", wrong_options["options"]["challenge"]),
        },
    )
    assert wrong.status_code == 401
    valid_options = client.post("/auth/passkeys/login/options").json()
    valid = client.post(
        "/auth/passkeys/login/verify",
        json={
            "challenge_id": valid_options["challenge_id"],
            "credential": assertion("http://localhost:3001", valid_options["options"]["challenge"]),
        },
    )
    assert valid.status_code == 200
    assert valid.json()["access_token"]
