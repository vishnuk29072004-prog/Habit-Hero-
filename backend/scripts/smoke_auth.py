"""Live smoke test against a running server (localhost:8000)."""

from __future__ import annotations

import uuid

import httpx

BASE = "http://127.0.0.1:8000/api/v1"
email = f"smoke_{uuid.uuid4().hex[:8]}@example.com"
password = "SecurePassword123!"


def main() -> None:
    with httpx.Client(timeout=10.0) as client:
        openapi = client.get("http://127.0.0.1:8000/openapi.json")
        openapi.raise_for_status()
        paths = openapi.json()["paths"]
        auth_paths = sorted(p for p in paths if p.startswith("/api/v1/auth"))
        print("openapi_auth_paths=", auth_paths)

        reg = client.post(
            f"{BASE}/auth/register",
            json={"full_name": "Smoke Tester", "email": email, "password": password},
        )
        print("register", reg.status_code, reg.json())
        assert reg.status_code == 201

        login = client.post(
            f"{BASE}/auth/login",
            json={"email": email, "password": password},
        )
        print("login", login.status_code)
        assert login.status_code == 200
        data = login.json()["data"]

        me = client.get(
            f"{BASE}/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        print("me", me.status_code, me.json())
        assert me.status_code == 200

        refresh = client.post(
            f"{BASE}/auth/refresh",
            json={"refresh_token": data["refresh_token"]},
        )
        print("refresh", refresh.status_code)
        assert refresh.status_code == 200
        new_refresh = refresh.json()["data"]["refresh_token"]

        logout = client.post(
            f"{BASE}/auth/logout",
            json={"refresh_token": new_refresh},
        )
        print("logout", logout.status_code, logout.json())
        assert logout.status_code == 200
        print("smoke_ok=True")


if __name__ == "__main__":
    main()
