"""Habit check-in API tests."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitCheckin


def _auth(h: dict) -> dict:
    return {"Authorization": h["Authorization"]}


def _create_habit(client: TestClient, headers: dict, **overrides) -> dict:
    payload = {
        "name": "Morning Workout",
        "category": "Health",
        "frequency": "Daily",
        "start_date": "2026-11-01",
        "description": "",
        "notes": "",
        "icon": "dumbbell",
    }
    payload.update(overrides)
    return client.post("/api/v1/habits", headers=_auth(headers), json=payload).json()[
        "data"
    ]


def test_create_daily_habit_checkin(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    response = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={
            "date": "2026-11-11",
            "status": "completed",
            "notes": "Completed my morning workout.",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["status"] == "completed"
    assert data["date"] == "2026-11-11"
    assert data["habit_id"] == habit["id"]


def test_create_weekly_habit_checkin(client: TestClient, auth_headers: dict):
    # 2026-11-07 is Saturday (weekday 6)
    habit = _create_habit(
        client,
        auth_headers,
        name="Football",
        frequency="Weekly",
        week_day=6,
        start_date="2026-11-01",
    )
    response = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-07", "status": "completed"},
    )
    assert response.status_code == 201


def test_retrieve_checkins(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-10", "status": "completed"},
    )
    client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "incomplete"},
    )
    response = client.get(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["total"] == 2


def test_retrieve_checkin_by_date(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    )
    response = client.get(
        f"/api/v1/habits/{habit['id']}/checkins/2026-11-11",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert response.json()["data"]["date"] == "2026-11-11"
    missing = client.get(
        f"/api/v1/habits/{habit['id']}/checkins/2026-11-12",
        headers=_auth(auth_headers),
    )
    assert missing.status_code == 404


def test_update_checkin(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    created = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "incomplete", "notes": ""},
    ).json()["data"]
    response = client.patch(
        f"/api/v1/habits/{habit['id']}/checkins/{created['id']}",
        headers=_auth(auth_headers),
        json={"status": "completed", "notes": "Done later"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "completed"
    assert response.json()["data"]["notes"] == "Done later"


def test_delete_checkin(client: TestClient, auth_headers: dict, db_session: Session):
    habit = _create_habit(client, auth_headers)
    created = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    ).json()["data"]
    response = client.delete(
        f"/api/v1/habits/{habit['id']}/checkins/{created['id']}",
        headers=_auth(auth_headers),
    )
    assert response.status_code == 200
    assert db_session.get(HabitCheckin, created["id"]) is None
    assert db_session.get(Habit, habit["id"]) is not None


def test_prevent_duplicate_checkins(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    first = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    )
    assert first.status_code == 201
    second = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    )
    assert second.status_code == 409


def test_reject_invalid_habit_ids(client: TestClient, auth_headers: dict):
    response = client.post(
        "/api/v1/habits/does-not-exist/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    )
    assert response.status_code == 404


def test_reject_unscheduled_weekday(client: TestClient, auth_headers: dict):
    habit = _create_habit(
        client,
        auth_headers,
        frequency="Weekly",
        week_day=6,
        start_date="2026-11-01",
    )
    # 2026-11-10 is Monday
    response = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-10", "status": "completed"},
    )
    assert response.status_code == 400


def test_reject_checkins_before_start_date(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers, start_date="2026-11-10")
    response = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-01", "status": "completed"},
    )
    assert response.status_code == 400


def test_reject_archived_habit_checkins(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    client.patch(
        f"/api/v1/habits/{habit['id']}/archive",
        headers=_auth(auth_headers),
    )
    response = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    )
    assert response.status_code == 400


def test_reject_unauthenticated_checkin_requests(client: TestClient):
    assert client.get("/api/v1/habits/x/checkins").status_code in (401, 403)


def test_checkin_user_isolation(client: TestClient, auth_headers: dict):
    habit = _create_habit(client, auth_headers)
    created = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    ).json()["data"]

    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Other",
            "email": "checkin-other@example.com",
            "password": "SecurePassword123!",
        },
    )
    other_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "checkin-other@example.com",
            "password": "SecurePassword123!",
        },
    ).json()
    other = {"Authorization": f"Bearer {other_login['data']['access_token']}"}

    assert (
        client.get(
            f"/api/v1/habits/{habit['id']}/checkins", headers=other
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/habits/{habit['id']}/checkins/{created['id']}",
            headers=other,
            json={"status": "incomplete"},
        ).status_code
        == 404
    )


def test_historical_checkin_preserved_on_habit_archive(
    client: TestClient, auth_headers: dict, db_session: Session
):
    habit = _create_habit(client, auth_headers)
    created = client.post(
        f"/api/v1/habits/{habit['id']}/checkins",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "status": "completed"},
    ).json()["data"]
    client.patch(
        f"/api/v1/habits/{habit['id']}/archive",
        headers=_auth(auth_headers),
    )
    row = db_session.scalar(
        select(HabitCheckin).where(HabitCheckin.id == created["id"])
    )
    assert row is not None
    assert row.completed == 1
