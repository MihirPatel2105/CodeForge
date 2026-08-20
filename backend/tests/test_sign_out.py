"""Signing out, and what a stolen copy of the token can do afterwards.

The point of these is the copied-token case. Deleting a JWT from local storage is not a
sign-out — the token stays valid until it expires — so the assertion that matters is that
the same token string is refused from somewhere else the moment sign-out returns.
"""


def test_the_token_stops_working_immediately(client, registered_user):
    assert client.post("/auth/sign-out", headers=registered_user["headers"]).status_code == 204
    assert client.get("/auth/me", headers=registered_user["headers"]).status_code == 401


def test_a_copy_of_the_token_is_refused_too(client, registered_user):
    """The whole reason this endpoint exists. `stolen` is the same string a browser
    extension or a shoulder-surfer would have lifted out of local storage."""
    stolen = {"Authorization": registered_user["headers"]["Authorization"]}
    assert client.get("/auth/me", headers=stolen).status_code == 200

    client.post("/auth/sign-out", headers=registered_user["headers"])

    assert client.get("/auth/me", headers=stolen).status_code == 401


def test_other_devices_stay_signed_in(client, registered_user):
    """Signing out of one place must not sign out the rest — that is what
    /auth/sign-out-everywhere is for."""
    other = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other}"}

    client.post("/auth/sign-out", headers=registered_user["headers"])

    assert client.get("/auth/me", headers=other_headers).status_code == 200


def test_signing_in_again_works(client, registered_user):
    """Sign-out ends a session; it does not disable the account."""
    client.post("/auth/sign-out", headers=registered_user["headers"])

    again = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert again.status_code == 200
    fresh = {"Authorization": f"Bearer {again.json()['access_token']}"}
    assert client.get("/auth/me", headers=fresh).status_code == 200


def test_signing_out_twice_is_not_an_error(client, registered_user):
    """The second call arrives with an already-revoked token, so it cannot authenticate
    at all — but a retry on a flaky connection must not look like a failure."""
    assert client.post("/auth/sign-out", headers=registered_user["headers"]).status_code == 204
    assert client.post("/auth/sign-out", headers=registered_user["headers"]).status_code == 401


def test_sign_out_requires_a_token(client):
    assert client.post("/auth/sign-out").status_code == 401


def test_the_revocation_is_kept_only_until_the_token_expires(client, registered_user):
    """The denylist is bounded by token lifetime, not by how many sign-outs have ever
    happened — the row carries the token's own expiry for Mongo's TTL sweep."""
    from datetime import UTC, datetime

    from pymongo import MongoClient

    from app.config import settings

    client.post("/auth/sign-out", headers=registered_user["headers"])

    with MongoClient(settings.mongo_uri) as mongo:
        row = mongo[settings.mongo_db].revoked_tokens.find_one({})
        assert row is not None
        # Roughly the token's 24-hour life, and definitely in the future.
        assert row["expires_at"].replace(tzinfo=UTC) > datetime.now(UTC)


def test_a_token_with_no_jti_can_still_sign_out(client, registered_user):
    """Tokens minted before this feature carry no `jti`. Signing out with one cannot
    revoke anything, but it must not error on the way out either."""
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.config import settings

    user_id = client.get("/auth/me", headers=registered_user["headers"]).json()["id"]
    legacy = jwt.encode(
        {"sub": user_id, "exp": datetime.now(UTC) + timedelta(minutes=5)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    response = client.post("/auth/sign-out", headers={"Authorization": f"Bearer {legacy}"})
    assert response.status_code == 204
