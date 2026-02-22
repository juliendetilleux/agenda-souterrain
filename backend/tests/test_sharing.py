"""Integration tests for sharing endpoints — run against the live backend.

Requires Docker containers to be up:
    docker-compose up -d
    docker exec agenda-souterrain-backend-1 python -m pytest tests/test_sharing.py -v

These tests use the E2E test user created by the frontend global-setup.
"""
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient

BASE_URL = "http://localhost:8000"
TEST_EMAIL = "e2e_playwright@example.com"
TEST_PASSWORD = "playwright123"
TEST_SLUG = "e2e-playwright-cal"


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(base_url=BASE_URL) as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(client):
    """Returns (client, headers, cal_id)."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    if resp.status_code == 429:
        pytest.skip("Rate limited")
    if resp.status_code != 200:
        pytest.skip(f"Login failed ({resp.status_code}): test user may not exist yet")
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cal_resp = await client.get(f"/v1/calendars/slug/{TEST_SLUG}", headers=headers)
    if cal_resp.status_code != 200:
        pytest.skip("Test calendar not found — run E2E global setup first")
    cal_id = cal_resp.json()["id"]

    return client, headers, cal_id


# ─── Access links CRUD ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_link(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/links",
        headers=headers,
        json={"label": "Test Link", "permission": "read_only"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "Test Link"
    assert "token" in data
    assert data["active"] is True
    assert data["permission"] == "read_only"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/links/{data['id']}", headers=headers)


@pytest.mark.asyncio
async def test_list_links(auth_client):
    client, headers, cal_id = auth_client
    # Create a link
    resp = await client.post(
        f"/v1/calendars/{cal_id}/links",
        headers=headers,
        json={"label": "List Test", "permission": "read_only"},
    )
    link_id = resp.json()["id"]

    # List
    resp2 = await client.get(f"/v1/calendars/{cal_id}/links", headers=headers)
    assert resp2.status_code == 200
    links = resp2.json()
    assert any(l["id"] == link_id for l in links)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/links/{link_id}", headers=headers)


@pytest.mark.asyncio
async def test_update_link_disable(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/links",
        headers=headers,
        json={"label": "Disable Test", "permission": "read_only"},
    )
    link_id = resp.json()["id"]

    # Disable
    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/links/{link_id}",
        headers=headers,
        json={"active": False},
    )
    assert resp2.status_code == 200
    assert resp2.json()["active"] is False

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/links/{link_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_link(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/links",
        headers=headers,
        json={"label": "Delete Test", "permission": "read_only"},
    )
    link_id = resp.json()["id"]

    resp2 = await client.delete(f"/v1/calendars/{cal_id}/links/{link_id}", headers=headers)
    assert resp2.status_code == 204

    # Verify gone
    resp3 = await client.get(f"/v1/calendars/{cal_id}/links", headers=headers)
    links = resp3.json()
    assert not any(l["id"] == link_id for l in links)


# ─── User invitations ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_existing_user(auth_client):
    """Invite a user that already has an account → status=added."""
    client, headers, cal_id = auth_client
    # Register a temp user to invite
    temp_email = f"invite_existing_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Temp User", "password": "securepass1"},
    )
    if reg.status_code == 429:
        pytest.skip("Rate limited")
    assert reg.status_code == 201

    resp = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": temp_email, "permission": "read_only"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "added"
    assert data["email"] == temp_email
    assert data["permission"] == "read_only"

    # Cleanup: revoke access
    access_resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    for acc in access_resp.json():
        if acc.get("user_email") == temp_email:
            await client.delete(f"/v1/calendars/{cal_id}/access/{acc['id']}", headers=headers)


@pytest.mark.asyncio
async def test_invite_nonexistent_user(auth_client):
    """Invite a user without an account → status=pending."""
    client, headers, cal_id = auth_client
    fake_email = f"pending_{uuid.uuid4().hex[:8]}@example.com"

    resp = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": fake_email, "permission": "add_only"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["email"] == fake_email
    assert data["permission"] == "add_only"

    # Cleanup: delete pending invitation
    pending_resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    for inv in pending_resp.json():
        if inv["email"] == fake_email:
            await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{inv['id']}", headers=headers)


@pytest.mark.asyncio
async def test_invite_duplicate_existing(auth_client):
    """Inviting the same existing user twice returns 409."""
    client, headers, cal_id = auth_client
    temp_email = f"dup_existing_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Dup Test", "password": "securepass1"},
    )
    if reg.status_code == 429:
        pytest.skip("Rate limited")

    resp1 = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": temp_email, "permission": "read_only"},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": temp_email, "permission": "read_only"},
    )
    assert resp2.status_code == 409

    # Cleanup
    access_resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    for acc in access_resp.json():
        if acc.get("user_email") == temp_email:
            await client.delete(f"/v1/calendars/{cal_id}/access/{acc['id']}", headers=headers)


@pytest.mark.asyncio
async def test_invite_duplicate_pending(auth_client):
    """Inviting the same non-existent email twice returns 409."""
    client, headers, cal_id = auth_client
    fake_email = f"dup_pending_{uuid.uuid4().hex[:8]}@example.com"

    resp1 = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": fake_email, "permission": "read_only"},
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": fake_email, "permission": "modify"},
    )
    assert resp2.status_code == 409

    # Cleanup
    pending_resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    for inv in pending_resp.json():
        if inv["email"] == fake_email:
            await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{inv['id']}", headers=headers)


# ─── Pending invitations ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_pending_invitations(auth_client):
    client, headers, cal_id = auth_client
    fake_email = f"list_pending_{uuid.uuid4().hex[:8]}@example.com"

    # Create a pending invitation
    await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": fake_email, "permission": "read_only"},
    )

    resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    assert resp.status_code == 200
    invitations = resp.json()
    assert any(inv["email"] == fake_email for inv in invitations)

    # Cleanup
    for inv in invitations:
        if inv["email"] == fake_email:
            await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{inv['id']}", headers=headers)


@pytest.mark.asyncio
async def test_delete_pending_invitation(auth_client):
    client, headers, cal_id = auth_client
    fake_email = f"del_pending_{uuid.uuid4().hex[:8]}@example.com"

    await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": fake_email, "permission": "read_only"},
    )

    # Get the invitation ID
    pending_resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    inv_id = None
    for inv in pending_resp.json():
        if inv["email"] == fake_email:
            inv_id = inv["id"]
            break
    assert inv_id is not None

    resp = await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{inv_id}", headers=headers)
    assert resp.status_code == 204

    # Verify gone
    pending_resp2 = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    assert not any(inv["id"] == inv_id for inv in pending_resp2.json())


@pytest.mark.asyncio
async def test_delete_pending_not_found(auth_client):
    client, headers, cal_id = auth_client
    fake_id = str(uuid.uuid4())
    resp = await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{fake_id}", headers=headers)
    assert resp.status_code == 404


# ─── Access management ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_access(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_update_access_permission(auth_client):
    """Invite a user, then update their permission."""
    client, headers, cal_id = auth_client
    temp_email = f"upd_access_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Upd Test", "password": "securepass1"},
    )
    if reg.status_code == 429:
        pytest.skip("Rate limited")

    await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": temp_email, "permission": "read_only"},
    )

    # Find the access entry
    access_resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    access_id = None
    for acc in access_resp.json():
        if acc.get("user_email") == temp_email:
            access_id = acc["id"]
            break
    assert access_id is not None

    # Update to modify
    resp = await client.put(
        f"/v1/calendars/{cal_id}/access/{access_id}",
        headers=headers,
        json={"permission": "modify"},
    )
    assert resp.status_code == 200
    assert resp.json()["permission"] == "modify"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/access/{access_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_access(auth_client):
    """Invite a user, then revoke their access."""
    client, headers, cal_id = auth_client
    temp_email = f"del_access_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Del Test", "password": "securepass1"},
    )
    if reg.status_code == 429:
        pytest.skip("Rate limited")

    await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": temp_email, "permission": "read_only"},
    )

    access_resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    access_id = None
    for acc in access_resp.json():
        if acc.get("user_email") == temp_email:
            access_id = acc["id"]
            break
    assert access_id is not None

    resp = await client.delete(f"/v1/calendars/{cal_id}/access/{access_id}", headers=headers)
    assert resp.status_code == 204


# ─── Groups ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_group(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "Test Group"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Group"
    assert data["calendar_id"] == cal_id

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/groups/{data['id']}", headers=headers)


@pytest.mark.asyncio
async def test_list_groups(auth_client):
    client, headers, cal_id = auth_client
    # Create
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "List Group"},
    )
    group_id = resp.json()["id"]

    # List
    resp2 = await client.get(f"/v1/calendars/{cal_id}/groups", headers=headers)
    assert resp2.status_code == 200
    groups = resp2.json()
    assert any(g["id"] == group_id for g in groups)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_group(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "Delete Group"},
    )
    group_id = resp.json()["id"]

    resp2 = await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)
    assert resp2.status_code == 204

    # Verify gone
    resp3 = await client.get(f"/v1/calendars/{cal_id}/groups", headers=headers)
    assert not any(g["id"] == group_id for g in resp3.json())


@pytest.mark.asyncio
async def test_add_group_member(auth_client):
    """Create a group, add the test user as member, then verify."""
    client, headers, cal_id = auth_client
    # Create group
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "Member Group"},
    )
    group_id = resp.json()["id"]

    # Register a temp user to add
    temp_email = f"grp_member_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Group Member", "password": "securepass1"},
    )
    if reg.status_code == 429:
        await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)
        pytest.skip("Rate limited")
    user_id = reg.json()["id"]

    # Add member
    resp2 = await client.post(
        f"/v1/calendars/{cal_id}/groups/{group_id}/members",
        headers=headers,
        json={"email": temp_email},
    )
    assert resp2.status_code == 201
    assert resp2.json()["email"] == temp_email

    # List members
    resp3 = await client.get(f"/v1/calendars/{cal_id}/groups/{group_id}/members", headers=headers)
    assert resp3.status_code == 200
    assert any(m["email"] == temp_email for m in resp3.json())

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}/members/{user_id}", headers=headers)
    await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)


@pytest.mark.asyncio
async def test_remove_group_member(auth_client):
    client, headers, cal_id = auth_client
    # Create group
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "Remove Member Group"},
    )
    group_id = resp.json()["id"]

    # Register and add temp user
    temp_email = f"grp_rm_{uuid.uuid4().hex[:8]}@example.com"
    reg = await client.post(
        "/v1/auth/register",
        json={"email": temp_email, "name": "Remove Me", "password": "securepass1"},
    )
    if reg.status_code == 429:
        await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)
        pytest.skip("Rate limited")
    user_id = reg.json()["id"]

    await client.post(
        f"/v1/calendars/{cal_id}/groups/{group_id}/members",
        headers=headers,
        json={"email": temp_email},
    )

    # Remove member
    resp2 = await client.delete(
        f"/v1/calendars/{cal_id}/groups/{group_id}/members/{user_id}",
        headers=headers,
    )
    assert resp2.status_code == 204

    # Verify member gone
    resp3 = await client.get(f"/v1/calendars/{cal_id}/groups/{group_id}/members", headers=headers)
    assert not any(m["id"] == user_id for m in resp3.json())

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)


@pytest.mark.asyncio
async def test_set_group_access(auth_client):
    client, headers, cal_id = auth_client
    # Create group
    resp = await client.post(
        f"/v1/calendars/{cal_id}/groups",
        headers=headers,
        json={"name": "Access Group"},
    )
    group_id = resp.json()["id"]

    # Set group access
    resp2 = await client.post(
        f"/v1/calendars/{cal_id}/groups/{group_id}/access",
        headers=headers,
        json={"permission": "modify"},
    )
    assert resp2.status_code == 201
    assert resp2.json()["permission"] == "modify"
    assert resp2.json()["group_name"] == "Access Group"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/groups/{group_id}", headers=headers)


# ─── Calendar email toggle ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_calendar_email_notifications(auth_client):
    client, headers, cal_id = auth_client
    # Disable
    resp = await client.put(
        f"/v1/calendars/{cal_id}",
        headers=headers,
        json={"enable_email_notifications": False},
    )
    assert resp.status_code == 200
    assert resp.json()["enable_email_notifications"] is False

    # Re-enable
    resp2 = await client.put(
        f"/v1/calendars/{cal_id}",
        headers=headers,
        json={"enable_email_notifications": True},
    )
    assert resp2.status_code == 200
    assert resp2.json()["enable_email_notifications"] is True


@pytest.mark.asyncio
async def test_calendar_out_has_email_notifications(auth_client):
    client, headers, cal_id = auth_client
    resp = await client.get(f"/v1/calendars/slug/{TEST_SLUG}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "enable_email_notifications" in data
    assert isinstance(data["enable_email_notifications"], bool)


# ─── Register applies pending invitations ──────────────────────────────────────

@pytest.mark.asyncio
async def test_register_applies_pending_invitations(auth_client):
    """Create a pending invitation, then register with that email → access auto-created."""
    client, headers, cal_id = auth_client
    pending_email = f"auto_apply_{uuid.uuid4().hex[:8]}@example.com"

    # Create pending invitation
    resp = await client.post(
        f"/v1/calendars/{cal_id}/invite",
        headers=headers,
        json={"email": pending_email, "permission": "read_only"},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # Register with that email
    reg = await client.post(
        "/v1/auth/register",
        json={"email": pending_email, "name": "Auto Apply", "password": "securepass1"},
    )
    if reg.status_code == 429:
        # Cleanup pending invitation
        pending_resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
        for inv in pending_resp.json():
            if inv["email"] == pending_email:
                await client.delete(f"/v1/calendars/{cal_id}/pending-invitations/{inv['id']}", headers=headers)
        pytest.skip("Rate limited")
    assert reg.status_code == 201

    # Login as the new user and check accessible calendars
    login = await client.post(
        "/v1/auth/login",
        json={"email": pending_email, "password": "securepass1"},
    )
    if login.status_code == 429:
        pytest.skip("Rate limited")
    new_token = login.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    acc_resp = await client.get("/v1/calendars/accessible", headers=new_headers)
    assert acc_resp.status_code == 200
    accessible = acc_resp.json()
    assert any(c["id"] == cal_id for c in accessible)

    # Pending invitation should be gone
    pending_resp = await client.get(f"/v1/calendars/{cal_id}/pending-invitations", headers=headers)
    assert not any(inv["email"] == pending_email for inv in pending_resp.json())

    # Cleanup: revoke access
    access_resp = await client.get(f"/v1/calendars/{cal_id}/access", headers=headers)
    for acc in access_resp.json():
        if acc.get("user_email") == pending_email:
            await client.delete(f"/v1/calendars/{cal_id}/access/{acc['id']}", headers=headers)
