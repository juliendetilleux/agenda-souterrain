"""Integration tests for CRUD operations — run against the live backend.

Requires Docker containers to be up:
    docker-compose up -d
    docker exec agenda-souterrain-backend-1 python -m pytest tests/test_crud.py -v

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
    """Returns (client, token, calendar_id, sub_calendar_id)."""
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

    # Get calendar
    cal_resp = await client.get(f"/v1/calendars/slug/{TEST_SLUG}", headers=headers)
    if cal_resp.status_code != 200:
        pytest.skip("Test calendar not found — run E2E global setup first")
    cal = cal_resp.json()
    cal_id = cal["id"]

    # Get sub-calendars
    sc_resp = await client.get(f"/v1/calendars/{cal_id}/subcalendars", headers=headers)
    scs = sc_resp.json()
    sc_id = scs[0]["id"] if scs else None

    return client, headers, cal_id, sc_id


# ─── Calendars ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_my_calendars(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.get("/v1/calendars/mine", headers=headers)
    assert resp.status_code == 200
    cals = resp.json()
    assert any(c["id"] == cal_id for c in cals)


@pytest.mark.asyncio
async def test_get_calendar_by_slug(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.get(f"/v1/calendars/slug/{TEST_SLUG}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == TEST_SLUG
    assert data["id"] == cal_id


@pytest.mark.asyncio
async def test_update_calendar(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.put(
        f"/v1/calendars/{cal_id}",
        headers=headers,
        json={"title": "Calendrier E2E"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Calendrier E2E"


@pytest.mark.asyncio
async def test_get_calendar_not_found(auth_client):
    client, headers, _, _ = auth_client
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/v1/calendars/{fake_id}", headers=headers)
    assert resp.status_code == 404


# ─── Sub-calendars ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_subcalendars(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.get(f"/v1/calendars/{cal_id}/subcalendars", headers=headers)
    assert resp.status_code == 200
    scs = resp.json()
    assert len(scs) >= 1


@pytest.mark.asyncio
async def test_create_and_delete_subcalendar(auth_client):
    client, headers, cal_id, _ = auth_client
    # Create
    resp = await client.post(
        f"/v1/calendars/{cal_id}/subcalendars",
        headers=headers,
        json={"name": "Test SC", "color": "#ff0000"},
    )
    assert resp.status_code == 201
    sc_id = resp.json()["id"]

    # Update
    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/subcalendars/{sc_id}",
        headers=headers,
        json={"name": "Renamed SC"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["name"] == "Renamed SC"

    # Delete
    resp3 = await client.delete(
        f"/v1/calendars/{cal_id}/subcalendars/{sc_id}",
        headers=headers,
    )
    assert resp3.status_code == 204


# ─── Events ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_event(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Test CRUD Event",
            "start_dt": "2025-07-01T10:00:00",
            "end_dt": "2025-07-01T11:00:00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test CRUD Event"
    assert "id" in data
    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{data['id']}", headers=headers)


@pytest.mark.asyncio
async def test_list_events_date_filter(auth_client):
    client, headers, cal_id, sc_id = auth_client
    # Create event in August
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "August Event",
            "start_dt": "2025-08-10T10:00:00",
            "end_dt": "2025-08-10T11:00:00",
        },
    )
    event_id = resp.json()["id"]

    # Filter for August — should find it
    resp2 = await client.get(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        params={"start_dt": "2025-08-01T00:00:00", "end_dt": "2025-08-31T23:59:59"},
    )
    assert resp2.status_code == 200
    events = resp2.json()
    assert any(e["id"] == event_id for e in events)

    # Filter for January — should NOT find it
    resp3 = await client.get(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        params={"start_dt": "2025-01-01T00:00:00", "end_dt": "2025-01-31T23:59:59"},
    )
    assert resp3.status_code == 200
    events3 = resp3.json()
    assert not any(e["id"] == event_id for e in events3)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{event_id}", headers=headers)


@pytest.mark.asyncio
async def test_get_event(auth_client):
    client, headers, cal_id, sc_id = auth_client
    # Create
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Get Test",
            "start_dt": "2025-07-02T10:00:00",
            "end_dt": "2025-07-02T11:00:00",
        },
    )
    eid = resp.json()["id"]

    # Get
    resp2 = await client.get(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["title"] == "Get Test"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


@pytest.mark.asyncio
async def test_update_event(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Before Update",
            "start_dt": "2025-07-03T10:00:00",
            "end_dt": "2025-07-03T11:00:00",
        },
    )
    eid = resp.json()["id"]

    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/events/{eid}",
        headers=headers,
        json={"title": "After Update"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["title"] == "After Update"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


@pytest.mark.asyncio
async def test_update_event_clear_rrule(auth_client):
    client, headers, cal_id, sc_id = auth_client
    # Create with rrule
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Recurring",
            "start_dt": "2025-07-04T10:00:00",
            "end_dt": "2025-07-04T11:00:00",
            "rrule": "FREQ=WEEKLY",
        },
    )
    eid = resp.json()["id"]
    assert resp.json()["rrule"] == "FREQ=WEEKLY"

    # Clear rrule
    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/events/{eid}",
        headers=headers,
        json={"rrule": None},
    )
    assert resp2.status_code == 200
    assert resp2.json()["rrule"] is None

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


@pytest.mark.asyncio
async def test_delete_event(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "To Delete",
            "start_dt": "2025-07-05T10:00:00",
            "end_dt": "2025-07-05T11:00:00",
        },
    )
    eid = resp.json()["id"]

    resp2 = await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)
    assert resp2.status_code == 204

    # Verify gone
    resp3 = await client.get(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)
    assert resp3.status_code == 404


@pytest.mark.asyncio
async def test_search_events(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Unique Searchable XYZ",
            "start_dt": "2025-07-06T10:00:00",
            "end_dt": "2025-07-06T11:00:00",
        },
    )
    eid = resp.json()["id"]

    resp2 = await client.get(
        f"/v1/calendars/{cal_id}/events/search",
        headers=headers,
        params={"q": "Searchable XYZ"},
    )
    assert resp2.status_code == 200
    results = resp2.json()
    assert any(e["id"] == eid for e in results)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


@pytest.mark.asyncio
async def test_recurring_event_included_in_future(auth_client):
    """A recurring event with start_dt in the past should still appear in future windows."""
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Weekly Recurring",
            "start_dt": "2025-01-01T10:00:00",
            "end_dt": "2025-01-01T11:00:00",
            "rrule": "FREQ=WEEKLY",
        },
    )
    eid = resp.json()["id"]

    # Query for July — recurring event should be included
    resp2 = await client.get(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        params={"start_dt": "2025-07-01T00:00:00", "end_dt": "2025-07-31T23:59:59"},
    )
    assert resp2.status_code == 200
    events = resp2.json()
    assert any(e["id"] == eid for e in events)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


# ─── iCal export ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_ical_single(auth_client):
    client, headers, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Export Test",
            "start_dt": "2025-07-07T10:00:00",
            "end_dt": "2025-07-07T11:00:00",
        },
    )
    eid = resp.json()["id"]

    resp2 = await client.get(f"/v1/calendars/{cal_id}/events/{eid}/ics")
    assert resp2.status_code == 200
    assert "text/calendar" in resp2.headers.get("content-type", "")
    assert b"VCALENDAR" in resp2.content

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{eid}", headers=headers)


@pytest.mark.asyncio
async def test_export_ical_full(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.get(
        f"/v1/calendars/{cal_id}/events/export.ics",
        headers=headers,
    )
    assert resp.status_code == 200
    assert b"VCALENDAR" in resp.content


# ─── Permissions ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unauthenticated_create_denied(auth_client):
    """Creating an event without auth should fail."""
    client, _, cal_id, sc_id = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        json={
            "sub_calendar_id": sc_id,
            "title": "No Auth",
            "start_dt": "2025-07-08T10:00:00",
            "end_dt": "2025-07-08T11:00:00",
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_my_permission(auth_client):
    """GET /my-permission should return the effective permission."""
    client, headers, cal_id, _ = auth_client
    resp = await client.get(
        f"/v1/calendars/{cal_id}/my-permission",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "permission" in data
    assert "is_owner" in data
    assert data["is_owner"] is True


# ─── Tags ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_tag(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        headers=headers,
        json={"name": "Urgent", "color": "#e17055"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Urgent"
    assert data["color"] == "#e17055"
    assert data["calendar_id"] == cal_id
    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/tags/{data['id']}", headers=headers)


@pytest.mark.asyncio
async def test_list_tags(auth_client):
    client, headers, cal_id, _ = auth_client
    # Create a tag
    resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        headers=headers,
        json={"name": "List Test"},
    )
    tag_id = resp.json()["id"]

    # List
    resp2 = await client.get(f"/v1/calendars/{cal_id}/tags")
    assert resp2.status_code == 200
    tags = resp2.json()
    assert any(t["id"] == tag_id for t in tags)

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_id}", headers=headers)


@pytest.mark.asyncio
async def test_update_tag(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        headers=headers,
        json={"name": "Before"},
    )
    tag_id = resp.json()["id"]

    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/tags/{tag_id}",
        headers=headers,
        json={"name": "After", "color": "#00b894"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["name"] == "After"
    assert resp2.json()["color"] == "#00b894"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_tag(auth_client):
    client, headers, cal_id, _ = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        headers=headers,
        json={"name": "To Delete"},
    )
    tag_id = resp.json()["id"]

    resp2 = await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_id}", headers=headers)
    assert resp2.status_code == 204

    # Verify gone
    resp3 = await client.get(f"/v1/calendars/{cal_id}/tags")
    tags = resp3.json()
    assert not any(t["id"] == tag_id for t in tags)


@pytest.mark.asyncio
async def test_create_tag_unauthenticated(auth_client):
    """Creating a tag without auth should fail (admin required)."""
    client, _, cal_id, _ = auth_client
    resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        json={"name": "No Auth"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_event_with_tags(auth_client):
    """Create an event with tag_ids and verify tags in response."""
    client, headers, cal_id, sc_id = auth_client
    # Create a tag
    tag_resp = await client.post(
        f"/v1/calendars/{cal_id}/tags",
        headers=headers,
        json={"name": "Event Tag", "color": "#6c5ce7"},
    )
    tag_id = tag_resp.json()["id"]

    # Create event with tag
    ev_resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Tagged Event",
            "start_dt": "2025-07-10T10:00:00",
            "end_dt": "2025-07-10T11:00:00",
            "tag_ids": [tag_id],
        },
    )
    assert ev_resp.status_code == 201
    ev_data = ev_resp.json()
    assert len(ev_data["tags"]) == 1
    assert ev_data["tags"][0]["id"] == tag_id
    assert ev_data["tags"][0]["name"] == "Event Tag"

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_data['id']}", headers=headers)
    await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_id}", headers=headers)


@pytest.mark.asyncio
async def test_update_event_tags(auth_client):
    """Update an event's tags."""
    client, headers, cal_id, sc_id = auth_client
    # Create two tags
    t1 = await client.post(f"/v1/calendars/{cal_id}/tags", headers=headers, json={"name": "Tag A"})
    t2 = await client.post(f"/v1/calendars/{cal_id}/tags", headers=headers, json={"name": "Tag B"})
    tag_a_id = t1.json()["id"]
    tag_b_id = t2.json()["id"]

    # Create event with tag A
    ev = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Tag Update Test",
            "start_dt": "2025-07-11T10:00:00",
            "end_dt": "2025-07-11T11:00:00",
            "tag_ids": [tag_a_id],
        },
    )
    ev_id = ev.json()["id"]
    assert len(ev.json()["tags"]) == 1

    # Update to tag B only
    resp = await client.put(
        f"/v1/calendars/{cal_id}/events/{ev_id}",
        headers=headers,
        json={"tag_ids": [tag_b_id]},
    )
    assert resp.status_code == 200
    tags = resp.json()["tags"]
    assert len(tags) == 1
    assert tags[0]["id"] == tag_b_id

    # Update to no tags
    resp2 = await client.put(
        f"/v1/calendars/{cal_id}/events/{ev_id}",
        headers=headers,
        json={"tag_ids": []},
    )
    assert resp2.status_code == 200
    assert len(resp2.json()["tags"]) == 0

    # Cleanup
    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)
    await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_a_id}", headers=headers)
    await client.delete(f"/v1/calendars/{cal_id}/tags/{tag_b_id}", headers=headers)


# ─── Comments ──────────────────────────────────────────────────────────────

async def _create_test_event(client, headers, cal_id, sc_id):
    """Helper to create a test event and return its id."""
    resp = await client.post(
        f"/v1/calendars/{cal_id}/events",
        headers=headers,
        json={
            "sub_calendar_id": sc_id,
            "title": "Comment Test Event",
            "start_dt": "2025-08-01T10:00:00",
            "end_dt": "2025-08-01T11:00:00",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_comment(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
        json={"content": "Hello from test"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Hello from test"
    assert "user_name" in data

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_list_comments(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
        json={"content": "Comment 1"},
    )
    resp = await client.get(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
    )
    assert resp.status_code == 200
    comments = resp.json()
    assert len(comments) >= 1
    assert any(c["content"] == "Comment 1" for c in comments)

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_list_comments_empty(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.get(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_own_comment(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    create_resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
        json={"content": "To delete"},
    )
    comment_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments/{comment_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_comment_not_found(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments/{fake_id}",
        headers=headers,
    )
    assert resp.status_code == 404

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_create_comment_unauthenticated(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        json={"content": "No auth"},
    )
    assert resp.status_code == 401

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_create_comment_empty(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/comments",
        headers=headers,
        json={"content": ""},
    )
    assert resp.status_code == 422

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


# ─── Attachments ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_attachment(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
        files={"file": ("test.txt", b"Hello file content", "text/plain")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["original_filename"] == "test.txt"
    assert data["mime_type"] == "text/plain"
    assert data["file_size"] == len(b"Hello file content")

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_list_attachments(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
        files={"file": ("doc.txt", b"content", "text/plain")},
    )
    resp = await client.get(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
    )
    assert resp.status_code == 200
    attachments = resp.json()
    assert len(attachments) >= 1
    assert any(a["original_filename"] == "doc.txt" for a in attachments)

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_list_attachments_empty(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.get(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_download_attachment(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    upload_resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
        files={"file": ("download.txt", b"download me", "text/plain")},
    )
    stored = upload_resp.json()["stored_filename"]

    resp = await client.get(f"/v1/uploads/{stored}")
    assert resp.status_code == 200
    assert resp.content == b"download me"

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_own_attachment(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    upload_resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
        files={"file": ("del.txt", b"delete me", "text/plain")},
    )
    att_id = upload_resp.json()["id"]

    resp = await client.delete(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments/{att_id}",
        headers=headers,
    )
    assert resp.status_code == 204

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_delete_attachment_not_found(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments/{fake_id}",
        headers=headers,
    )
    assert resp.status_code == 404

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_upload_unauthenticated(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        files={"file": ("noauth.txt", b"no auth", "text/plain")},
    )
    assert resp.status_code == 401

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)


@pytest.mark.asyncio
async def test_upload_invalid_mime_type(auth_client):
    client, headers, cal_id, sc_id = auth_client
    ev_id = await _create_test_event(client, headers, cal_id, sc_id)

    resp = await client.post(
        f"/v1/calendars/{cal_id}/events/{ev_id}/attachments",
        headers=headers,
        files={"file": ("malware.exe", b"evil content", "application/x-msdownload")},
    )
    assert resp.status_code == 400

    await client.delete(f"/v1/calendars/{cal_id}/events/{ev_id}", headers=headers)
