"""Stage 7 analytics API tests (isolated SQLite)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.utils import date_keys


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


def _patch_today(monkeypatch, day: str = "2026-11-15"):
    monkeypatch.setattr(date_keys, "today_key", lambda: day)
    monkeypatch.setattr("app.services.analytics_service.today_key", lambda: day)
    monkeypatch.setattr("app.utils.streak_calculations.today_key", lambda: day)


def test_empty_analytics_overview(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    response = client.get("/api/v1/analytics/overview", headers=_auth(auth_headers))
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_habits"] == 0
    assert data["today_scheduled"] == 0
    assert data["overall_completion_percentage"] == 0
    assert data["current_streak"] == 0


def test_overview_with_habits_and_checkins(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    _checkin(client, auth_headers, habit["id"], "2026-11-15")
    archived = _create_habit(client, auth_headers, name="Old Habit")
    client.patch(
        f"/api/v1/habits/{archived['id']}/archive",
        headers=_auth(auth_headers),
    )
    response = client.get("/api/v1/analytics/overview", headers=_auth(auth_headers))
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_habits"] == 2
    assert data["active_habits"] == 1
    assert data["archived_habits"] == 1
    assert data["today_scheduled"] == 1
    assert data["today_completed"] == 1
    assert data["today_completion_percentage"] == 100
    assert data["total_completed_checkins"] >= 1


def test_habit_analytics_daily_and_weekly(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    daily = _create_habit(client, auth_headers)
    weekly = _create_habit(
        client,
        auth_headers,
        name="Saturday Football",
        frequency="Weekly",
        week_day=6,
        category="Work",
    )
    _checkin(client, auth_headers, daily["id"], "2026-11-10")
    _checkin(client, auth_headers, weekly["id"], "2026-11-07")

    daily_analytics = client.get(
        f"/api/v1/analytics/habits/{daily['id']}",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-01", "end_date": "2026-11-15"},
    )
    assert daily_analytics.status_code == 200
    d = daily_analytics.json()["data"]
    assert d["total_completed"] >= 1
    assert d["completion_percentage"] >= 0
    assert "weekly_performance" in d
    assert d["first_completion_date"] == "2026-11-10"

    weekly_analytics = client.get(
        f"/api/v1/analytics/habits/{weekly['id']}",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-01", "end_date": "2026-11-15"},
    )
    assert weekly_analytics.status_code == 200
    w = weekly_analytics.json()["data"]
    assert w["total_scheduled"] >= 1
    assert w["total_completed"] == 1


def test_weekly_analytics_seven_days(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    _create_habit(client, auth_headers)
    response = client.get(
        "/api/v1/analytics/weekly",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["week_start"] == "2026-11-09"  # Monday
    assert data["week_end"] == "2026-11-15"  # Sunday
    assert len(data["days"]) == 7


def test_monthly_analytics_and_leap_year(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2024-03-01")
    _create_habit(client, auth_headers, start_date="2024-02-01")
    feb = client.get(
        "/api/v1/analytics/monthly",
        headers=_auth(auth_headers),
        params={"month": 2, "year": 2024},
    )
    assert feb.status_code == 200
    assert len(feb.json()["data"]["daily_trend"]) == 29  # leap year

    _patch_today(monkeypatch, "2026-11-15")
    habit = _create_habit(client, auth_headers, name="Nov Habit")
    _checkin(client, auth_headers, habit["id"], "2026-11-11")
    nov = client.get(
        "/api/v1/analytics/monthly",
        headers=_auth(auth_headers),
        params={"month": 11, "year": 2026},
    )
    assert nov.status_code == 200
    data = nov.json()["data"]
    assert data["month"] == 11
    assert len(data["daily_trend"]) == 30
    assert data["completed"] >= 1
    assert isinstance(data["weekly_breakdown"], list)
    assert isinstance(data["habit_performance"], list)


def test_category_performance(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    h1 = _create_habit(client, auth_headers, category="Health")
    h2 = _create_habit(
        client, auth_headers, name="Deep Work", category="Work"
    )
    _checkin(client, auth_headers, h1["id"], "2026-11-11")
    _checkin(client, auth_headers, h2["id"], "2026-11-11", status="incomplete")
    response = client.get(
        "/api/v1/analytics/categories",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-11", "end_date": "2026-11-11"},
    )
    assert response.status_code == 200
    cats = {c["category"]: c for c in response.json()["data"]["categories"]}
    assert "Health" in cats
    assert cats["Health"]["completed"] == 1
    assert "Work" in cats
    assert cats["Work"]["missed"] == 1


def test_best_days_ranking(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    # Complete Mon 10, miss Tue 11
    _checkin(client, auth_headers, habit["id"], "2026-11-10")
    response = client.get(
        "/api/v1/analytics/best-days",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-10", "end_date": "2026-11-11"},
    )
    assert response.status_code == 200
    days = response.json()["data"]["days"]
    assert days
    assert days[0]["rank"] == 1
    assert days[0]["completion_percentage"] == 100
    # Unscheduled weekdays absent
    assert all(d["scheduled"] > 0 for d in days)


def test_streak_analytics(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch, "2026-11-12")
    habit = _create_habit(client, auth_headers)
    for d in ("2026-11-10", "2026-11-11", "2026-11-12"):
        _checkin(client, auth_headers, habit["id"], d)
    response = client.get("/api/v1/analytics/streaks", headers=_auth(auth_headers))
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["current_streak"] == 3
    assert data["longest_streak"] >= 3
    assert data["per_habit"][0]["current_streak"] == 3
    assert data["best_performing_habit"]["habit_id"] == habit["id"]


def test_archived_habits_excluded_from_active_analytics(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    client.patch(
        f"/api/v1/habits/{habit['id']}/archive",
        headers=_auth(auth_headers),
    )
    weekly = client.get(
        "/api/v1/analytics/weekly",
        headers=_auth(auth_headers),
        params={"date": "2026-11-15"},
    ).json()["data"]
    assert weekly["total_scheduled"] == 0


def test_future_dates_are_pending_not_missed(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    _create_habit(client, auth_headers)
    response = client.get(
        "/api/v1/analytics/weekly",
        headers=_auth(auth_headers),
        params={"date": "2026-11-20"},
    )
    assert response.status_code == 200
    # Week of Nov 16–22 contains future days relative to Nov 15
    future_days = [d for d in response.json()["data"]["days"] if d["is_future"]]
    assert future_days
    assert all(d["missed"] == 0 for d in future_days)


def test_analytics_user_isolation(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Other",
            "email": "analytics-other@example.com",
            "password": "SecurePassword123!",
        },
    )
    other_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "analytics-other@example.com",
            "password": "SecurePassword123!",
        },
    ).json()
    other = {"Authorization": f"Bearer {other_login['data']['access_token']}"}
    assert (
        client.get(
            f"/api/v1/analytics/habits/{habit['id']}", headers=other
        ).status_code
        == 404
    )
    overview = client.get("/api/v1/analytics/overview", headers=other).json()["data"]
    assert overview["total_habits"] == 0


def test_analytics_requires_auth(client: TestClient):
    assert client.get("/api/v1/analytics/overview").status_code in (401, 403)


def test_invalid_date_boundaries(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    bad = client.get(
        f"/api/v1/analytics/habits/{habit['id']}",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-20", "end_date": "2026-11-10"},
    )
    assert bad.status_code == 400
