import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, field_validator


class CommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Le contenu ne peut pas être vide")
        return v.strip()


class CommentOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    content: str
    translations: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    original_filename: str
    stored_filename: str
    mime_type: str
    file_size: int
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}
