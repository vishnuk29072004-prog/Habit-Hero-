"""Stage F – PDF progress export."""

from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader


def _register_login(client: TestClient, email: str, password: str = "SecurePassword123!"):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "PDF User", "email": email, "password": password},
    )
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _pdf_url(start: str = "2026-11-01", end: str = "2026-11-30") -> str:
    return f"/api/v1/reports/progress/pdf?start_date={start}&end_date={end}"


def _assert_valid_pdf(content: bytes, *, must_contain: list[str] | None = None):
    assert content[:4] == b"%PDF"
    reader = PdfReader(BytesIO(content))
    assert len(reader.pages) >= 1
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    if must_contain:
        for needle in must_contain:
            assert needle in text, f"missing {needle!r} in PDF text"
    return text


def test_unauthenticated_pdf_rejected(client: TestClient):
    res = client.get(_pdf_url())
    assert res.status_code in (401, 403)


def test_invalid_jwt_rejected(client: TestClient):
    res = client.get(
        _pdf_url(), headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert res.status_code in (401, 403)


def test_invalid_date_format(client: TestClient):
    headers = _register_login(client, "pdf_bad_date@example.com")
    res = client.get(
        "/api/v1/reports/progress/pdf?start_date=11-01-2026&end_date=2026-11-30",
        headers=headers,
    )
    assert res.status_code == 422


def test_end_before_start(client: TestClient):
    headers = _register_login(client, "pdf_range@example.com")
    res = client.get(
        _pdf_url("2026-11-30", "2026-11-01"),
        headers=headers,
    )
    assert res.status_code == 422


def test_authenticated_empty_user_pdf(client: TestClient):
    headers = _register_login(client, "pdf_empty@example.com")
    res = client.get(_pdf_url(), headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/pdf")
    assert "attachment" in res.headers.get("content-disposition", "").lower()
    assert "HabitHero_Progress_Report_2026-11-01_to_2026-11-30.pdf" in res.headers.get(
        "content-disposition", ""
    )
    text = _assert_valid_pdf(
        res.content,
        must_contain=[
            "HABIT HERO",
            "PERSONAL PROGRESS REPORT",
            "2026-11-01",
            "2026-11-30",
            "PDF User",
        ],
    )
    assert "pdf_empty@example.com" in text


def test_user_isolation(client: TestClient):
    headers_a = _register_login(client, "pdf_iso_a@example.com")
    headers_b = _register_login(client, "pdf_iso_b@example.com")
    client.post(
        "/api/v1/habits",
        headers=headers_a,
        json={
            "name": "SecretHabitAlpha",
            "category": "Health",
            "frequency": "Daily",
            "start_date": "2026-11-01",
        },
    )
    res = client.get(_pdf_url(), headers=headers_b)
    assert res.status_code == 200
    text = _assert_valid_pdf(res.content)
    assert "SecretHabitAlpha" not in text
    assert "pdf_iso_a@example.com" not in text


def test_multiple_habits_daily_weekly_and_archived(client: TestClient):
    headers = _register_login(client, "pdf_habits@example.com")
    daily = client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Morning Stretch",
            "category": "Health",
            "frequency": "Daily",
            "start_date": "2026-11-01",
        },
    )
    assert daily.status_code == 201
    weekly = client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Weekly Review",
            "category": "Productivity",
            "frequency": "Weekly",
            "week_day": 1,
            "start_date": "2026-11-01",
        },
    )
    assert weekly.status_code == 201
    archived = client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Archived Quiet Habit",
            "category": "Work",
            "frequency": "Daily",
            "start_date": "2026-11-01",
        },
    )
    assert archived.status_code == 201
    hid = archived.json()["data"]["id"]
    assert (
        client.patch(f"/api/v1/habits/{hid}/archive", headers=headers).status_code
        == 200
    )

    # Check-in daily habit
    client.post(
        f"/api/v1/habits/{daily.json()['data']['id']}/checkins",
        headers=headers,
        json={"date": "2026-11-02", "completed": True},
    )

    res = client.get(_pdf_url("2026-11-01", "2026-11-10"), headers=headers)
    assert res.status_code == 200
    text = _assert_valid_pdf(
        res.content,
        must_contain=["Morning Stretch", "Weekly Review", "2026-11-01", "2026-11-10"],
    )
    assert "Archived Quiet Habit" not in text


def test_no_goals_no_achievements_still_valid(client: TestClient):
    headers = _register_login(client, "pdf_nogga@example.com")
    res = client.get(_pdf_url(), headers=headers)
    assert res.status_code == 200
    text = _assert_valid_pdf(res.content)
    assert "No active goals" in text or "Goal Progress" in text
    assert "No achievements" in text or "Achievements" in text


def test_with_goal_included(client: TestClient):
    headers = _register_login(client, "pdf_goal@example.com")
    client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Read Daily",
            "category": "Learning",
            "frequency": "Daily",
            "start_date": "2026-11-01",
        },
    )
    goal = client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "Read More Books",
            "description": "Finish chapters consistently",
            "category": "Learning",
            "target_type": "days_completed",
            "target_value": 10,
            "start_date": "2026-11-01",
            "end_date": "2026-11-30",
        },
    )
    assert goal.status_code == 201
    res = client.get(_pdf_url(), headers=headers)
    assert res.status_code == 200
    _assert_valid_pdf(res.content, must_contain=["Read More Books"])


def test_pdf_generation_failure_mapped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    headers = _register_login(client, "pdf_fail@example.com")

    def boom(*args, **kwargs):  # noqa: ARG001
        raise RuntimeError("render exploded")

    monkeypatch.setattr(
        "app.services.pdf_report_service._gather_report_data", boom
    )
    res = client.get(_pdf_url(), headers=headers)
    assert res.status_code == 500
    body = res.json()
    assert "Unable to generate" in (body.get("detail") or body.get("message") or "")
