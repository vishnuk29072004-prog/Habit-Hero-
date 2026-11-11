"""Stage G – Google Calendar OAuth + sync (Google HTTP mocked)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.services import google_calendar_service, token_crypto


FERNET_KEY = Fernet.generate_key().decode()


@pytest.fixture(autouse=True)
def _google_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://127.0.0.1:8000/api/v1/calendar/google/callback",
    )
    monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", FERNET_KEY)
    monkeypatch.setenv("FRONTEND_APP_URL", "http://127.0.0.1:5173")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _auth(client: TestClient, email: str):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "GCal User", "email": email, "password": "SecurePassword123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePassword123!"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class FakeHttp:
    def __init__(self):
        self.calls = []
        self.post_handler = None
        self.get_handler = None
        self.patch_handler = None
        self.delete_handler = None

    def post(self, url, data=None, json=None, headers=None):
        self.calls.append(("POST", url, data, json))
        if self.post_handler:
            return self.post_handler(url, data=data, json=json, headers=headers)
        return FakeResponse(200, {})

    def get(self, url, headers=None):
        self.calls.append(("GET", url, None, None))
        if self.get_handler:
            return self.get_handler(url, headers=headers)
        return FakeResponse(200, {})

    def patch(self, url, json=None, headers=None):
        self.calls.append(("PATCH", url, None, json))
        if self.patch_handler:
            return self.patch_handler(url, json=json, headers=headers)
        return FakeResponse(200, {})

    def delete(self, url, headers=None):
        self.calls.append(("DELETE", url, None, None))
        if self.delete_handler:
            return self.delete_handler(url, headers=headers)
        return FakeResponse(204, {})

    def close(self):
        return None


def test_status_unauthenticated(client: TestClient):
    assert client.get("/api/v1/calendar/google/status").status_code in (401, 403)


def test_missing_credentials(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    get_settings.cache_clear()
    headers = _auth(client, "gcal_nocred@example.com")
    res = client.get("/api/v1/calendar/google/connect", headers=headers)
    assert res.status_code == 503


def test_connect_returns_authorization_url(client: TestClient):
    headers = _auth(client, "gcal_connect@example.com")
    res = client.get("/api/v1/calendar/google/connect", headers=headers)
    assert res.status_code == 200
    url = res.json()["data"]["authorization_url"]
    assert "accounts.google.com" in url
    assert "client_id=test-client-id" in url
    assert "state=" in url


def test_invalid_oauth_state(client: TestClient):
    res = client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "x", "state": "not-valid"},
    )
    assert res.status_code == 400


def test_oauth_state_roundtrip_and_callback(client: TestClient, monkeypatch):
    headers = _auth(client, "gcal_cb@example.com")
    connect = client.get("/api/v1/calendar/google/connect", headers=headers)
    # Extract state from URL
    from urllib.parse import parse_qs, urlparse

    qs = parse_qs(urlparse(connect.json()["data"]["authorization_url"]).query)
    state = qs["state"][0]

    http = FakeHttp()

    def post_handler(url, data=None, json=None, headers=None):
        assert "oauth2.googleapis.com/token" in url
        return FakeResponse(
            200,
            {
                "access_token": "access-1",
                "refresh_token": "refresh-1",
                "expires_in": 3600,
                "scope": " ".join(google_calendar_service.SCOPES),
            },
        )

    def get_handler(url, headers=None):
        return FakeResponse(200, {"email": "user@gmail.com", "id": "gid-1"})

    http.post_handler = post_handler
    http.get_handler = get_handler

    # Use service directly with fake client (endpoint uses real httpx)
    from app.db.session import SessionLocal
    # Prefer TestClient DB via exchange through monkeypatch of httpx.Client
    class ClientFactory:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return http

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            return http.post(*a, **k)

        def get(self, *a, **k):
            return http.get(*a, **k)

        def close(self):
            return None

    monkeypatch.setattr(google_calendar_service.httpx, "Client", lambda *a, **k: ClientFactory())

    res = client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    assert "google=connected" in res.headers.get("location", "")

    status = client.get("/api/v1/calendar/google/status", headers=headers)
    assert status.status_code == 200
    data = status.json()["data"]
    assert data["connected"] is True
    assert data["email"] == "user@gmail.com"
    # Tokens must not appear in status payload
    blob = str(status.json())
    assert "access-1" not in blob
    assert "refresh-1" not in blob


def test_token_encryption_roundtrip():
    get_settings.cache_clear()
    cipher = token_crypto.encrypt_token("plain-token")
    assert cipher != "plain-token"
    assert token_crypto.decrypt_token(cipher) == "plain-token"


def test_sync_creates_and_is_idempotent(client: TestClient, monkeypatch):
    headers = _auth(client, "gcal_sync@example.com")
    # Seed connection via service helpers
    connect = client.get("/api/v1/calendar/google/connect", headers=headers)
    from urllib.parse import parse_qs, urlparse

    state = parse_qs(urlparse(connect.json()["data"]["authorization_url"]).query)[
        "state"
    ][0]

    created_ids = {"n": 0}

    class ClientFactory:
        def __init__(self, *a, **k):
            self.http = FakeHttp()

            def post_handler(url, data=None, json=None, headers=None):
                if "oauth2.googleapis.com/token" in url:
                    return FakeResponse(
                        200,
                        {
                            "access_token": "access-sync",
                            "refresh_token": "refresh-sync",
                            "expires_in": 3600,
                        },
                    )
                if "/events" in url and data is None:
                    created_ids["n"] += 1
                    return FakeResponse(200, {"id": f"evt-{created_ids['n']}"})
                return FakeResponse(200, {})

            def patch_handler(url, json=None, headers=None):
                return FakeResponse(200, {"id": "evt-1"})

            def get_handler(url, headers=None):
                return FakeResponse(200, {"email": "sync@gmail.com", "id": "g2"})

            self.http.post_handler = post_handler
            self.http.patch_handler = patch_handler
            self.http.get_handler = get_handler

        def post(self, *a, **k):
            return self.http.post(*a, **k)

        def get(self, *a, **k):
            return self.http.get(*a, **k)

        def patch(self, *a, **k):
            return self.http.patch(*a, **k)

        def delete(self, *a, **k):
            return self.http.delete(*a, **k)

        def close(self):
            return None

    monkeypatch.setattr(
        google_calendar_service.httpx, "Client", lambda *a, **k: ClientFactory()
    )

    cb = client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "c", "state": state},
        follow_redirects=False,
    )
    assert cb.status_code in (302, 307)

    client.post(
        "/api/v1/habits",
        headers=headers,
        json={
            "name": "Daily Walk",
            "category": "Health",
            "frequency": "Daily",
            "start_date": "2026-11-01",
        },
    )
    client.post(
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

    sync1 = client.post("/api/v1/calendar/google/sync", headers=headers)
    assert sync1.status_code == 200
    assert sync1.json()["data"]["created"] == 2

    sync2 = client.post("/api/v1/calendar/google/sync", headers=headers)
    assert sync2.status_code == 200
    # Second sync updates existing mappings (no duplicate creates)
    assert sync2.json()["data"]["created"] == 0
    assert sync2.json()["data"]["updated"] == 2

    events = client.get("/api/v1/calendar/google/events", headers=headers)
    assert events.status_code == 200
    assert events.json()["data"]["total"] == 2


def test_user_isolation_status(client: TestClient, monkeypatch):
    headers_a = _auth(client, "gcal_a@example.com")
    headers_b = _auth(client, "gcal_b@example.com")
    # A connects
    connect = client.get("/api/v1/calendar/google/connect", headers=headers_a)
    from urllib.parse import parse_qs, urlparse

    state = parse_qs(urlparse(connect.json()["data"]["authorization_url"]).query)[
        "state"
    ][0]

    class ClientFactory:
        def __init__(self, *a, **k):
            pass

        def post(self, url, data=None, json=None, headers=None):
            return FakeResponse(
                200,
                {
                    "access_token": "a-token",
                    "refresh_token": "a-refresh",
                    "expires_in": 3600,
                },
            )

        def get(self, url, headers=None):
            return FakeResponse(200, {"email": "a@gmail.com", "id": "a"})

        def close(self):
            return None

    monkeypatch.setattr(
        google_calendar_service.httpx, "Client", lambda *a, **k: ClientFactory()
    )
    client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "x", "state": state},
        follow_redirects=False,
    )

    status_b = client.get("/api/v1/calendar/google/status", headers=headers_b)
    assert status_b.json()["data"]["connected"] is False


def test_disconnect(client: TestClient, monkeypatch):
    headers = _auth(client, "gcal_disc@example.com")
    connect = client.get("/api/v1/calendar/google/connect", headers=headers)
    from urllib.parse import parse_qs, urlparse

    state = parse_qs(urlparse(connect.json()["data"]["authorization_url"]).query)[
        "state"
    ][0]

    class ClientFactory:
        def __init__(self, *a, **k):
            pass

        def post(self, *a, **k):
            return FakeResponse(
                200,
                {
                    "access_token": "t",
                    "refresh_token": "r",
                    "expires_in": 3600,
                },
            )

        def get(self, *a, **k):
            return FakeResponse(200, {"email": "d@gmail.com", "id": "d"})

        def delete(self, *a, **k):
            return FakeResponse(204, {})

        def close(self):
            return None

    monkeypatch.setattr(
        google_calendar_service.httpx, "Client", lambda *a, **k: ClientFactory()
    )
    client.get(
        "/api/v1/calendar/google/callback",
        params={"code": "c", "state": state},
        follow_redirects=False,
    )
    disc = client.post("/api/v1/calendar/google/disconnect", headers=headers)
    assert disc.status_code == 200
    status = client.get("/api/v1/calendar/google/status", headers=headers)
    assert status.json()["data"]["connected"] is False
