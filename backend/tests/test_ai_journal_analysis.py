"""Stage D – AI journal mood analysis (Gemini mocked)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.schemas.ai import MoodAnalysisLLMResponse
from app.services import gemini_service
from app.services.gemini_service import (
    GeminiAPIError,
    GeminiInvalidResponseError,
    GeminiRateLimitError,
)


def _register_login(client: TestClient, email: str, password: str = "SecurePassword123!"):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "AI Journal User", "email": email, "password": password},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_entries(client: TestClient, headers: dict, dates: list[str]):
    moods = ["happy", "motivated", "tired", "stressed", "productive"]
    for i, d in enumerate(dates):
        res = client.post(
            "/api/v1/journal",
            headers=headers,
            json={
                "date": d,
                "title": f"Entry {i + 1}",
                "content": f"Reflection for {d}: feeling {moods[i % len(moods)]}.",
                "mood": moods[i % len(moods)],
                "tags": ["Reflection", "Motivation"],
            },
        )
        assert res.status_code == 201, res.text


def _fake_analysis() -> MoodAnalysisLLMResponse:
    return MoodAnalysisLLMResponse(
        overall_mood="Mostly motivated with some tired moments",
        mood_summary="Mood stayed generally constructive across the period.",
        mood_patterns={
            "positive": ["Consistent motivated days"],
            "challenging": ["Occasional tired evenings"],
        },
        motivation_patterns=["Motivation rises after productive reflections"],
        positive_observations=["You kept writing regularly"],
        areas_to_improve=["Protect rest on tired days"],
        recommendations=["Keep short evening check-ins"],
        summary="A balanced stretch with clear motivation and manageable dips.",
    )


@pytest.fixture(autouse=True)
def _clear_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_unauthenticated_mood_analysis(client: TestClient):
    res = client.post(
        "/api/v1/ai/mood-analysis",
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code in (401, 403)


def test_date_range_validation(client: TestClient):
    headers = _register_login(client, "ai_j_dates@example.com")
    bad_order = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-11", "end_date": "2026-11-01"},
    )
    assert bad_order.status_code == 422

    bad_format = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "11-01-2026", "end_date": "2026-11-11"},
    )
    assert bad_format.status_code == 422


def test_empty_journal_entries(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_empty@example.com")

    def boom(*args, **kwargs):  # noqa: ARG001
        raise AssertionError("Gemini must not run with empty journal")

    monkeypatch.setattr(gemini_service, "generate_json", boom)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 400
    assert "No journal entries" in res.json()["detail"]


def test_insufficient_journal_data(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_few@example.com")
    _seed_entries(client, headers, ["2026-11-02", "2026-11-03"])

    def boom(*args, **kwargs):  # noqa: ARG001
        raise AssertionError("Gemini must not run with insufficient entries")

    monkeypatch.setattr(gemini_service, "generate_json", boom)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 400
    assert "At least 3" in res.json()["detail"]


def test_authenticated_mood_analysis_and_journal_retrieval(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_ok@example.com")
    dates = ["2026-11-02", "2026-11-04", "2026-11-06"]
    _seed_entries(client, headers, dates)

    captured = {}

    def fake_json(prompt, response_schema, **kwargs):  # noqa: ARG001
        captured["prompt"] = prompt
        assert "2026-11-02" in prompt
        assert "2026-11-04" in prompt
        assert "2026-11-06" in prompt
        assert "mood=" in prompt
        return _fake_analysis()

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["entries_analyzed"] == 3
    assert data["analysis_period"] == {
        "start_date": "2026-11-01",
        "end_date": "2026-11-11",
    }
    assert data["overall_mood"]
    assert data["mood_summary"]
    assert isinstance(data["mood_patterns"]["positive"], list)
    assert isinstance(data["mood_patterns"]["challenging"], list)
    assert isinstance(data["motivation_patterns"], list)
    assert isinstance(data["positive_observations"], list)
    assert isinstance(data["areas_to_improve"], list)
    assert isinstance(data["recommendations"], list)
    assert data["summary"]


def test_user_isolation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers_a = _register_login(client, "ai_j_a@example.com")
    headers_b = _register_login(client, "ai_j_b@example.com")
    _seed_entries(
        client,
        headers_a,
        ["2026-11-02", "2026-11-03", "2026-11-04"],
    )
    # Rename A's content uniqueness via an extra distinctive entry title/content
    client.post(
        "/api/v1/journal",
        headers=headers_a,
        json={
            "date": "2026-11-05",
            "title": "SecretAOnly",
            "content": "SecretPhraseForUserA-xyz",
            "mood": "happy",
            "tags": ["Reflection"],
        },
    )
    _seed_entries(
        client,
        headers_b,
        ["2026-11-02", "2026-11-03", "2026-11-04"],
    )

    captured = {}

    def fake_json(prompt, response_schema, **kwargs):  # noqa: ARG001
        captured["prompt"] = prompt
        return _fake_analysis()

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers_b,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 200
    assert "SecretPhraseForUserA-xyz" not in captured["prompt"]
    assert "SecretAOnly" not in captured["prompt"]


def test_invalid_gemini_response(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_bad@example.com")
    _seed_entries(
        client, headers, ["2026-11-01", "2026-11-02", "2026-11-03"]
    )

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiInvalidResponseError("bad json")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 502


def test_gemini_timeout(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_to@example.com")
    _seed_entries(
        client, headers, ["2026-11-01", "2026-11-02", "2026-11-03"]
    )

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiAPIError(
            "Gemini request timed out. Please try again in a moment."
        )

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 504


def test_gemini_api_failure(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_fail@example.com")
    _seed_entries(
        client, headers, ["2026-11-01", "2026-11-02", "2026-11-03"]
    )

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiAPIError("upstream boom")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 502


def test_missing_api_key(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_nokey@example.com")
    _seed_entries(
        client, headers, ["2026-11-01", "2026-11-02", "2026-11-03"]
    )

    def boom(*args, **kwargs):  # noqa: ARG001
        raise AssertionError("Gemini should not be called without a key")

    monkeypatch.setattr(gemini_service, "generate_json", boom)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 503


def test_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    headers = _register_login(client, "ai_j_rl@example.com")
    _seed_entries(
        client, headers, ["2026-11-01", "2026-11-02", "2026-11-03"]
    )

    def fake_json(*args, **kwargs):  # noqa: ARG001
        raise GeminiRateLimitError("quota")

    monkeypatch.setattr(gemini_service, "generate_json", fake_json)
    res = client.post(
        "/api/v1/ai/mood-analysis",
        headers=headers,
        json={"start_date": "2026-11-01", "end_date": "2026-11-11"},
    )
    assert res.status_code == 429
