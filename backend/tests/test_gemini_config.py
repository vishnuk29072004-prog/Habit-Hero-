"""Stage B – Gemini configuration tests (mocked; no real API quota)."""

from __future__ import annotations

import pytest

from app.core.config import Settings, get_settings
from app.services import gemini_service
from app.services.gemini_service import (
    EXPECTED_CONNECTION_PHRASE,
    GeminiAPIError,
    GeminiInvalidResponseError,
    GeminiNotConfiguredError,
    GeminiRateLimitError,
    GeminiUnavailableError,
)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_missing_api_key_is_not_configured(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    get_settings.cache_clear()
    cfg = Settings()
    assert cfg.gemini_configured is False
    assert gemini_service.is_configured(cfg) is False


def test_valid_configuration_reads_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    get_settings.cache_clear()
    cfg = Settings()
    assert cfg.gemini_configured is True
    assert cfg.gemini_api_key == "test-key-not-real"
    assert cfg.gemini_model == "gemini-3.8-flash"
    assert gemini_service.get_model_name(cfg) == "gemini-3.8-flash"


def test_create_client_requires_api_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    cfg = Settings()
    with pytest.raises(GeminiNotConfiguredError):
        gemini_service.create_client(cfg)


def test_create_client_initializes_with_key(monkeypatch):
    import sys
    import types

    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    get_settings.cache_clear()
    cfg = Settings()

    class FakeClient:
        def __init__(self, api_key=None, http_options=None, **kwargs):
            self.api_key = api_key
            self.http_options = http_options
            self.kwargs = kwargs

    fake_genai = types.ModuleType("google.genai")
    fake_genai.Client = FakeClient
    fake_google = types.ModuleType("google")
    fake_google.genai = fake_genai
    monkeypatch.setitem(sys.modules, "google", fake_google)
    monkeypatch.setitem(sys.modules, "google.genai", fake_genai)

    client = gemini_service.create_client(cfg)
    assert isinstance(client, FakeClient)
    assert client.api_key == "test-key-not-real"


def test_generate_text_successful_mocked_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    cfg = Settings()

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            class Resp:
                text = "Habit Hero AI connection successful."

            return Resp()

    class FakeClient:
        models = FakeModels()

    text = gemini_service.generate_text(
        "ping",
        app_settings=cfg,
        client=FakeClient(),
    )
    assert EXPECTED_CONNECTION_PHRASE in text


def test_generate_text_api_failure(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    cfg = Settings()

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            raise RuntimeError("upstream boom")

    class FakeClient:
        models = FakeModels()

    with pytest.raises(GeminiAPIError):
        gemini_service.generate_text("ping", app_settings=cfg, client=FakeClient())


def test_generate_text_rate_limit(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    cfg = Settings()
    monkeypatch.setattr(gemini_service.time, "sleep", lambda _s: None)

    class RateLimitError(Exception):
        status_code = 429

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            raise RateLimitError("RESOURCE_EXHAUSTED")

    class FakeClient:
        models = FakeModels()

    with pytest.raises(GeminiRateLimitError):
        gemini_service.generate_text("ping", app_settings=cfg, client=FakeClient())


def test_generate_text_retries_transient_then_succeeds(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    cfg = Settings()
    monkeypatch.setattr(gemini_service.time, "sleep", lambda _s: None)
    calls = {"n": 0}

    class Transient(Exception):
        status_code = 429

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            calls["n"] += 1
            if calls["n"] < 2:
                raise Transient("RESOURCE_EXHAUSTED")

            class Resp:
                text = "ok after retry"

            return Resp()

    class FakeClient:
        models = FakeModels()

    text = gemini_service.generate_text(
        "ping", app_settings=cfg, client=FakeClient()
    )
    assert text == "ok after retry"
    assert calls["n"] == 2


def test_classify_daily_quota_no_transient_message():
    err = gemini_service._classify_upstream_error(
        Exception("429 exceeded your current quota for this project")
    )
    assert isinstance(err, GeminiRateLimitError)
    assert "quota is exhausted" in str(err).lower()


def test_generate_text_invalid_empty_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    get_settings.cache_clear()
    cfg = Settings()

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            class Resp:
                text = "   "

            return Resp()

    class FakeClient:
        models = FakeModels()

    with pytest.raises(GeminiInvalidResponseError):
        gemini_service.generate_text("ping", app_settings=cfg, client=FakeClient())


def test_verify_connection_mocked_success(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    get_settings.cache_clear()
    cfg = Settings()

    class FakeModels:
        def generate_content(self, model, contents):  # noqa: ARG002
            class Resp:
                text = "Habit Hero AI connection successful."

            return Resp()

    class FakeClient:
        models = FakeModels()

    result = gemini_service.verify_connection(app_settings=cfg, client=FakeClient())
    assert result["success"] is True
    assert result["configured"] is True
    assert result["model"] == "gemini-3.8-flash"
    assert "successful" in result["message"].lower()


def test_missing_key_on_generate(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    cfg = Settings()
    with pytest.raises(GeminiNotConfiguredError):
        gemini_service.generate_text("ping", app_settings=cfg)


def test_classify_deadline_exceeded():
    err = gemini_service._classify_upstream_error(
        Exception("504 DEADLINE_EXCEEDED. Deadline expired before operation could complete.")
    )
    assert isinstance(err, GeminiAPIError)
    assert "timed out" in str(err).lower()


def test_classify_high_demand_unavailable():
    err = gemini_service._classify_upstream_error(
        Exception(
            "503 UNAVAILABLE. This model is currently experiencing high demand."
        )
    )
    assert isinstance(err, GeminiUnavailableError)
    assert "overloaded" in str(err).lower()
