import uuid
import re
import unicodedata
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from zoneinfo import ZoneInfo


ALLOWED_LANGUAGES = ("fr", "en", "nl", "de")


class CalendarCreate(BaseModel):
    title: str
    slug: Optional[str] = None  # auto-generated from title if not provided
    timezone: str = "Europe/Paris"
    language: str = "fr"

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (KeyError, Exception):
            raise ValueError(f"Fuseau horaire invalide : {v}")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in ALLOWED_LANGUAGES:
            raise ValueError(f"Langue invalide : {v}. Choix : {', '.join(ALLOWED_LANGUAGES)}")
        return v
    week_start: int = 1
    date_format: str = "DD/MM/YYYY"
    default_view: str = "month"
    visible_time_start: str = "00:00"
    visible_time_end: str = "24:00"
    default_event_duration: int = 60
    show_weekends: bool = True


class CalendarUpdate(BaseModel):
    title: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                ZoneInfo(v)
            except (KeyError, Exception):
                raise ValueError(f"Fuseau horaire invalide : {v}")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_LANGUAGES:
            raise ValueError(f"Langue invalide : {v}. Choix : {', '.join(ALLOWED_LANGUAGES)}")
        return v
    week_start: Optional[int] = None
    date_format: Optional[str] = None
    default_view: Optional[str] = None
    visible_time_start: Optional[str] = None
    visible_time_end: Optional[str] = None
    default_event_duration: Optional[int] = None
    show_weekends: Optional[bool] = None


class CalendarOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    owner_id: uuid.UUID
    timezone: str
    language: str
    week_start: int
    date_format: str
    default_view: str
    visible_time_start: str
    visible_time_end: str
    default_event_duration: int
    show_weekends: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarAdminOut(CalendarOut):
    owner_email: str
    owner_name: str


def slugify(title: str) -> str:
    """Convert a title to a URL-safe slug."""
    nfkd = unicodedata.normalize("NFKD", title)
    ascii_str = nfkd.encode("ascii", "ignore").decode()
    slug = re.sub(r"[^\w\s-]", "", ascii_str.lower())
    slug = re.sub(r"[-\s]+", "-", slug).strip("-")
    return slug[:80] or "calendrier"
