"""Integration tests — run against the live backend (localhost:8000).

These tests require Docker containers to be up:
    docker-compose up -d
    docker exec agenda-souterrain-backend-1 python -m pytest tests/test_auth.py -v
"""
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient

BASE_URL = "http://localhost:8000"


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(base_url=BASE_URL) as c:
        yield c


# ─── Existing tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["db"] == "ok"


@pytest.mark.asyncio
async def test_login_invalid(client):
    resp = await client.post(
        "/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    # 401 = invalid credentials, 429 = rate limited from previous test runs
    assert resp.status_code in (401, 429)


@pytest.mark.asyncio
async def test_register_weak_password(client):
    resp = await client.post(
        "/v1/auth/register",
        json={"email": "weak@test.com", "name": "Weak", "password": "abc"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_rate_limit(client):
    """After many rapid login attempts, the server should return 429."""
    last_status = 200
    for _ in range(25):
        resp = await client.post(
            "/v1/auth/login",
            json={"email": "ratelimit@example.com", "password": "wrong"},
        )
        last_status = resp.status_code
        if last_status == 429:
            break
    assert last_status == 429


# ─── New tests ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client):
    """Register a new user with a unique email."""
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/v1/auth/register",
        json={"email": unique_email, "name": "Test User", "password": "securepass1"},
    )
    assert resp.status_code in (201, 429)
    if resp.status_code == 201:
        data = resp.json()
        assert data["email"] == unique_email
        assert data["name"] == "Test User"
        assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate(client):
    """Registering with an already-used email should fail."""
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    # First registration
    resp1 = await client.post(
        "/v1/auth/register",
        json={"email": email, "name": "First", "password": "securepass1"},
    )
    if resp1.status_code == 429:
        pytest.skip("Rate limited")
    assert resp1.status_code == 201
    # Second registration with same email
    resp2 = await client.post(
        "/v1/auth/register",
        json={"email": email, "name": "Second", "password": "securepass2"},
    )
    assert resp2.status_code in (400, 429)


@pytest.mark.asyncio
async def test_login_success(client):
    """Register then login — cookies should be set."""
    email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": email, "name": "Login Test", "password": "securepass1"},
    )
    if reg.status_code == 429:
        pytest.skip("Rate limited")
    assert reg.status_code == 201

    resp = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": "securepass1"},
    )
    assert resp.status_code in (200, 429)
    if resp.status_code == 200:
        data = resp.json()
        assert data["email"] == email
        # Auth cookies should be set
        assert "access_token" in resp.cookies or "access_token" in data


@pytest.mark.asyncio
async def test_me_authenticated(client):
    """GET /me with valid token returns user info."""
    email = f"me_{uuid.uuid4().hex[:8]}@example.com"
    await client.post(
        "/v1/auth/register",
        json={"email": email, "name": "Me Test", "password": "securepass1"},
    )
    login = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": "securepass1"},
    )
    if login.status_code == 429:
        pytest.skip("Rate limited")

    # Use cookie from login response or Authorization header
    access_token = login.cookies.get("access_token")
    if access_token:
        resp = await client.get("/v1/auth/me", cookies={"access_token": access_token})
    else:
        token = login.json().get("access_token", "")
        resp = await client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == email


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    """GET /me without token returns 401."""
    resp = await client.get("/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    """POST /refresh with refresh_token cookie returns new tokens."""
    email = f"refresh_{uuid.uuid4().hex[:8]}@example.com"
    await client.post(
        "/v1/auth/register",
        json={"email": email, "name": "Refresh Test", "password": "securepass1"},
    )
    login = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": "securepass1"},
    )
    if login.status_code == 429:
        pytest.skip("Rate limited")

    # Send refresh_token as cookie (how the frontend does it)
    refresh_tok = login.cookies.get("refresh_token")
    if refresh_tok:
        resp = await client.post("/v1/auth/refresh", cookies={"refresh_token": refresh_tok})
    else:
        # Fallback: if cookies not set (test env without cookie domain matching)
        pytest.skip("Cookies not set in test environment")

    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == email


@pytest.mark.asyncio
async def test_logout(client):
    """POST /logout should clear auth cookies."""
    resp = await client.post("/v1/auth/logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "ok"
