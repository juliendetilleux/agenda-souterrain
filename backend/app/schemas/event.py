import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.schemas.tag import TagOut


def _strip_tz(dt: datetime) -> datetime:
    """Convert timezone-aware datetime to naive UTC datetime."""
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class EventCreate(BaseModel):
    sub_calendar_id: uuid.UUID
    title: str
    start_dt: datetime
    end_dt: datetime
    all_day: bool = False
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    who: Optional[str] = None
    signup_enabled: bool = False
    signup_max: Optional[int] = None
    rrule: Optional[str] = None
    custom_fields: Dict[str, Any] = {}
    tag_ids: List[uuid.UUID] = []

    @field_validator("start_dt", "end_dt", mode="after")
    @classmethod
    def normalize_dt(cls, v: datetime) -> datetime:
        return _strip_tz(v)

    @field_validator("latitude", mode="after")
    @classmethod
    def validate_latitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude", mode="after")
    @classmethod
    def validate_longitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_dt < self.start_dt:
            raise ValueError("end_dt doit être >= start_dt")
        return self


class EventUpdate(BaseModel):
    sub_calendar_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    who: Optional[str] = None
    signup_enabled: Optional[bool] = None
    signup_max: Optional[int] = None
    rrule: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    tag_ids: Optional[List[uuid.UUID]] = None

    @field_validator("start_dt", "end_dt", mode="after")
    @classmethod
    def normalize_dt(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _strip_tz(v) if v else v

    @field_validator("latitude", mode="after")
    @classmethod
    def validate_latitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90 <= v <= 90):
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude", mode="after")
    @classmethod
    def validate_longitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("longitude must be between -180 and 180")
        return v

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_dt is not None and self.end_dt is not None and self.end_dt < self.start_dt:
            raise ValueError("end_dt doit être >= start_dt")
        return self


class EventOut(BaseModel):
    id: uuid.UUID
    sub_calendar_id: uuid.UUID
    title: str
    start_dt: datetime
    end_dt: datetime
    all_day: bool
    location: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    notes: Optional[str]
    who: Optional[str]
    signup_enabled: bool
    signup_max: Optional[int]
    rrule: Optional[str]
    custom_fields: Dict[str, Any]
    tags: List[TagOut] = []
    translations: Optional[Dict[str, Any]] = None
    creation_dt: datetime
    update_dt: datetime

    model_config = {"from_attributes": True}


class SignupCreate(BaseModel):
    name: str
    email: EmailStr
    note: Optional[str] = None


class SignupOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    email: str
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
