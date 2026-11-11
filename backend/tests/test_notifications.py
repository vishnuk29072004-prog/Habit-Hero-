"""Stage 10 notifications API tests (isolated SQLite)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.utils import date_keys


def _auth(h: dict) -> dict:
    return {"Authorization": h["Authorization"]}


def _patch_today(monkeypatch, day: str = "2026-11-15"):
    monkeypatch.setattr(date_keys, "today_key", lambda: day)
    monkeypatch.setattr(
        "app.services.notification_generator.today_key", lambda: day
    )
    monkeypatch.setattr("app.services.goal_progress.today_key", lambda: day)
    monkeypatch.setattr("app.services.goal_service.today_key", lambda: day)
    monkeypatch.setattr("app.utils.streak_calculations.today_key", lambda: day)


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


def test_generate_daily_habit_reminder(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    generated = client.post(
        "/api/v1/notifications/generate", headers=_auth(auth_headers)
    )
    assert generated.status_code == 200
    assert generated.json()["data"]["created"] >= 1

    listed = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_daily_reminder"},
    )
    assert listed.status_code == 200
    data = listed.json()["data"]
    assert data["total"] >= 1
    assert data["items"][0]["unread"] is True
    assert "pending" in data["items"][0]["message"].lower()


def test_duplicate_prevention_on_regenerate(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    first = client.post(
        "/api/v1/notifications/generate", headers=_auth(auth_headers)
    ).json()["data"]
    second = client.post(
        "/api/v1/notifications/generate", headers=_auth(auth_headers)
    ).json()["data"]
    assert first["created"] >= 1
    assert second["created"] == 0
    assert second["skipped"] >= first["created"]

    listed = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_daily_reminder"},
    ).json()["data"]
    assert listed["total"] == 1


def test_overdue_not_recreated_every_request(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    habit = _create_habit(client, auth_headers)
    # Missed 2026-11-14 (past, scheduled, no check-in)
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    overdue = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": True, "type": "habit_overdue"},
    ).json()["data"]
    assert overdue["total"] >= 1
    count_after_refresh = overdue["total"]
    again = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": True, "type": "habit_overdue"},
    ).json()["data"]
    assert again["total"] == count_after_refresh
    # Completing today should not create another overdue for today
    _checkin(client, auth_headers, habit["id"], "2026-11-15")


def test_mark_read_and_mark_all_read(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))

    listed = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False},
    ).json()["data"]
    assert listed["unread"] >= 1
    first_id = listed["items"][0]["id"]

    marked = client.patch(
        f"/api/v1/notifications/{first_id}/read",
        headers=_auth(auth_headers),
    )
    assert marked.status_code == 200
    assert marked.json()["data"]["unread"] is False

    summary = client.get(
        "/api/v1/notifications/summary",
        headers=_auth(auth_headers),
        params={"refresh": False},
    ).json()["data"]
    assert summary["total"] >= 1

    all_read = client.post(
        "/api/v1/notifications/read-all", headers=_auth(auth_headers)
    )
    assert all_read.status_code == 200
    assert all_read.json()["data"]["updated"] >= 0

    after = client.get(
        "/api/v1/notifications/summary",
        headers=_auth(auth_headers),
        params={"refresh": False},
    ).json()["data"]
    assert after["unread"] == 0


def test_weekly_habit_reminder_on_scheduled_day(
    client: TestClient, auth_headers: dict, monkeypatch
):
    # 2026-11-14 is Saturday (week_day=6)
    _patch_today(monkeypatch, "2026-11-14")
    _create_habit(
        client,
        auth_headers,
        name="Saturday Football",
        frequency="Weekly",
        week_day=6,
    )
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    weekly = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_weekly_reminder"},
    ).json()["data"]
    assert weekly["total"] == 1

    # Sunday should not create weekly for Saturday habit
    _patch_today(monkeypatch, "2026-11-15")
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    weekly_sun = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_weekly_reminder"},
    ).json()["data"]
    # Still only the Saturday one (new day uses different dedupe if scheduled — not scheduled)
    assert weekly_sun["total"] == 1


def test_upcoming_and_goal_reminders(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    habit = _create_habit(client, auth_headers)
    client.post(
        "/api/v1/goals",
        headers=_auth(auth_headers),
        json={
            "name": "Finish strong",
            "category": "Health",
            "target_type": "completion_count",
            "target_value": 10,
            "start_date": "2026-11-01",
            "end_date": "2026-11-17",
            "linked_habit_id": habit["id"],
        },
    )
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))

    upcoming = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_upcoming"},
    ).json()["data"]
    assert upcoming["total"] >= 1
    assert "tomorrow" in upcoming["items"][0]["message"].lower()

    deadline = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "goal_deadline"},
    ).json()["data"]
    assert deadline["total"] >= 1


def test_goal_overdue_reminder(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-20")
    habit = _create_habit(client, auth_headers)
    client.post(
        "/api/v1/goals",
        headers=_auth(auth_headers),
        json={
            "name": "Missed goal",
            "category": "Health",
            "target_type": "completion_count",
            "target_value": 20,
            "start_date": "2026-11-01",
            "end_date": "2026-11-10",
            "linked_habit_id": habit["id"],
        },
    )
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    overdue = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "goal_overdue"},
    ).json()["data"]
    assert overdue["total"] >= 1


def test_preferences_disable_generation(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    client.patch(
        "/api/v1/users/me/settings",
        headers=_auth(auth_headers),
        json={"notifications_enabled": False},
    )
    result = client.post(
        "/api/v1/notifications/generate", headers=_auth(auth_headers)
    ).json()["data"]
    assert result["created"] == 0
    listed = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False},
    ).json()["data"]
    assert listed["total"] == 0


def test_notification_user_isolation(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    mine = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False},
    ).json()["data"]
    assert mine["total"] >= 1
    nid = mine["items"][0]["id"]

    other = {
        "full_name": "Other",
        "email": "notif-other@example.com",
        "password": "SecurePassword123!",
    }
    client.post("/api/v1/auth/register", json=other)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    ).json()
    other_headers = {"Authorization": f"Bearer {login['data']['access_token']}"}

    assert (
        client.get(
            f"/api/v1/notifications/{nid}", headers=other_headers
        ).status_code
        == 404
    )
    listed = client.get(
        "/api/v1/notifications",
        headers=other_headers,
        params={"refresh": False},
    ).json()["data"]
    assert listed["total"] == 0


def test_notifications_require_auth(client: TestClient):
    assert client.get("/api/v1/notifications").status_code in (401, 403)
    assert client.post("/api/v1/notifications/read-all").status_code in (401, 403)


def test_date_boundary_today_is_pending_not_overdue(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    habit = _create_habit(client, auth_headers)
    client.post("/api/v1/notifications/generate", headers=_auth(auth_headers))
    overdue = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_overdue"},
    ).json()["data"]
    # Overdue may exist for earlier missed days, but none for today
    for item in overdue["items"]:
        assert "2026-11-15" not in item["message"]
    daily = client.get(
        "/api/v1/notifications",
        headers=_auth(auth_headers),
        params={"refresh": False, "type": "habit_daily_reminder"},
    ).json()["data"]
    assert any(i["resource_id"] == habit["id"] for i in daily["items"])
