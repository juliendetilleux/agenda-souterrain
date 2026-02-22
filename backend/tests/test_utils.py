"""Unit tests for utility modules — no DB required."""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.utils.permissions import (
    Permission,
    permission_level,
    highest_permission,
    can_read,
    can_read_limited,
    can_add,
    can_modify,
    can_modify_own,
    is_admin,
)
from app.utils.ical import event_to_ical, events_to_ical
from app.schemas.calendar import slugify
from app.services.email import TEMPLATES, PERMISSION_LABELS, _smtp_configured, _get_permission_label


# ─── Security: password hashing ──────────────────────────────────────────

def test_password_hash_verify():
    hashed = get_password_hash("secret123")
    assert verify_password("secret123", hashed)


def test_password_verify_wrong():
    hashed = get_password_hash("secret123")
    assert not verify_password("wrong", hashed)


# ─── Security: JWT tokens ────────────────────────────────────────────────

def test_create_access_token():
    token = create_access_token({"sub": "user-id-1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-id-1"
    assert payload["type"] == "access"
    assert "exp" in payload


def test_create_refresh_token():
    token = create_refresh_token({"sub": "user-id-1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-id-1"
    assert payload["type"] == "refresh"


def test_decode_token_valid():
    token = create_access_token({"sub": "abc"})
    payload = decode_token(token)
    assert payload["sub"] == "abc"


def test_decode_token_expired():
    token = create_access_token(
        {"sub": "abc"}, expires_delta=timedelta(seconds=-1)
    )
    payload = decode_token(token)
    assert payload is None


def test_decode_token_invalid():
    payload = decode_token("not.a.valid.token")
    assert payload is None


# ─── Permissions: ordering and helpers ────────────────────────────────────

def test_permission_level_ordering():
    levels = [permission_level(p) for p in Permission]
    assert levels == sorted(levels)


def test_highest_permission():
    result = highest_permission([Permission.READ_ONLY, Permission.MODIFY])
    assert result == Permission.MODIFY


def test_highest_permission_empty():
    assert highest_permission([]) == Permission.NO_ACCESS


def test_can_read_levels():
    assert not can_read(Permission.NO_ACCESS)
    assert not can_read(Permission.READ_ONLY_NO_DETAILS)
    assert can_read(Permission.READ_ONLY)
    assert can_read(Permission.ADMINISTRATOR)


def test_can_read_limited_levels():
    assert not can_read_limited(Permission.NO_ACCESS)
    assert can_read_limited(Permission.READ_ONLY_NO_DETAILS)
    assert can_read_limited(Permission.READ_ONLY)


def test_can_add_levels():
    assert not can_add(Permission.READ_ONLY)
    assert can_add(Permission.ADD_ONLY)
    assert can_add(Permission.MODIFY)


def test_can_modify_levels():
    assert not can_modify(Permission.MODIFY_OWN)
    assert can_modify(Permission.MODIFY)
    assert can_modify(Permission.ADMINISTRATOR)


def test_can_modify_own_levels():
    assert not can_modify_own(Permission.ADD_ONLY)
    assert can_modify_own(Permission.MODIFY_OWN)
    assert can_modify_own(Permission.MODIFY)


def test_is_admin_levels():
    assert not is_admin(Permission.MODIFY)
    assert is_admin(Permission.ADMINISTRATOR)


# ─── iCal generation ─────────────────────────────────────────────────────

def _make_event(**kwargs):
    """Create a mock Event-like object."""
    defaults = {
        "id": uuid.uuid4(),
        "title": "Test Event",
        "start_dt": datetime(2025, 6, 15, 10, 0),
        "end_dt": datetime(2025, 6, 15, 11, 0),
        "all_day": False,
        "location": None,
        "notes": None,
        "rrule": None,
        "latitude": None,
        "longitude": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_event_to_ical_basic():
    event = _make_event(title="Réunion")
    ical_bytes = event_to_ical(event)
    ical_str = ical_bytes.decode()
    assert "VCALENDAR" in ical_str
    assert "VEVENT" in ical_str
    assert "Réunion" in ical_str


def test_event_to_ical_allday():
    event = _make_event(
        all_day=True,
        start_dt=datetime(2025, 6, 15),
        end_dt=datetime(2025, 6, 15),
    )
    ical_bytes = event_to_ical(event)
    ical_str = ical_bytes.decode()
    assert "DTSTART;VALUE=DATE:20250615" in ical_str


def test_event_to_ical_allday_multiday():
    """All-day event spanning multiple days should have correct DTEND."""
    event = _make_event(
        all_day=True,
        start_dt=datetime(2025, 6, 15),
        end_dt=datetime(2025, 6, 17),
    )
    ical_bytes = event_to_ical(event)
    ical_str = ical_bytes.decode()
    # DTEND should be end_dt + 1 day = 2025-06-18
    assert "20250618" in ical_str


def test_events_to_ical_multiple():
    events = [
        _make_event(title="Event A"),
        _make_event(title="Event B"),
    ]
    ical_bytes = events_to_ical(events)
    ical_str = ical_bytes.decode()
    assert ical_str.count("VEVENT") == 4  # BEGIN:VEVENT + END:VEVENT x2


# ─── Slugify ─────────────────────────────────────────────────────────────

def test_slugify_basic():
    assert slugify("Mon Calendrier") == "mon-calendrier"


def test_slugify_accents():
    assert slugify("Événements à Paris") == "evenements-a-paris"


def test_slugify_special_chars():
    result = slugify("Test!@#$%^&*()")
    assert result.isascii()
    assert " " not in result


# ─── Email service helpers ──────────────────────────────────────────────────

def test_smtp_configured_false(monkeypatch):
    """When SMTP_USER or SMTP_PASSWORD is empty, _smtp_configured returns False."""
    from app import config
    monkeypatch.setattr(config.settings, "SMTP_USER", "")
    monkeypatch.setattr(config.settings, "SMTP_PASSWORD", "")
    assert _smtp_configured() is False


def test_get_permission_label_fr():
    assert _get_permission_label("read_only", "fr") == "Lecture seule"


def test_get_permission_label_en():
    assert _get_permission_label("administrator", "en") == "Administrator"


def test_get_permission_label_fallback():
    """Unknown language should fall back to English labels."""
    assert _get_permission_label("modify", "xx") == "Modify"


def test_templates_all_languages():
    """All 4 language templates should have the 4 required keys."""
    required_keys = {"subject_existing", "subject_new", "body_existing", "body_new"}
    for lang in ("fr", "en", "nl", "de"):
        assert lang in TEMPLATES, f"Missing language: {lang}"
        assert set(TEMPLATES[lang].keys()) == required_keys, f"Missing keys for {lang}"
