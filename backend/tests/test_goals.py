"""Stage 8 goals API tests (isolated SQLite)."""

from __future__ import annotations

from fastapi.testclient import TestClient

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
        "start_date": "2026-11-01",
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
        "name": "Hit the gym",
        "description": "Build consistency",
        "category": "Health",
        "icon": "target",
        "target_type": "completion_count",
        "target_value": 3,
        "start_date": "2026-11-01",
        "end_date": "2026-11-30",
        "notes": "",
    }
    payload.update(overrides)
    return client.post("/api/v1/goals", headers=_auth(headers), json=payload)


def _checkin(client, headers, habit_id, date_key, status="completed"):
    return client.post(
        f"/api/v1/habits/{habit_id}/checkins",
        headers=_auth(headers),
        json={"date": date_key, "status": status},
    )


def test_create_and_get_goal(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    response = _create_goal(
        client, auth_headers, linked_habit_id=habit["id"], target_value=5
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Hit the gym"
    assert data["linked_habit_id"] == habit["id"]
    assert data["status"] == "not_started"
    assert data["progress"]["current"] == 0
    assert data["archived"] is False

    fetched = client.get(
        f"/api/v1/goals/{data['id']}", headers=_auth(auth_headers)
    )
    assert fetched.status_code == 200
    assert fetched.json()["data"]["id"] == data["id"]


def test_list_goals_filters_and_pagination(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    _create_goal(client, auth_headers, name="A", category="Health")
    _create_goal(client, auth_headers, name="B", category="Work")
    archived = _create_goal(client, auth_headers, name="C", category="Health").json()[
        "data"
    ]
    client.patch(
        f"/api/v1/goals/{archived['id']}",
        headers=_auth(auth_headers),
        json={"archived": True},
    )

    listed = client.get(
        "/api/v1/goals",
        headers=_auth(auth_headers),
        params={"category": "Health", "archived": False},
    )
    assert listed.status_code == 200
    body = listed.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["name"] == "A"

    page = client.get(
        "/api/v1/goals",
        headers=_auth(auth_headers),
        params={"page": 1, "page_size": 1},
    )
    assert page.json()["data"]["page_size"] == 1
    assert len(page.json()["data"]["items"]) == 1


def test_goal_progress_completion_count(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    goal = _create_goal(
        client,
        auth_headers,
        linked_habit_id=habit["id"],
        target_type="completion_count",
        target_value=2,
    ).json()["data"]

    _checkin(client, auth_headers, habit["id"], "2026-11-10")
    _checkin(client, auth_headers, habit["id"], "2026-11-11")

    fetched = client.get(
        f"/api/v1/goals/{goal['id']}", headers=_auth(auth_headers)
    ).json()["data"]
    assert fetched["progress"]["current"] == 2
    assert fetched["progress"]["rate"] == 100
    assert fetched["status"] == "completed"
    assert fetched["completed_at"] is not None


def test_goal_progress_consecutive_and_days_completed(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)

    consecutive = _create_goal(
        client,
        auth_headers,
        name="Streak goal",
        linked_habit_id=habit["id"],
        target_type="consecutive_days",
        target_value=3,
    ).json()["data"]
    days = _create_goal(
        client,
        auth_headers,
        name="Days goal",
        linked_habit_id=habit["id"],
        target_type="days_completed",
        target_value=2,
    ).json()["data"]

    for day in ("2026-11-10", "2026-11-11", "2026-11-12"):
        _checkin(client, auth_headers, habit["id"], day)

    c = client.get(
        f"/api/v1/goals/{consecutive['id']}", headers=_auth(auth_headers)
    ).json()["data"]
    assert c["progress"]["current"] == 3
    assert c["status"] == "completed"

    d = client.get(
        f"/api/v1/goals/{days['id']}", headers=_auth(auth_headers)
    ).json()["data"]
    assert d["progress"]["current"] == 2
    assert d["status"] == "completed"


def test_goal_completion_percentage(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-05")
    habit = _create_habit(client, auth_headers)
    goal = _create_goal(
        client,
        auth_headers,
        linked_habit_id=habit["id"],
        target_type="completion_percentage",
        target_value=50,
        start_date="2026-11-01",
        end_date="2026-11-04",
    ).json()["data"]

    _checkin(client, auth_headers, habit["id"], "2026-11-01")
    _checkin(client, auth_headers, habit["id"], "2026-11-02")

    fetched = client.get(
        f"/api/v1/goals/{goal['id']}", headers=_auth(auth_headers)
    ).json()["data"]
    assert fetched["progress"]["actual_rate"] == 50
    assert fetched["progress"]["met"] is True
    assert fetched["status"] == "completed"


def test_goal_overdue_and_in_progress(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-20")
    habit = _create_habit(client, auth_headers)
    overdue = _create_goal(
        client,
        auth_headers,
        name="Late",
        linked_habit_id=habit["id"],
        target_value=5,
        start_date="2026-11-01",
        end_date="2026-11-10",
    ).json()["data"]
    assert overdue["status"] == "overdue"

    active = _create_goal(
        client,
        auth_headers,
        name="Active",
        linked_habit_id=habit["id"],
        target_value=5,
        start_date="2026-11-01",
        end_date="2026-11-30",
    ).json()["data"]
    _checkin(client, auth_headers, habit["id"], "2026-11-15")
    progress = client.get(
        f"/api/v1/goals/{active['id']}", headers=_auth(auth_headers)
    ).json()["data"]
    assert progress["status"] == "in_progress"


def test_goals_summary(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    _create_goal(
        client,
        auth_headers,
        linked_habit_id=habit["id"],
        target_value=1,
        start_date="2026-11-01",
        end_date="2026-11-30",
    )
    _checkin(client, auth_headers, habit["id"], "2026-11-10")
    _create_goal(
        client,
        auth_headers,
        name="Open",
        linked_habit_id=habit["id"],
        target_value=10,
    )

    summary = client.get("/api/v1/goals/summary", headers=_auth(auth_headers))
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["total"] == 2
    assert data["completed"] >= 1
    assert "completion_rate" in data
    assert len(data["goals"]) == 2


def test_update_and_delete_goal(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    goal = _create_goal(
        client, auth_headers, linked_habit_id=habit["id"]
    ).json()["data"]

    updated = client.patch(
        f"/api/v1/goals/{goal['id']}",
        headers=_auth(auth_headers),
        json={"name": "Renamed", "clear_linked_habit": True, "notes": "n"},
    )
    assert updated.status_code == 200
    body = updated.json()["data"]
    assert body["name"] == "Renamed"
    assert body["linked_habit_id"] is None
    assert body["notes"] == "n"

    deleted = client.delete(
        f"/api/v1/goals/{goal['id']}", headers=_auth(auth_headers)
    )
    assert deleted.status_code == 200
    assert deleted.json()["data"]["deleted"] is True
    assert (
        client.get(
            f"/api/v1/goals/{goal['id']}", headers=_auth(auth_headers)
        ).status_code
        == 404
    )


def test_invalid_goal_payloads(client: TestClient, auth_headers: dict, monkeypatch):
    _patch_today(monkeypatch)
    bad_dates = _create_goal(
        client,
        auth_headers,
        start_date="2026-11-20",
        end_date="2026-11-10",
    )
    assert bad_dates.status_code == 422

    bad_pct = _create_goal(
        client,
        auth_headers,
        target_type="completion_percentage",
        target_value=150,
    )
    assert bad_pct.status_code == 422

    bad_category = _create_goal(client, auth_headers, category="Cooking")
    assert bad_category.status_code == 422


def test_linked_habit_must_be_owned(
    client: TestClient, auth_headers: dict, monkeypatch, register_payload: dict
):
    _patch_today(monkeypatch)
    other = {
        "full_name": "Other",
        "email": "other@example.com",
        "password": "SecurePassword123!",
    }
    client.post("/api/v1/auth/register", json=other)
    other_login = client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    ).json()
    other_headers = {
        "Authorization": f"Bearer {other_login['data']['access_token']}"
    }
    foreign_habit = _create_habit(client, other_headers)

    response = _create_goal(
        client, auth_headers, linked_habit_id=foreign_habit["id"]
    )
    assert response.status_code == 400
    assert "linked_habit_id" in response.json()["message"].lower() or "habit" in str(
        response.json()["detail"]
    ).lower()


def test_goals_isolation_between_users(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    goal = _create_goal(client, auth_headers).json()["data"]

    other = {
        "full_name": "Other",
        "email": "goals-other@example.com",
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
            f"/api/v1/goals/{goal['id']}", headers=other_headers
        ).status_code
        == 404
    )
    listed = client.get("/api/v1/goals", headers=other_headers).json()["data"]
    assert listed["total"] == 0


def test_goals_require_auth(client: TestClient):
    assert client.get("/api/v1/goals").status_code in (401, 403)
    assert client.post("/api/v1/goals", json={}).status_code in (401, 403, 422)
