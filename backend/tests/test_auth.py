"""Authentication API tests (isolated in-memory SQLite)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_token, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.auth_service import (
    create_expired_access_token_for_tests,
    create_expired_refresh_token_for_tests,
)


def _register(client: TestClient, payload: dict):
    return client.post("/api/v1/auth/register", json=payload)


def _login(client: TestClient, email: str, password: str):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def test_successful_registration(client: TestClient, register_payload: dict):
    response = _register(client, register_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["message"] == "Account created successfully"
    assert body["data"]["full_name"] == "Vishnu"
    assert body["data"]["email"] == "user@example.com"
    assert "id" in body["data"]
    assert "password" not in body["data"]
    assert "password_hash" not in body["data"]


def test_duplicate_email_registration(client: TestClient, register_payload: dict):
    assert _register(client, register_payload).status_code == 201
    response = _register(client, register_payload)
    assert response.status_code == 409
    assert response.json()["success"] is False


def test_invalid_email(client: TestClient, register_payload: dict):
    payload = {**register_payload, "email": "not-an-email"}
    response = _register(client, payload)
    assert response.status_code == 422


def test_weak_password(client: TestClient, register_payload: dict):
    payload = {**register_payload, "password": "weak"}
    response = _register(client, payload)
    assert response.status_code == 422


def test_successful_login(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    response = _login(client, register_payload["email"], register_payload["password"])
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["token_type"] == "bearer"
    assert body["data"]["access_token"]
    assert body["data"]["refresh_token"]
    assert body["data"]["user"]["email"] == "user@example.com"
    assert "password" not in body["data"]["user"]
    assert "password_hash" not in body["data"]["user"]


def test_incorrect_password(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    response = _login(client, register_payload["email"], "WrongPassword123!")
    assert response.status_code == 401
    assert response.json()["message"] == "Invalid email or password"


def test_nonexistent_email(client: TestClient):
    response = _login(client, "nobody@example.com", "SecurePassword123!")
    assert response.status_code == 401
    assert response.json()["message"] == "Invalid email or password"


def test_get_current_user_with_valid_token(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    token = login["data"]["access_token"]
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["email"] == "user@example.com"
    assert "password_hash" not in body["data"]


def test_get_current_user_without_token(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


def test_expired_access_token(client: TestClient, register_payload: dict, db_session: Session):
    _register(client, register_payload)
    user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    assert user is not None
    token = create_expired_access_token_for_tests(user.id)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_invalid_jwt(client: TestClient):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not.a.valid.jwt"},
    )
    assert response.status_code == 401


def test_successful_refresh(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login["data"]["refresh_token"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["access_token"]
    assert body["data"]["refresh_token"]
    assert body["data"]["refresh_token"] != login["data"]["refresh_token"]


def test_expired_refresh_token(
    client: TestClient, register_payload: dict, db_session: Session
):
    _register(client, register_payload)
    user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    assert user is not None
    expired = create_expired_refresh_token_for_tests(db_session, user)
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": expired},
    )
    assert response.status_code == 401


def test_revoked_refresh_token(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    refresh = login["data"]["refresh_token"]
    logout = client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert logout.status_code == 200
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert response.status_code == 401


def test_refresh_token_rotation(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    old_refresh = login["data"]["refresh_token"]
    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    ).json()
    new_refresh = refreshed["data"]["refresh_token"]
    assert new_refresh != old_refresh
    # New token works
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert again.status_code == 200


def test_reuse_of_old_refresh_token(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    old_refresh = login["data"]["refresh_token"]
    assert (
        client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh}).status_code
        == 200
    )
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse.status_code == 401


def test_successful_logout(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": login["data"]["refresh_token"]},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_refresh_after_logout(client: TestClient, register_payload: dict):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    refresh = login["data"]["refresh_token"]
    client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert response.status_code == 401


def test_password_stored_as_hash(
    client: TestClient, register_payload: dict, db_session: Session
):
    _register(client, register_payload)
    user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    assert user is not None
    assert user.password_hash != register_payload["password"]
    assert user.password_hash.startswith("$2")
    assert verify_password(register_payload["password"], user.password_hash)


def test_user_response_does_not_expose_sensitive_fields(
    client: TestClient, register_payload: dict, db_session: Session
):
    _register(client, register_payload)
    login = _login(client, register_payload["email"], register_payload["password"]).json()
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login['data']['access_token']}"},
    ).json()
    dumped = str(me)
    assert "password" not in me["data"]
    assert "password_hash" not in me["data"]
    assert "password_hash" not in dumped

    # Refresh token stored only as hash
    row = db_session.scalar(select(RefreshToken))
    assert row is not None
    assert row.token_hash == hash_token(login["data"]["refresh_token"])
    assert row.token_hash != login["data"]["refresh_token"]
