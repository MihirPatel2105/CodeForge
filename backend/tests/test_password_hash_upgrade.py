"""New Argon2id hashes and safe migration of existing bcrypt accounts."""

import time

from passlib.hash import bcrypt
from pymongo import MongoClient

from app.config import settings
from app.core.security import _totp, hash_otp, hash_password, verify_otp, verify_password


def _stored_hash(email: str) -> str:
    with MongoClient(settings.mongo_uri) as mongo:
        return mongo[settings.mongo_db].users.find_one({"email": email})["hashed_password"]


def _set_legacy_hash(email: str, password: str) -> str:
    legacy = bcrypt.hash(password)
    with MongoClient(settings.mongo_uri) as mongo:
        mongo[settings.mongo_db].users.update_one(
            {"email": email}, {"$set": {"hashed_password": legacy}}
        )
    return legacy


def test_new_passwords_use_argon2id_and_otp_stays_on_bcrypt(client, registered_user):
    stored = _stored_hash(registered_user["email"])
    assert stored.startswith("$argon2id$v=19$m=19456,t=2,p=1$")
    assert verify_password(registered_user["password"], stored)
    assert hash_password("Secret12345").startswith("$argon2id$")

    code_hash = hash_otp("123456")
    assert code_hash.startswith("$2")
    assert verify_otp("123456", code_hash)


def test_bcrypt_account_upgrades_after_correct_password(client, registered_user):
    legacy = _set_legacy_hash(registered_user["email"], registered_user["password"])

    wrong = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "Wrong12345"}
    )
    assert wrong.status_code == 401
    assert _stored_hash(registered_user["email"]) == legacy

    login = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert login.status_code == 200
    fresh = _stored_hash(registered_user["email"])
    assert fresh.startswith("$argon2id$")
    assert verify_password(registered_user["password"], fresh)
    assert (
        client.get(
            "/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
        ).status_code
        == 200
    )


def test_bcrypt_account_with_totp_keeps_upgraded_hash_after_mfa(client, registered_user):
    setup = client.post(
        "/auth/totp/setup",
        json={"current_password": registered_user["password"]},
        headers=registered_user["headers"],
    )
    secret = setup.json()["secret"]
    code = _totp(secret, int(time.time()) // 30)
    assert (
        client.post(
            "/auth/totp/verify", json={"code": code}, headers=registered_user["headers"]
        ).status_code
        == 204
    )
    _set_legacy_hash(registered_user["email"], registered_user["password"])

    start = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert start.status_code == 200
    assert start.json()["mfa_required"] is True
    assert _stored_hash(registered_user["email"]).startswith("$argon2id$")

    complete = client.post(
        "/auth/login/complete",
        json={
            "ticket": start.json()["mfa_ticket"],
            "totp_code": _totp(secret, int(time.time()) // 30),
        },
    )
    assert complete.status_code == 200
    assert _stored_hash(registered_user["email"]).startswith("$argon2id$")
