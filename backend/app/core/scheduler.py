"""Optional in-process notification scheduler (stdlib asyncio only)."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_task: Optional[asyncio.Task] = None
_stop: Optional[asyncio.Event] = None


async def _run_loop() -> None:
    assert _stop is not None
    interval = max(30, int(settings.notifications_scheduler_interval_seconds))
    logger.info(
        "Notification scheduler started (interval=%ss)", interval
    )
    while not _stop.is_set():
        try:
            await asyncio.to_thread(_generate_all_safe)
        except Exception:  # noqa: BLE001 — keep loop alive
            logger.exception("Notification scheduler tick failed")
        try:
            await asyncio.wait_for(_stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue
    logger.info("Notification scheduler stopped")


def _generate_all_safe() -> None:
    from app.db.session import SessionLocal
    from app.services import notification_generator

    db = SessionLocal()
    try:
        result = notification_generator.generate_for_all_users(db)
        logger.debug(
            "Scheduler generated notifications: %s", result
        )
    finally:
        db.close()


def start_scheduler() -> None:
    """Start background loop if enabled. Safe to call once at app startup."""
    global _task, _stop
    if not settings.notifications_scheduler_enabled:
        logger.info("Notification scheduler disabled")
        return
    if _task is not None and not _task.done():
        return
    _stop = asyncio.Event()
    _task = asyncio.create_task(_run_loop(), name="notification-scheduler")


async def stop_scheduler() -> None:
    """Signal stop and await task completion (app shutdown)."""
    global _task, _stop
    if _stop is not None:
        _stop.set()
    if _task is not None:
        try:
            await asyncio.wait_for(_task, timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            _task.cancel()
            try:
                await _task
            except asyncio.CancelledError:
                pass
    _task = None
    _stop = None
