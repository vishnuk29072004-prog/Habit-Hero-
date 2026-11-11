"""
Optional live Gemini connection probe (Stage B).

Usage (from backend/ with venv active):
  $env:PYTHONPATH = (Get-Location).Path
  python scripts/verify_gemini_connection.py

Requires GEMINI_API_KEY in backend/.env or the environment.
Does not print the API key. Skips cleanly when the key is missing.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
from app.services import gemini_service
from app.services.gemini_service import (
    GeminiAPIError,
    GeminiNotConfiguredError,
)


def main() -> int:
    get_settings.cache_clear()
    cfg = get_settings()

    if not gemini_service.is_configured(cfg):
        print("SKIP  GEMINI_API_KEY is not set. Add it to backend/.env to run a live probe.")
        print(f"INFO  Configured model would be: {cfg.gemini_model}")
        return 0

    print(f"INFO  Probing Gemini model: {cfg.gemini_model}")
    try:
        result = gemini_service.verify_connection(app_settings=cfg)
    except GeminiNotConfiguredError as exc:
        print(f"FAIL  {exc}")
        return 1
    except GeminiAPIError as exc:
        print(f"FAIL  {exc}")
        return 1
    except Exception as exc:  # pragma: no cover
        print(f"FAIL  Unexpected error: {type(exc).__name__}")
        return 1

    if result.get("success"):
        print(f"PASS  {result.get('message')}")
        print(f"INFO  Model: {result.get('model')}")
        return 0

    print(f"FAIL  {result.get('message')}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
