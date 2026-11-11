"""Stage 9 journal API tests (isolated SQLite; separate from day_notes)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.schemas.journal import JOURNAL_MOODS, JOURNAL_TAGS
from app.utils import date_keys


def _auth(h: dict) -> dict:
    return {"Authorization": h["Authorization"]}


def _patch_today(monkeypatch, day: str = "2026-11-15"):
    monkeypatch.setattr(date_keys, "today_key", lambda: day)
    monkeypatch.setattr("app.services.journal_service.today_key", lambda: day)
    monkeypatch.setattr("app.services.calendar_service.today_key", lambda: day)


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


def _create_entry(client: TestClient, headers: dict, **overrides):
    payload = {
        "date": "2026-11-10",
        "title": "Reflection",
        "content": "Felt focused after the workout.",
        "mood": "motivated",
        "tags": ["Health", "Motivation"],
    }
    payload.update(overrides)
    return client.post("/api/v1/journal", headers=_auth(headers), json=payload)


def test_moods_and_tags_match_frontend():
    assert JOURNAL_MOODS == (
        "happy",
        "productive",
        "motivated",
        "neutral",
        "tired",
        "stressed",
        "sad",
    )
    assert JOURNAL_TAGS == (
        "Productivity",
        "Health",
        "Learning",
        "Personal Growth",
        "Motivation",
        "Reflection",
    )


def test_create_get_update_delete_preserves_created_at(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    created = _create_entry(client, auth_headers)
    assert created.status_code == 201
    data = created.json()["data"]
    assert data["mood"] == "motivated"
    assert data["tags"] == ["Health", "Motivation"]
    assert data["created_at"]
    original_created = data["created_at"]

    fetched = client.get(
        f"/api/v1/journal/{data['id']}", headers=_auth(auth_headers)
    )
    assert fetched.status_code == 200
    assert fetched.json()["data"]["content"] == data["content"]

    updated = client.patch(
        f"/api/v1/journal/{data['id']}",
        headers=_auth(auth_headers),
        json={
            "title": "Updated title",
            "content": "Updated body",
            "mood": "happy",
            "tags": ["Reflection"],
        },
    )
    assert updated.status_code == 200
    body = updated.json()["data"]
    assert body["title"] == "Updated title"
    assert body["tags"] == ["Reflection"]
    assert body["created_at"] == original_created
    assert body["updated_at"] >= original_created

    deleted = client.delete(
        f"/api/v1/journal/{data['id']}", headers=_auth(auth_headers)
    )
    assert deleted.status_code == 200
    assert deleted.json()["data"]["deleted"] is True
    assert (
        client.get(
            f"/api/v1/journal/{data['id']}", headers=_auth(auth_headers)
        ).status_code
        == 404
    )


def test_update_tags_allows_overlapping_replace_set(
    client: TestClient, auth_headers: dict, monkeypatch
):
    """Replace-set must flush deletes before inserts when a tag is retained."""
    _patch_today(monkeypatch)
    created = _create_entry(
        client,
        auth_headers,
        tags=["Health", "Motivation"],
    )
    assert created.status_code == 201
    entry_id = created.json()["data"]["id"]

    updated = client.patch(
        f"/api/v1/journal/{entry_id}",
        headers=_auth(auth_headers),
        json={"tags": ["Health", "Reflection"]},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["tags"] == ["Health", "Reflection"]


def test_list_search_filters_pagination_sort(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    _create_entry(
        client,
        auth_headers,
        date="2026-11-08",
        title="Alpha",
        content="Learning notes",
        mood="productive",
        tags=["Learning"],
        habit_id=habit["id"],
    )
    _create_entry(
        client,
        auth_headers,
        date="2026-11-12",
        title="Beta",
        content="Stressed day",
        mood="stressed",
        tags=["Reflection"],
    )
    _create_entry(
        client,
        auth_headers,
        date="2026-11-10",
        title="Gamma",
        content="General thoughts",
        mood="neutral",
        tags=["Health"],
    )

    by_mood = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"mood": "stressed"},
    ).json()["data"]
    assert by_mood["total"] == 1
    assert by_mood["items"][0]["title"] == "Beta"

    by_tag = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"tag": "Learning"},
    ).json()["data"]
    assert by_tag["total"] == 1

    by_habit = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"habit_id": habit["id"]},
    ).json()["data"]
    assert by_habit["total"] == 1

    general = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"habit_id": "general"},
    ).json()["data"]
    assert general["total"] == 2

    search = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"search": "morning"},
    ).json()["data"]
    assert search["total"] == 1
    assert search["items"][0]["title"] == "Alpha"

    ranged = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"start_date": "2026-11-09", "end_date": "2026-11-11"},
    ).json()["data"]
    assert ranged["total"] == 1
    assert ranged["items"][0]["title"] == "Gamma"

    newest = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"sort": "newest", "page": 1, "page_size": 2},
    ).json()["data"]
    assert newest["page_size"] == 2
    assert len(newest["items"]) == 2
    assert newest["items"][0]["date"] >= newest["items"][1]["date"]

    oldest = client.get(
        "/api/v1/journal",
        headers=_auth(auth_headers),
        params={"sort": "oldest"},
    ).json()["data"]
    assert oldest["items"][0]["date"] <= oldest["items"][-1]["date"]


def test_invalid_mood_tag_and_empty_content(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    bad_mood = _create_entry(client, auth_headers, mood="excited")
    assert bad_mood.status_code == 422

    bad_tag = _create_entry(client, auth_headers, tags=["Cooking"])
    assert bad_tag.status_code == 422

    empty = _create_entry(client, auth_headers, content="   ")
    assert empty.status_code == 422


def test_habit_must_be_owned(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    other = {
        "full_name": "Other",
        "email": "journal-other@example.com",
        "password": "SecurePassword123!",
    }
    client.post("/api/v1/auth/register", json=other)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": other["email"], "password": other["password"]},
    ).json()
    other_headers = {"Authorization": f"Bearer {login['data']['access_token']}"}
    foreign = _create_habit(client, other_headers)

    response = _create_entry(
        client, auth_headers, habit_id=foreign["id"]
    )
    assert response.status_code == 400


def test_clear_habit_on_update(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    habit = _create_habit(client, auth_headers)
    entry = _create_entry(
        client, auth_headers, habit_id=habit["id"]
    ).json()["data"]
    assert entry["habit_id"] == habit["id"]

    cleared = client.patch(
        f"/api/v1/journal/{entry['id']}",
        headers=_auth(auth_headers),
        json={"clear_habit": True},
    ).json()["data"]
    assert cleared["habit_id"] is None


def test_summary_stats_and_streaks(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch, "2026-11-15")
    for day in ("2026-11-13", "2026-11-14", "2026-11-15"):
        _create_entry(
            client,
            auth_headers,
            date=day,
            title=day,
            content=f"Entry for {day}",
            mood="happy",
            tags=["Motivation"],
        )
    _create_entry(
        client,
        auth_headers,
        date="2026-11-01",
        title="Old",
        content="Earlier",
        mood="tired",
        tags=["Health"],
    )

    summary = client.get(
        "/api/v1/journal/summary",
        headers=_auth(auth_headers),
        params={"period": "thisMonth"},
    )
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["total_entries"] == 4
    assert data["active_days"] == 4
    assert data["current_streak"] == 3
    assert data["longest_streak"] >= 3
    assert data["overview"]["journaled_days"] >= 3
    assert data["overview"]["period"] == "thisMonth"
    assert data["moods"] == list(JOURNAL_MOODS)
    assert data["tags"] == list(JOURNAL_TAGS)
    assert any(m["mood"] == "happy" for m in data["mood_breakdown"])


def test_journal_calendar_indicator_separate_from_day_notes(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    _create_entry(
        client,
        auth_headers,
        date="2026-11-11",
        content="Journal only",
        mood="neutral",
        tags=["Reflection"],
    )
    day = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-11"},
    ).json()["data"]["summary"]
    assert day["has_journal"] is True
    assert day["has_notes"] is False

    client.post(
        "/api/v1/calendar/notes",
        headers=_auth(auth_headers),
        json={"date": "2026-11-12", "notes": "Note only"},
    )
    note_day = client.get(
        "/api/v1/calendar/daily",
        headers=_auth(auth_headers),
        params={"date": "2026-11-12"},
    ).json()["data"]["summary"]
    assert note_day["has_notes"] is True
    assert note_day["has_journal"] is False


def test_journal_user_isolation(
    client: TestClient, auth_headers: dict, monkeypatch
):
    _patch_today(monkeypatch)
    entry = _create_entry(client, auth_headers).json()["data"]

    other = {
        "full_name": "Other",
        "email": "journal-iso@example.com",
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
            f"/api/v1/journal/{entry['id']}", headers=other_headers
        ).status_code
        == 404
    )
    listed = client.get("/api/v1/journal", headers=other_headers).json()["data"]
    assert listed["total"] == 0


def test_journal_requires_auth(client: TestClient):
    assert client.get("/api/v1/journal").status_code in (401, 403)
    assert client.get("/api/v1/journal/summary").status_code in (401, 403)
