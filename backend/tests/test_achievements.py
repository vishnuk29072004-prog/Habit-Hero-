"""Stage 8 achievements API tests (isolated SQLite)."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.achievements.catalogue import ACHIEVEMENT_DEFS
from app.utils import date_keys


def _auth(h: dict) -> dict:
    return {"Authorization": h["Authorization"]}


def _patch_today(monkeypatch, day: str = "2026-11-15"):
    monkeypatch.setattr(date_keys, "today_key", lambda: day)
    monkeypatch.setattr("app.services.goal_service.today_key", lambda: day)
    monkeypatch.setattr("app.services.goal_progress.today_key", lambda: day)
    monkeypatch.setattr("app.services.achievement_service.today_key", lambda: day)
    monkeypatch.setattr("app.utils.streak_calculations.today_key", lambda: day)


def _create_habit(client: TestClient, headers: dict, **overrides) -> dict:
    payload = {
        "name": "Morning Workout",
        "category": "Health",
        "frequency": "Daily",
        "start_date": "2026-10-01",
        "description": "",
        "notes": "",
        "icon": "dumbbell",
    }
    payload.update(overrides)
    return client.post("/api/v1/habits", headers=_auth(headers), json=payload).json()[
        "data"
    ]


def _create_goal(client: TestClient, headers: dict, **overrides) -> dict:
    payload = {
        "name": "Goal",
        "description": "",
        "category": "Health",
        "icon": "target",
        "target_type": "completion_count",
        "target_value": 1,
        "start_date": "2026-11-01",
        "end_date": "2026-11-30",
        "notes": "",
    }
    payload.update(overrides)
    return client.post("/api/v1/goals", headers=_auth(headers), json=payload).json()[
        "data"
    ]


def _checkin(client, headers, habit_id, date_key, status="completed"):
    return client.post(
        f"/api/v1/habits/{habit_id}/checkins",
        headers=_auth(headers),
        json={"date": date_key, "status": status},
    )


def test_catalogue_has_eight_defs():
    assert len(ACHIEVEMENT_DEFS) == 8
    ids = {d.id for d in ACHIEVEMENT_DEFS}
    assert ids == {
        "first_goal_completed",
        "streak_7",
        "streak_12",
        "streak_15",
        "streak_30",
        "five_goals_completed",
        "completion_milestone_50",
        "personal_best_streak",
    }


def test_empty_achievements_summary(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    response = client.get(
        "/api/v1/achievements/summary", headers=_auth(auth_headers)
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_earned"] == 0
    assert data["total_available"] == 8
    assert len(data["catalogue"]) == 8
    assert all(not item["earned"] for item in data["catalogue"])


def test_first_goal_completed_award(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    goal = _create_goal(client, auth_headers, linked_habit_id=habit["id"])
    _checkin(client, auth_headers, habit["id"], "2026-11-10")

    earned = client.get("/api/v1/achievements", headers=_auth(auth_headers))
    assert earned.status_code == 200
    ids = {row["achievement_id"] for row in earned.json()["data"]}
    assert "first_goal_completed" in ids

    detail = client.get(
        "/api/v1/achievements/first_goal_completed",
        headers=_auth(auth_headers),
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["unlocked_at"] == "2026-11-15"

    # Goal still readable after award
    assert (
        client.get(
            f"/api/v1/goals/{goal['id']}", headers=_auth(auth_headers)
        ).json()["data"]["status"]
        == "completed"
    )


def test_duplicate_award_preserves_unlocked_at(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    habit = _create_habit(client, auth_headers)
    _create_goal(client, auth_headers, linked_habit_id=habit["id"])
    _checkin(client, auth_headers, habit["id"], "2026-11-10")

    first = client.get(
        "/api/v1/achievements/first_goal_completed",
        headers=_auth(auth_headers),
    ).json()["data"]
    original = first["unlocked_at"]

    _patch_today(monkeypatch, "2026-11-20")
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    again = client.get(
        "/api/v1/achievements/first_goal_completed",
        headers=_auth(auth_headers),
    ).json()["data"]
    assert again["unlocked_at"] == original
    assert again["id"] == first["id"]

    listed = client.get("/api/v1/achievements", headers=_auth(auth_headers)).json()[
        "data"
    ]
    assert (
        sum(1 for row in listed if row["achievement_id"] == "first_goal_completed")
        == 1
    )


def test_streak_achievement_after_checkins(
    client: TestClient, auth_headers: dict, monkeypatch
):
    today = "2026-11-15"
    _patch_today(monkeypatch, today)
    habit = _create_habit(client, auth_headers)
    start = date.fromisoformat(today) - timedelta(days=6)
    for i in range(7):
        day = (start + timedelta(days=i)).isoformat()
        _checkin(client, auth_headers, habit["id"], day)

    summary = client.get(
        "/api/v1/achievements/summary", headers=_auth(auth_headers)
    ).json()["data"]
    earned_ids = {
        item["achievement_id"] for item in summary["catalogue"] if item["earned"]
    }
    assert "streak_7" in earned_ids
    assert "personal_best_streak" in earned_ids


def test_completion_milestone_and_five_goals(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)

    for i in range(5):
        _create_goal(
            client,
            auth_headers,
            name=f"G{i}",
            linked_habit_id=habit["id"],
            target_value=1,
        )
    # One check-in completes all five linked completion_count goals
    _checkin(client, auth_headers, habit["id"], "2026-11-10")

    summary = client.get(
        "/api/v1/achievements/summary", headers=_auth(auth_headers)
    ).json()["data"]
    earned = {
        item["achievement_id"] for item in summary["catalogue"] if item["earned"]
    }
    assert "first_goal_completed" in earned
    assert "five_goals_completed" in earned
    assert "completion_milestone_50" in earned


def test_achievements_isolation(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    _create_goal(client, auth_headers, linked_habit_id=habit["id"])
    _checkin(client, auth_headers, habit["id"], "2026-11-10")

    other = {
        "full_name": "Other",
        "email": "ach-other@example.com",
        "password": "SecurePassword123!",
    }
    client.post("/api/v1/auth/register", json=other)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    ).json()
    other_headers = {"Authorization": f"Bearer {login['data']['access_token']}"}

    listed = client.get("/api/v1/achievements", headers=other_headers).json()["data"]
    assert listed == []
    assert (
        client.get(
            "/api/v1/achievements/first_goal_completed",
            headers=other_headers,
        ).status_code
        == 404
    )


def test_achievements_require_auth(client: TestClient):
    assert client.get("/api/v1/achievements").status_code in (401, 403)
    assert client.get("/api/v1/achievements/summary").status_code in (401, 403)
