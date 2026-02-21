"""Unit tests for Pydantic schema validators — no DB required."""
import uuid
from datetime import datetime
import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.event import EventCreate, EventUpdate, SignupCreate
from app.schemas.calendar import CalendarCreate
from app.schemas.sub_calendar import SubCalendarCreate, SubCalendarUpdate
from app.schemas.tag import TagCreate, TagUpdate


# ─── Password policy (Phase 1.3) ──────────────────────────────────────────

def test_password_too_short():
    with pytest.raises(ValidationError, match="8 caractères"):
        UserCreate(email="a@b.com", name="Test", password="abc")


def test_password_no_digit():
    with pytest.raises(ValidationError, match="un chiffre"):
        UserCreate(email="a@b.com", name="Test", password="abcdefgh")


def test_password_valid():
    u = UserCreate(email="a@b.com", name="Test", password="abcdefg1")
    assert u.password == "abcdefg1"


# ─── Event date validation (Phase 1.6) ────────────────────────────────────

SC_ID = uuid.uuid4()


def test_event_end_before_start():
    with pytest.raises(ValidationError, match="end_dt"):
        EventCreate(
            sub_calendar_id=SC_ID,
            title="Test",
            start_dt=datetime(2025, 6, 15, 14, 0),
            end_dt=datetime(2025, 6, 15, 12, 0),
        )


def test_event_end_equals_start():
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="Test",
        start_dt=datetime(2025, 6, 15, 14, 0),
        end_dt=datetime(2025, 6, 15, 14, 0),
    )
    assert e.start_dt == e.end_dt


def test_event_update_partial_no_error():
    """EventUpdate with only title set (no dates) should not raise."""
    eu = EventUpdate(title="Updated")
    assert eu.title == "Updated"


def test_event_update_end_before_start():
    with pytest.raises(ValidationError, match="end_dt"):
        EventUpdate(
            start_dt=datetime(2025, 6, 15, 14, 0),
            end_dt=datetime(2025, 6, 15, 12, 0),
        )


# ─── Signup EmailStr (Phase 2.3) ──────────────────────────────────────────

def test_signup_invalid_email():
    with pytest.raises(ValidationError):
        SignupCreate(name="Test", email="notanemail")


def test_signup_valid_email():
    s = SignupCreate(name="Test", email="a@b.com")
    assert s.email == "a@b.com"


# ─── Calendar timezone & language (Phase 2.2) ─────────────────────────────

def test_calendar_invalid_timezone():
    with pytest.raises(ValidationError, match="Fuseau horaire invalide"):
        CalendarCreate(title="Test", timezone="Fake/Zone")


def test_calendar_valid_timezone():
    c = CalendarCreate(title="Test", timezone="Europe/Paris")
    assert c.timezone == "Europe/Paris"


def test_calendar_invalid_language():
    with pytest.raises(ValidationError, match="Langue invalide"):
        CalendarCreate(title="Test", language="xx")


def test_calendar_valid_language():
    c = CalendarCreate(title="Test", language="nl")
    assert c.language == "nl"


# ─── SubCalendar color hex (Phase 2.2) ────────────────────────────────────

def test_subcal_invalid_color():
    with pytest.raises(ValidationError, match="hexadécimal"):
        SubCalendarCreate(name="Test", color="red")


def test_subcal_valid_color():
    sc = SubCalendarCreate(name="Test", color="#ff0000")
    assert sc.color == "#ff0000"


def test_subcal_update_invalid_color():
    with pytest.raises(ValidationError, match="hexadécimal"):
        SubCalendarUpdate(color="blue")


def test_subcal_update_none_color_ok():
    """None color should pass validation (optional field)."""
    sc = SubCalendarUpdate(name="Renamed")
    assert sc.color is None


# ─── Event rrule (récurrence) ─────────────────────────────────────────

def test_event_rrule_valid():
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="Hebdo",
        start_dt=datetime(2025, 6, 15, 10, 0),
        end_dt=datetime(2025, 6, 15, 11, 0),
        rrule="FREQ=WEEKLY",
    )
    assert e.rrule == "FREQ=WEEKLY"


def test_event_rrule_none():
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="Ponctuel",
        start_dt=datetime(2025, 6, 15, 10, 0),
        end_dt=datetime(2025, 6, 15, 11, 0),
    )
    assert e.rrule is None


def test_event_rrule_daily():
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="Quotidien",
        start_dt=datetime(2025, 6, 15, 10, 0),
        end_dt=datetime(2025, 6, 15, 11, 0),
        rrule="FREQ=DAILY",
    )
    assert e.rrule == "FREQ=DAILY"


def test_event_update_rrule():
    eu = EventUpdate(rrule="FREQ=MONTHLY")
    assert eu.rrule == "FREQ=MONTHLY"


def test_event_update_clear_rrule():
    """Setting rrule to empty string should be accepted (clear recurrence)."""
    eu = EventUpdate(rrule="")
    assert eu.rrule == ""


# ─── Tag schema validation ───────────────────────────────────────────────

def test_tag_create_valid():
    t = TagCreate(name="Urgent", color="#ff0000")
    assert t.name == "Urgent"
    assert t.color == "#ff0000"


def test_tag_create_default_color():
    t = TagCreate(name="Default")
    assert t.color == "#3788d8"


def test_tag_create_invalid_color():
    with pytest.raises(ValidationError, match="RRGGBB"):
        TagCreate(name="Bad", color="red")


def test_tag_create_invalid_color_short():
    with pytest.raises(ValidationError, match="RRGGBB"):
        TagCreate(name="Bad", color="#fff")


def test_tag_update_valid():
    t = TagUpdate(name="Renamed", color="#00ff00")
    assert t.name == "Renamed"
    assert t.color == "#00ff00"


def test_tag_update_none_color_ok():
    t = TagUpdate(name="Only name")
    assert t.color is None


def test_tag_create_color_lowercase():
    """Color hex should be lowercased."""
    t = TagCreate(name="Test", color="#FF00AA")
    assert t.color == "#ff00aa"


# ─── Event with tag_ids ─────────────────────────────────────────────────

def test_event_create_with_tag_ids():
    tag_id = uuid.uuid4()
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="Tagged",
        start_dt=datetime(2025, 6, 15, 10, 0),
        end_dt=datetime(2025, 6, 15, 11, 0),
        tag_ids=[tag_id],
    )
    assert e.tag_ids == [tag_id]


def test_event_create_default_tag_ids():
    e = EventCreate(
        sub_calendar_id=SC_ID,
        title="No tags",
        start_dt=datetime(2025, 6, 15, 10, 0),
        end_dt=datetime(2025, 6, 15, 11, 0),
    )
    assert e.tag_ids == []


def test_event_update_tag_ids():
    tag_id = uuid.uuid4()
    eu = EventUpdate(tag_ids=[tag_id])
    assert eu.tag_ids == [tag_id]
