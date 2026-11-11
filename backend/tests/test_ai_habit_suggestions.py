"""Stage C – AI habit suggestions (Gemini mocked)."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.schemas.ai import HabitSuggestionsLLMResponse
from app.services import gemini_service
from app.services.gemini_service import (
    GeminiAPIError,
    GeminiInvalidResponseError,
    GeminiRateLimitError,
    GeminiUnavailableError,
)


def _auth(h: dict) -> dict:
    return {"Authorization": h["Authorization"]}


def _register_login(client: TestClient, email: str, password: str = "SecurePassword123!"):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "AI User", "email": email, "password": password},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _fake_suggestions(names=None):
    today = date.today().isoformat()
    names = names or [
        "Morning Stretch",
        "Read 10 Pages",
        "Deep Work Block",
        "Evening Walk",
        "Gratitude Note",
    ]
    cats = ["Health", "Learning", "Productivity", "Health", "Mental Health", "Work"]
    freqs = ["Daily", "Daily", "Weekly", "Daily", "Daily", "Weekly"]
    return HabitSuggestionsLLMResponse(
        suggestions=[
            {
                "name": names[i],
                "description": f"Practice {names[i]}",
                "category": cats[i % len(cats)],
                "frequency": freqs[i % len(freqs)],
                "reason": "Supports consistency",
                "recommended_start_date": today,
            }
            for i in range(len(names))
        ]
    )


@pytest.fixture(autouse=True)
def _clear_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_unauthenticated_habit_suggestions(client: TestClient):
    res = client.post("/api/v1/ai/habit-suggestions", json={})
    assert res.status_code in (401, 403)


def test_authenticated_habit_suggestions(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_1@example.com")

    today = date.today().isoformat()
    client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Existing Habit",
            "category": "Health",
            "frequency": "Daily",
            "start_date": today,
        },
    )
    client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "Stay healthy",
            "category": "Health",
            "target_type": "days_completed",
            "target_value": 10,
            "start_date": today,
            "end_date": today,
        },
    )

    def fake_json(prompt, response_schema, **kwargs):  # noqa: ARG001
        assert "Existing Habit" in prompt
        assert "Stay healthy" in prompt
        return _fake_suggestions()

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)

    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["count"] == 5
    assert len(data["suggestions"]) == 5
    for item in data["suggestions"]:
        assert item["category"] in {
            "Health",
            "Work",
            "Learning",
            "Productivity",
            "Mental Health",
        }
        assert item["frequency"] in {"Daily", "Weekly"}
        assert item["name"]
        assert item["recommended_start_date"]


def test_user_isolation_prompt_context(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    today = date.today().isoformat()

    headers_a = _register_login(client, "ai_hab_a@example.com")
    headers_b = _register_login(client, "ai_hab_b@example.com")

    client.post(
        "/api/v1/habits",
        headers=headers_a,
        json={
            "name": "Secret Habit A",
            "category": "Work",
            "frequency": "Daily",
            "start_date": today,
        },
    )

    captured = {}

    def fake_json(prompt, response_schema, **kwargs):  # noqa: ARG001
        captured["prompt"] = prompt
        return _fake_suggestions()

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)

    res = client.post("/api/v1/ai/habit-suggestions", headers=headers_b, json={})
    assert res.status_code == 200
    assert "Secret Habit A" not in captured["prompt"]


def test_duplicate_suggestion_filtered(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_dup@example.com")
    today = date.today().isoformat()
    client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Morning Stretch",
            "category": "Health",
            "frequency": "Daily",
            "start_date": today,
        },
    )

    def fake_json(prompt, response_schema, **kwargs):  # noqa: ARG001
        return _fake_suggestions(
            [
                "Morning Stretch",
                "Read 10 Pages",
                "Deep Work Block",
                "Evening Walk",
                "Gratitude Note",
                "Hydration Reminder",
            ]
        )

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 200
    names = [s["name"] for s in res.json()["data"]["suggestions"]]
    assert "Morning Stretch" not in names
    assert len(names) == 5


def test_invalid_gemini_response(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_bad@example.com")

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiInvalidResponseError("bad json")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 502


def test_gemini_timeout(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_to@example.com")

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiAPIError("Gemini request timed out. Please try again in a moment.")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 504
    detail = res.json().get("detail") or res.json().get("message") or ""
    assert "timed out" in str(detail).lower()


def test_gemini_unavailable_high_demand(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_unavail@example.com")

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiUnavailableError(
            "Gemini is temporarily overloaded. Please try again in a moment."
        )

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 503
    detail = res.json().get("detail") or res.json().get("message") or ""
    assert "overloaded" in str(detail).lower() or "high demand" in str(detail).lower()


def test_gemini_api_failure(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_fail@example.com")

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiAPIError("upstream boom")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 502


def test_missing_api_key(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_nokey@example.com")

    def boom(*args, **kwargs):  # noqa: ARG001
        raise AssertionError("Gemini should not be called without a key")

    monkeypatch.setattr(gemini_service, "generate_json", boom)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 503


def test_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_hab_rl@example.com")

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiRateLimitError("quota")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post("/api/v1/ai/habit-suggestions", headers=headers, json={})
    assert res.status_code == 429


def test_frequency_normalization_daily_weekly():
    item = HabitSuggestionsLLMResponse(
        suggestions=[
            {
                "name": "Walk",
                "description": "Walk",
                "category": "Health",
                "frequency": "daily",
                "reason": "x",
                "recommended_start_date": date.today().isoformat(),
            }
        ]
    )
    assert item.suggestions[0].frequency == "Daily"
