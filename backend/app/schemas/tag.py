import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class TagCreate(BaseModel):
    name: str
    color: str = "#3788d8"
    position: int = 0

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("La couleur doit être au format #RRGGBB")
        return v.lower()


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("La couleur doit être au format #RRGGBB")
        return v.lower() if v else v


class TagOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    name: str
    color: str
    position: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
