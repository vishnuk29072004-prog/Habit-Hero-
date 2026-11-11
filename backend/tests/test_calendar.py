"""Calendar and day-note API tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.utils import date_keys
from app.utils.habit_schedule import is_habit_scheduled_on_date
from app.utils.streak_calculations import get_current_streak, get_longest_streak


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


def _checkin(client, headers, habit_id, date_key, status="completed"):
    return client.post(
        f"/api/v1/habits/{habit_id}/checkins",
        headers=_auth(headers),
        json={"date": date_key, "status": status},
    )


def test_retrieve_monthly_calendar(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(date_keys, "today_key", lambda: "2026-11-15")
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    response = client.get(
        "/api/v1/calendar/monthly",
        headers=_auth(auth_headers),
        params={"month": 11, "year": 2026},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["month"] == 11
    assert data["year"] == 2026
    assert len(data["days"]) == 30
    day = next(d for d in data["days"] if d["date"] == "2026-11-11")
    assert day["completed"] == 1
    assert day["total_habits"] == 1
    assert day["completion_percentage"] == 100


def test_retrieve_daily_calendar(client: TestClient, auth_headers: dict, monkeypatch):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    response = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["date"] == "2026-11-11"
    assert data["summary"]["completed"] == 1
    assert len(data["habits"]) == 1
    assert data["habits"][0]["status"] == "completed"


def test_retrieve_date_range_summary(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    _checkin(client, auth_headers, habit["id"], "2026-11-10")
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    response = client.get(
        "/api/v1/calendar/summary",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-10", "end_date": "2026-11-12"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_scheduled"] == 3
    assert data["completed"] == 2
    assert data["missed"] == 1
    assert data["completion_percentage"] == 67
    assert len(data["daily_trend"]) == 3


def test_calculate_completion_percentage(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    day = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    ).json()["data"]["summary"]
    assert day["completion_percentage"] == 100


def test_calculate_pending_and_missed(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    past = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-10"},
    ).json()["data"]["summary"]
    assert past["missed"] == 1
    assert past["pending"] == 0

    today = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-15"},
    ).json()["data"]["summary"]
    assert today["pending"] == 1
    assert today["missed"] == 0


def test_exclude_future_dates_from_missed(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    _create_habit(client, auth_headers)
    future = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-20"},
    ).json()["data"]["summary"]
    assert future["missed"] == 0
    assert future["pending"] == 1


def test_exclude_unscheduled_days_weekly(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    _create_habit(
        client,
        auth_headers,
        frequency="Weekly",
        week_day=6,
        start_date="2026-11-01",
    )
    monday = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-10"},
    ).json()["data"]
    assert monday["summary"]["total_habits"] == 0
    assert monday["habits"] == []

    saturday = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-07"},
    ).json()["data"]
    assert saturday["summary"]["total_habits"] == 1


def test_respect_habit_start_dates(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    _create_habit(client, auth_headers, start_date="2026-11-12")
    before = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    ).json()["data"]["summary"]
    assert before["total_habits"] == 0


def test_respect_archived_habits(
    client: TestClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    habit = _create_habit(client, auth_headers)
    client.patch(
        f"/api/v1/habits/{habit['id']}/archive",
        headers=_auth(auth_headers),
    )
    day = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-20"},
    ).json()["data"]
    assert day["summary"]["total_habits"] == 0


def test_journal_and_notes_indicators(
    client: TestClient, auth_headers: dict, monkeypatch, db_session
):
    from app.models.journal import JournalEntry
    from app.models.user import User
    from sqlalchemy import select

    monkeypatch.setattr(
        "app.services.calendar_service.today_key", lambda: "2026-11-15"
    )
    user = db_session.scalar(select(User).where(User.email == "user@example.com"))
    db_session.add(
        JournalEntry(
            id="j1",
            user_id=user.id,
            date="2026-11-11",
            habit_id=None,
            title="Hello",
            content="Body",
            mood="happy",
            created_at="2026-11-11T00:00:00+00:00",
            updated_at="2026-11-11T00:00:00+00:00",
        )
    )
    db_session.commit()

    client.post(
        "/api/v1/calendar/notes",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "notes": "Felt strong today"},
    )
    day = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    ).json()["data"]["summary"]
    assert day["has_journal"] is True
    assert day["has_notes"] is True


def test_day_notes_crud_and_duplicate_prevention(
    client: TestClient, auth_headers: dict
):
    created = client.post(
        "/api/v1/calendar/notes",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "notes": "First note"},
    )
    assert created.status_code == 201
    note_id = created.json()["data"]["id"]

    dup = client.post(
        "/api/v1/calendar/notes",
        headers=_auth(auth_headers),
        json={"date": "2026-11-11", "notes": "Another"},
    )
    assert dup.status_code == 409

    listed = client.get(
        "/api/v1/calendar/notes",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    )
    assert listed.status_code == 200
    assert len(listed.json()["data"]) == 1

    updated = client.patch(
        f"/api/v1/calendar/notes/{note_id}",
        headers=_auth(auth_headers),
        json={"notes": "Updated note"},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["notes"] == "Updated note"

    deleted = client.delete(
        f"/api/v1/calendar/notes/{note_id}",
        headers=_auth(auth_headers),
    )
    assert deleted.status_code == 200


def test_date_boundary_handling(client: TestClient, auth_headers: dict):
    bad = client.get(
        "/api/v1/calendar/summary",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-12", "end_date": "2026-11-10"},
    )
    assert bad.status_code == 400


def test_scheduling_utility_weekdays():
    class H:
        frequency = "Weekly"
        start_date = "2026-11-01"
        week_day = 6
        archived = 0

    assert is_habit_scheduled_on_date(H(), "2026-11-07") is True
    assert is_habit_scheduled_on_date(H(), "2026-11-08") is False


def test_streak_utilities_skip_unscheduled_days(monkeypatch):
    monkeypatch.setattr(date_keys, "today_key", lambda: "2026-11-12")
    monkeypatch.setattr(
        "app.utils.streak_calculations.today_key", lambda: "2026-11-12"
    )

    class Daily:
        id = "d1"
        frequency = "Daily"
        start_date = "2026-11-01"
        week_day = None
        archived = 0

    completed_days = {"2026-11-10", "2026-11-11", "2026-11-12"}

    def is_completed(habit, key):
        return key in completed_days

    assert (
        get_current_streak([Daily()], is_completed=is_completed, as_of="2026-11-12")
        == 3
    )
    assert (
        get_longest_streak(
            [Daily()], is_completed=is_completed, as_of="2026-11-12", lookback_days=30
        )
        == 3
    )
