import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


def _validate_hex_color(v: str) -> str:
    if not re.match(r"^#[0-9a-fA-F]{6}$", v):
        raise ValueError("La couleur doit être au format hexadécimal (#RRGGBB)")
    return v


class SubCalendarCreate(BaseModel):
    name: str
    color: str = "#3788d8"
    position: int = 0

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        return _validate_hex_color(v)


class SubCalendarUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None
    position: Optional[int] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_hex_color(v)
        return v


class SubCalendarOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    name: str
    color: str
    active: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}
