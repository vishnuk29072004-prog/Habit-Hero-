"""User profile management API tests (isolated SQLite + temp uploads)."""

from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User
from tests.conftest import make_image_bytes


def _auth_only(auth_headers: dict) -> dict:
    return {"Authorization": auth_headers["Authorization"]}


def test_retrieve_authenticated_profile(client: TestClient, auth_headers: dict):
    response = client.get("/api/v1/users/me", headers=_auth_only(auth_headers))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["message"] == "Profile retrieved successfully"
    assert body["data"]["email"] == "user@example.com"
    assert body["data"]["full_name"] == "Vishnu"
    assert body["data"]["avatar_url"] is None
    assert "created_at" in body["data"]
    assert "password_hash" not in body["data"]


def test_reject_unauthenticated_profile_access(client: TestClient):
    response = client.get("/api/v1/users/me")
    assert response.status_code in (401, 403)


def test_update_full_name(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"full_name": "Vishnu H"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["full_name"] == "Vishnu H"
    assert response.json()["data"]["email"] == "user@example.com"


def test_update_email(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"email": "new@example.com"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "new@example.com"


def test_reject_duplicate_email(client: TestClient, auth_headers: dict):
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Other",
            "email": "other@example.com",
            "password": "SecurePassword123!",
        },
    )
    response = client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"email": "other@example.com"},
    )
    assert response.status_code == 409


def test_reject_invalid_email(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422


def test_reject_unsupported_profile_fields(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"password_hash": "hacked", "id": "someone-else"},
    )
    assert response.status_code == 422


def _upload_avatar(client: TestClient, headers: dict, raw: bytes, filename: str, content_type: str):
    return client.post(
        "/api/v1/users/me/avatar",
        headers=headers,
        files={"file": (filename, BytesIO(raw), content_type)},
    )


def test_upload_valid_jpeg(client: TestClient, auth_headers: dict):
    raw = make_image_bytes("JPEG")
    response = _upload_avatar(
        client, _auth_only(auth_headers), raw, "avatar.jpg", "image/jpeg"
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["avatar_url"] is not None
    assert data["avatar_url"].startswith("/uploads/avatars/")
    relative = data["avatar_url"].removeprefix("/uploads/")
    assert (settings.uploads_path / relative).is_file()


def test_upload_valid_png(client: TestClient, auth_headers: dict):
    raw = make_image_bytes("PNG")
    response = _upload_avatar(
        client, _auth_only(auth_headers), raw, "avatar.png", "image/png"
    )
    assert response.status_code == 200
    assert response.json()["data"]["avatar_url"].endswith(".png")


def test_upload_valid_webp(client: TestClient, auth_headers: dict):
    raw = make_image_bytes("WEBP")
    response = _upload_avatar(
        client, _auth_only(auth_headers), raw, "avatar.webp", "image/webp"
    )
    assert response.status_code == 200
    assert response.json()["data"]["avatar_url"].endswith(".webp")


def test_reject_unsupported_image_types(client: TestClient, auth_headers: dict):
    buffer = BytesIO()
    Image.new("RGB", (32, 32), (0, 255, 0)).save(buffer, format="GIF")
    response = _upload_avatar(
        client, _auth_only(auth_headers), buffer.getvalue(), "x.gif", "image/gif"
    )
    assert response.status_code == 400


def test_reject_oversized_images(client: TestClient, auth_headers: dict):
    oversized = b"x" * (settings.max_avatar_bytes + 1)
    response = _upload_avatar(
        client, _auth_only(auth_headers), oversized, "big.jpg", "image/jpeg"
    )
    assert response.status_code == 400


def test_reject_malformed_image_content(client: TestClient, auth_headers: dict):
    response = _upload_avatar(
        client,
        _auth_only(auth_headers),
        b"not-an-image",
        "fake.jpg",
        "image/jpeg",
    )
    assert response.status_code == 400


def test_replace_profile_image(client: TestClient, auth_headers: dict):
    first = _upload_avatar(
        client,
        _auth_only(auth_headers),
        make_image_bytes("JPEG", color=(10, 10, 10)),
        "a.jpg",
        "image/jpeg",
    ).json()["data"]["avatar_url"]
    first_rel = first.removeprefix("/uploads/")
    first_path = settings.uploads_path / first_rel
    assert first_path.is_file()

    second = _upload_avatar(
        client,
        _auth_only(auth_headers),
        make_image_bytes("PNG", color=(20, 20, 20)),
        "b.png",
        "image/png",
    ).json()["data"]["avatar_url"]
    assert second != first
    assert not first_path.exists()
    second_rel = second.removeprefix("/uploads/")
    assert (settings.uploads_path / second_rel).is_file()


def test_delete_profile_image(client: TestClient, auth_headers: dict):
    uploaded = _upload_avatar(
        client,
        _auth_only(auth_headers),
        make_image_bytes("JPEG"),
        "a.jpg",
        "image/jpeg",
    ).json()["data"]["avatar_url"]
    relative = uploaded.removeprefix("/uploads/")
    path = settings.uploads_path / relative
    assert path.is_file()

    response = client.delete("/api/v1/users/me/avatar", headers=_auth_only(auth_headers))
    assert response.status_code == 200
    assert response.json()["data"]["avatar_url"] is None
    assert not path.exists()

    # Missing avatar is graceful
    again = client.delete("/api/v1/users/me/avatar", headers=_auth_only(auth_headers))
    assert again.status_code == 200


def test_reject_unauthenticated_image_upload(client: TestClient):
    response = _upload_avatar(
        client, {}, make_image_bytes("JPEG"), "a.jpg", "image/jpeg"
    )
    assert response.status_code in (401, 403)


def test_change_password_successfully(
    client: TestClient, auth_headers: dict, register_payload: dict, db_session: Session
):
    response = client.patch(
        "/api/v1/users/me/password",
        headers=_auth_only(auth_headers),
        json={
            "current_password": register_payload["password"],
            "new_password": "NewPassword123!",
        },
    )
    assert response.status_code == 200
    user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    assert user is not None
    assert verify_password("NewPassword123!", user.password_hash)
    assert not verify_password(register_payload["password"], user.password_hash)


def test_reject_incorrect_current_password(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me/password",
        headers=_auth_only(auth_headers),
        json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!",
        },
    )
    assert response.status_code == 401


def test_reject_weak_new_password(
    client: TestClient, auth_headers: dict, register_payload: dict
):
    response = client.patch(
        "/api/v1/users/me/password",
        headers=_auth_only(auth_headers),
        json={
            "current_password": register_payload["password"],
            "new_password": "weak",
        },
    )
    assert response.status_code == 422


def test_reject_password_reuse(
    client: TestClient, auth_headers: dict, register_payload: dict
):
    response = client.patch(
        "/api/v1/users/me/password",
        headers=_auth_only(auth_headers),
        json={
            "current_password": register_payload["password"],
            "new_password": register_payload["password"],
        },
    )
    assert response.status_code == 400


def test_verify_refresh_token_revocation_after_password_change(
    client: TestClient, auth_headers: dict, register_payload: dict, db_session: Session
):
    refresh = auth_headers["refresh_token"]
    client.patch(
        "/api/v1/users/me/password",
        headers=_auth_only(auth_headers),
        json={
            "current_password": register_payload["password"],
            "new_password": "NewPassword123!",
        },
    )
    rows = db_session.scalars(select(RefreshToken)).all()
    assert rows
    assert all(row.revoked_at is not None for row in rows)

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh},
    )
    assert refresh_response.status_code == 401


def test_retrieve_user_settings(client: TestClient, auth_headers: dict):
    response = client.get("/api/v1/users/me/settings", headers=_auth_only(auth_headers))
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["streak_goal_target"] == 15
    assert body["data"]["notifications_enabled"] is True
    assert body["data"]["remind_habits_daily"] is True
    assert "updated_at" in body["data"]


def test_update_streak_target(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me/settings",
        headers=_auth_only(auth_headers),
        json={"streak_goal_target": 21},
    )
    assert response.status_code == 200
    assert response.json()["data"]["streak_goal_target"] == 21
    # Existing streak update must not clear notification prefs
    assert response.json()["data"]["notifications_enabled"] is True


def test_update_notification_preferences(client: TestClient, auth_headers: dict):
    response = client.patch(
        "/api/v1/users/me/settings",
        headers=_auth_only(auth_headers),
        json={
            "notifications_enabled": True,
            "remind_habits_overdue": False,
            "remind_weekly_summary": False,
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["notifications_enabled"] is True
    assert data["remind_habits_overdue"] is False
    assert data["remind_weekly_summary"] is False
    assert data["streak_goal_target"] == 15


def test_reject_invalid_settings(client: TestClient, auth_headers: dict):
    too_low = client.patch(
        "/api/v1/users/me/settings",
        headers=_auth_only(auth_headers),
        json={"streak_goal_target": 0},
    )
    assert too_low.status_code == 422

    unknown = client.patch(
        "/api/v1/users/me/settings",
        headers=_auth_only(auth_headers),
        json={"theme_mode": "dark"},
    )
    assert unknown.status_code == 422


def test_verify_user_isolation(client: TestClient, auth_headers: dict):
    other = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Other User",
            "email": "isolated@example.com",
            "password": "SecurePassword123!",
        },
    )
    assert other.status_code == 201
    other_login = client.post(
        "/api/v1/auth/login",
        json={"email": "isolated@example.com", "password": "SecurePassword123!"},
    ).json()
    other_headers = {
        "Authorization": f"Bearer {other_login['data']['access_token']}"
    }

    client.patch(
        "/api/v1/users/me",
        headers=_auth_only(auth_headers),
        json={"full_name": "Only Vishnu"},
    )
    client.patch(
        "/api/v1/users/me/settings",
        headers=_auth_only(auth_headers),
        json={"streak_goal_target": 30},
    )

    other_profile = client.get("/api/v1/users/me", headers=other_headers).json()
    other_settings = client.get(
        "/api/v1/users/me/settings", headers=other_headers
    ).json()
    assert other_profile["data"]["full_name"] == "Other User"
    assert other_profile["data"]["email"] == "isolated@example.com"
    assert other_settings["data"]["streak_goal_target"] == 15
