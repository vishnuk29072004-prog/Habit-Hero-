"""Habit management API tests (isolated in-memory SQLite)."""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitCheckin


def _auth(headers: dict) -> dict:
    return {"Authorization": headers["Authorization"]}


def _habit_payload(**overrides) -> dict:
    payload = {
        "name": "Morning Workout",
        "description": "30 minutes cardio",
        "notes": "",
        "icon": "dumbbell",
        "category": "Health",
        "frequency": "Daily",
        "start_date": "2026-11-01",
    }
    payload.update(overrides)
    return payload


def _create(client: TestClient, headers: dict, **overrides):
    return client.post(
        "/api/v1/habits",
        headers=_auth(headers),
        json=_habit_payload(**overrides),
    )


def test_create_habit(client: TestClient, auth_headers: dict):
    response = _create(client, auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["name"] == "Morning Workout"
    assert body["data"]["frequency"] == "Daily"
    assert body["data"]["category"] == "Health"
    assert body["data"]["is_active"] is True
    assert body["data"]["is_archived"] is False
    assert body["data"]["week_day"] is None


def test_retrieve_all_habits(client: TestClient, auth_headers: dict):
    _create(client, auth_headers, name="A")
    _create(client, auth_headers, name="B")
    response = client.get("/api/v1/habits", headers=_auth(auth_headers))
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_retrieve_individual_habit(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]
    response = client.get(
        f"/api/v1/habits/{created['id']}",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["id"] == created["id"]


def test_update_habit(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]
    response = client.patch(
        f"/api/v1/habits/{created['id']}",
        headers=_auth(auth_headers),
        json={"name": "Evening Yoga", "category": "Mental Health"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Evening Yoga"
    assert data["category"] == "Mental Health"
    assert data["frequency"] == "Daily"


def test_delete_habit_without_history(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]
    response = client.delete(
        f"/api/v1/habits/{created['id']}",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["action"] == "deleted"
    missing = client.get(
        f"/api/v1/habits/{created['id']}",
        headers=_auth(auth_headers),
    )
    assert missing.status_code == 404


def test_archive_habit(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]
    response = client.patch(
        f"/api/v1/habits/{created['id']}/archive",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_archived"] is True
    assert response.json()["data"]["is_active"] is False


def test_restore_habit(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]
    client.patch(
        f"/api/v1/habits/{created['id']}/archive",
        headers=_auth(auth_headers),
    )
    response = client.patch(
        f"/api/v1/habits/{created['id']}/restore",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_archived"] is False


def test_search_habits(client: TestClient, auth_headers: dict):
    _create(client, auth_headers, name="Morning Workout")
    _create(client, auth_headers, name="Read Books", category="Learning")
    response = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"search": "workout"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Morning Workout"


def test_filter_by_category(client: TestClient, auth_headers: dict):
    _create(client, auth_headers, category="Health")
    _create(client, auth_headers, name="Deep Work", category="Work")
    response = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"category": "Work"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["category"] == "Work"


def test_filter_by_frequency(client: TestClient, auth_headers: dict):
    _create(client, auth_headers, frequency="Daily")
    _create(
        client,
        auth_headers,
        name="Weekly Review",
        frequency="Weekly",
        week_day=1,
    )
    response = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"frequency": "Weekly"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["frequency"] == "Weekly"
    assert data["items"][0]["week_day"] == 1


def test_filter_by_status(client: TestClient, auth_headers: dict):
    active = _create(client, auth_headers, name="Active").json()["data"]
    archived = _create(client, auth_headers, name="Old").json()["data"]
    client.patch(
        f"/api/v1/habits/{archived['id']}/archive",
        headers=_auth(auth_headers),
    )
    active_list = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"status": "active"},
    ).json()["data"]
    archived_list = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"status": "archived"},
    ).json()["data"]
    assert active_list["total"] == 1
    assert active_list["items"][0]["id"] == active["id"]
    assert archived_list["total"] == 1
    assert archived_list["items"][0]["id"] == archived["id"]


def test_pagination(client: TestClient, auth_headers: dict):
    for i in range(5):
        _create(client, auth_headers, name=f"Habit {i}")
    page1 = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"page": 1, "page_size": 2},
    ).json()["data"]
    page2 = client.get(
        "/api/v1/habits",
        headers=_auth(auth_headers),
        params={"page": 2, "page_size": 2},
    ).json()["data"]
    assert page1["total"] == 5
    assert len(page1["items"]) == 2
    assert page2["page"] == 2
    assert len(page2["items"]) == 2
    ids = {item["id"] for item in page1["items"] + page2["items"]}
    assert len(ids) == 4


def test_empty_habit_name_validation(client: TestClient, auth_headers: dict):
    response = _create(client, auth_headers, name="   ")
    assert response.status_code == 422


def test_invalid_frequency_validation(client: TestClient, auth_headers: dict):
    response = _create(client, auth_headers, frequency="Monthly")
    assert response.status_code == 422


def test_invalid_date_validation(client: TestClient, auth_headers: dict):
    response = _create(client, auth_headers, start_date="11-01-2026")
    assert response.status_code == 422


def test_unauthenticated_requests(client: TestClient):
    assert client.get("/api/v1/habits").status_code in (401, 403)
    assert client.post("/api/v1/habits", json=_habit_payload()).status_code in (
        401,
        403,
    )


def test_user_isolation(client: TestClient, auth_headers: dict):
    created = _create(client, auth_headers).json()["data"]

    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Other",
            "email": "other-habits@example.com",
            "password": "SecurePassword123!",
        },
    )
    other_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "other-habits@example.com",
            "password": "SecurePassword123!",
        },
    ).json()
    other = {"Authorization": f"Bearer {other_login['data']['access_token']}"}

    assert (
        client.get(f"/api/v1/habits/{created['id']}", headers=other).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/habits/{created['id']}",
            headers=other,
            json={"name": "Hacked"},
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/habits/{created['id']}", headers=other).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/habits/{created['id']}/archive",
            headers=other,
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/habits/{created['id']}/restore",
            headers=other,
        ).status_code
        == 404
    )

    own = client.get("/api/v1/habits", headers=other).json()["data"]
    assert own["total"] == 0


def test_archive_conflict_and_restore_conflict(
    client: TestClient, auth_headers: dict
):
    created = _create(client, auth_headers).json()["data"]
    client.patch(
        f"/api/v1/habits/{created['id']}/archive",
        headers=_auth(auth_headers),
    )
    again = client.patch(
        f"/api/v1/habits/{created['id']}/archive",
        headers=_auth(auth_headers),
    )
    assert again.status_code == 409

    active = _create(client, auth_headers, name="Still Active").json()["data"]
    restore = client.patch(
        f"/api/v1/habits/{active['id']}/restore",
        headers=_auth(auth_headers),
    )
    assert restore.status_code == 409


def test_historical_record_preservation(
    client: TestClient, auth_headers: dict, db_session: Session
):
    created = _create(client, auth_headers).json()["data"]
    checkin = HabitCheckin(
        habit_id=created["id"],
        date=date.today().isoformat(),
        completed=1,
        notes="done",
        updated_at="2026-11-11T00:00:00+00:00",
    )
    db_session.add(checkin)
    db_session.commit()

    response = client.delete(
        f"/api/v1/habits/{created['id']}",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["action"] == "archived"
    assert body["data"]["habit"]["is_archived"] is True

    still = db_session.scalar(
        select(HabitCheckin).where(HabitCheckin.habit_id == created["id"])
    )
    assert still is not None
    habit = db_session.get(Habit, created["id"])
    assert habit is not None
    assert habit.archived == 1


def test_database_transaction_rollback_on_failure(
    client: TestClient,
    auth_headers: dict,
    db_session: Session,
    monkeypatch,
):
    import pytest

    original_commit = db_session.commit

    def failing_commit():
        raise RuntimeError("forced failure")

    monkeypatch.setattr(db_session, "commit", failing_commit)
    try:
        with pytest.raises(RuntimeError, match="forced failure"):
            _create(client, auth_headers, name="Should Rollback")
    finally:
        monkeypatch.setattr(db_session, "commit", original_commit)
        db_session.rollback()

    remaining = db_session.scalars(select(Habit)).all()
    assert all(h.name != "Should Rollback" for h in remaining)
