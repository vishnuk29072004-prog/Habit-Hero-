"""Reusable Google Gemini client (backend-only; never expose API keys)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.core.config import Settings, get_settings, settings

logger = logging.getLogger(__name__)

CONNECTION_PROBE_PROMPT = (
    "Reply with exactly: Habit Hero AI connection successful."
)
EXPECTED_CONNECTION_PHRASE = "Habit Hero AI connection successful"


class GeminiNotConfiguredError(Exception):
    """Raised when GEMINI_API_KEY is missing or blank."""


class GeminiAPIError(Exception):
    """Upstream Gemini failure (non-rate-limit)."""


class GeminiRateLimitError(GeminiAPIError):
    """Gemini rate limit / quota exhausted."""


class GeminiInvalidResponseError(GeminiAPIError):
    """Empty or unusable model response."""


def _redact(message: str) -> str:
    """Strip accidental key-like substrings from error messages."""
    key = (settings.gemini_api_key or "").strip()
    text = str(message or "")
    if key and key in text:
        text = text.replace(key, "[REDACTED]")
    return text


def is_configured(app_settings: Optional[Settings] = None) -> bool:
    cfg = app_settings or get_settings()
    return bool((cfg.gemini_api_key or "").strip())


def get_model_name(app_settings: Optional[Settings] = None) -> str:
    cfg = app_settings or get_settings()
    return cfg.gemini_model


def create_client(app_settings: Optional[Settings] = None):
    """Build a google-genai Client. Does not log the API key."""
    cfg = app_settings or get_settings()
    if not (cfg.gemini_api_key or "").strip():
        raise GeminiNotConfiguredError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend environment."
        )
    try:
        from google import genai
    except ImportError as exc:  # pragma: no cover
        raise GeminiAPIError(
            "google-genai package is not installed on the server."
        ) from exc

    http_options: dict[str, Any] = {}
    timeout_ms = int(float(cfg.gemini_timeout_seconds) * 1000)
    if timeout_ms > 0:
        # Supported by recent google-genai clients; ignored safely if rejected.
        http_options["timeout"] = timeout_ms

    try:
        if http_options:
            return genai.Client(
                api_key=cfg.gemini_api_key,
                http_options=http_options,
            )
        return genai.Client(api_key=cfg.gemini_api_key)
    except TypeError:
        # Older SDK builds may not accept http_options.
        return genai.Client(api_key=cfg.gemini_api_key)
    except Exception as exc:  # pragma: no cover
        raise GeminiAPIError(
            f"Unable to initialize Gemini client: {_redact(str(exc))}"
        ) from exc


def _classify_upstream_error(exc: Exception) -> GeminiAPIError:
    text = _redact(str(exc))
    lowered = text.lower()
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status in (429, "429") or "resource_exhausted" in lowered or "rate limit" in lowered or "quota" in lowered:
        return GeminiRateLimitError(
            "Gemini rate limit or quota exceeded. Try again later."
        )
    if (
        status in (504, "504", 408, "408")
        or "deadline" in lowered
        or "timeout" in lowered
        or "timed out" in lowered
    ):
        return GeminiAPIError(
            "Gemini request timed out. Please try again in a moment."
        )
    return GeminiAPIError(f"Gemini request failed: {text}")


def generate_json(
    prompt: str,
    *,
    response_schema: Any,
    model: Optional[str] = None,
    app_settings: Optional[Settings] = None,
    client: Any = None,
) -> Any:
    """
    Generate structured JSON via Gemini.

    Prefer ``response.parsed`` when the SDK provides it; otherwise parse
    ``response.text`` and validate with ``response_schema`` (Pydantic model).
    Inject ``client`` in tests to avoid real API calls.
    """
    import json

    cfg = app_settings or get_settings()
    if not (cfg.gemini_api_key or "").strip() and client is None:
        raise GeminiNotConfiguredError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend environment."
        )

    cleaned_prompt = (prompt or "").strip()
    if not cleaned_prompt:
        raise GeminiInvalidResponseError("Prompt must not be empty.")

    active_client = client or create_client(cfg)
    model_name = (model or cfg.gemini_model).strip() or "gemini-3.8-flash"

    try:
        from google.genai import types

        response = active_client.models.generate_content(
            model=model_name,
            contents=cleaned_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
            ),
        )
    except TypeError:
        # Mock clients / older SDK shapes may only accept model+contents.
        try:
            response = active_client.models.generate_content(
                model=model_name,
                contents=cleaned_prompt,
            )
        except Exception as exc:
            logger.warning("Gemini generate_json failed: %s", _redact(str(exc)))
            raise _classify_upstream_error(exc) from exc
    except GeminiAPIError:
        raise
    except Exception as exc:
        logger.warning("Gemini generate_json failed: %s", _redact(str(exc)))
        raise _classify_upstream_error(exc) from exc

    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if isinstance(parsed, response_schema):
            return parsed
        try:
            return response_schema.model_validate(parsed)
        except Exception:
            try:
                return response_schema.model_validate(
                    parsed.model_dump() if hasattr(parsed, "model_dump") else parsed
                )
            except Exception as exc:
                raise GeminiInvalidResponseError(
                    "Gemini returned JSON that failed schema validation."
                ) from exc

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise GeminiInvalidResponseError("Gemini returned an empty JSON response.")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiInvalidResponseError(
            "Gemini returned invalid JSON."
        ) from exc
    try:
        return response_schema.model_validate(payload)
    except Exception as exc:
        raise GeminiInvalidResponseError(
            "Gemini returned JSON that failed schema validation."
        ) from exc


def generate_text(
    prompt: str,
    *,
    model: Optional[str] = None,
    app_settings: Optional[Settings] = None,
    client: Any = None,
) -> str:
    """
    Generate plain text from Gemini.

    Pass an injected ``client`` in tests to avoid real API calls.
    """
    cfg = app_settings or get_settings()
    if not (cfg.gemini_api_key or "").strip() and client is None:
        raise GeminiNotConfiguredError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend environment."
        )

    cleaned_prompt = (prompt or "").strip()
    if not cleaned_prompt:
        raise GeminiInvalidResponseError("Prompt must not be empty.")

    active_client = client or create_client(cfg)
    model_name = (model or cfg.gemini_model).strip() or "gemini-3.8-flash"

    try:
        response = active_client.models.generate_content(
            model=model_name,
            contents=cleaned_prompt,
        )
    except GeminiAPIError:
        raise
    except Exception as exc:
        logger.warning("Gemini generate_content failed: %s", _redact(str(exc)))
        raise _classify_upstream_error(exc) from exc

    text = getattr(response, "text", None)
    if text is None and hasattr(response, "candidates"):
        # Fallback for unusual SDK shapes in tests/mocks.
        text = str(response) if response else ""
    cleaned = (text or "").strip()
    if not cleaned:
        raise GeminiInvalidResponseError("Gemini returned an empty response.")
    return cleaned


def verify_connection(
    *,
    app_settings: Optional[Settings] = None,
    client: Any = None,
) -> dict[str, Any]:
    """
    Lightweight connection probe. Returns a safe summary (no secrets).

    Expects the model to include the fixed success phrase.
    """
    cfg = app_settings or get_settings()
    reply = generate_text(
        CONNECTION_PROBE_PROMPT,
        app_settings=cfg,
        client=client,
    )
    ok = EXPECTED_CONNECTION_PHRASE.lower() in reply.lower()
    return {
        "success": ok,
        "model": cfg.gemini_model,
        "configured": True,
        "message": (
            "Habit Hero AI connection successful."
            if ok
            else "Gemini responded but the expected confirmation phrase was missing."
        ),
        # Never echo full model output in production logs via this helper's caller.
        "matched_expected_phrase": ok,
    }
