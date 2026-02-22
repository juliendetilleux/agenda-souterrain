import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr
from app.models.access import Permission


class AccessLinkCreate(BaseModel):
    label: Optional[str] = None
    permission: Permission = Permission.READ_ONLY
    sub_calendar_id: Optional[uuid.UUID] = None


class AccessLinkUpdate(BaseModel):
    label: Optional[str] = None
    active: Optional[bool] = None
    permission: Optional[Permission] = None


class AccessLinkOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    token: str
    label: Optional[str]
    active: bool
    created_at: datetime
    permission: Optional[Permission] = None  # resolved from CalendarAccess

    model_config = {"from_attributes": True}


class CalendarAccessCreate(BaseModel):
    sub_calendar_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    group_id: Optional[uuid.UUID] = None
    link_id: Optional[uuid.UUID] = None
    permission: Permission


class CalendarAccessOut(BaseModel):
    id: uuid.UUID
    sub_calendar_id: Optional[uuid.UUID]
    user_id: Optional[uuid.UUID]
    group_id: Optional[uuid.UUID]
    link_id: Optional[uuid.UUID]
    permission: Permission
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    group_name: Optional[str] = None
    link_label: Optional[str] = None

    model_config = {"from_attributes": True}


class AccessUpdate(BaseModel):
    permission: Permission


class GroupCreate(BaseModel):
    name: str


class GroupOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupMemberOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str

    model_config = {"from_attributes": True}


class InviteUser(BaseModel):
    email: EmailStr
    permission: Permission = Permission.READ_ONLY
    sub_calendar_id: Optional[uuid.UUID] = None


class AddGroupMember(BaseModel):
    email: EmailStr


class SetGroupAccess(BaseModel):
    permission: Permission
    sub_calendar_id: Optional[uuid.UUID] = None


class MyPermissionOut(BaseModel):
    permission: Permission
    is_owner: bool


class InviteResult(BaseModel):
    status: Literal["added", "pending"]
    email: str
    permission: Permission
    email_sent: bool = False


class PendingInvitationOut(BaseModel):
    id: uuid.UUID
    calendar_id: uuid.UUID
    email: str
    permission: Permission
    sub_calendar_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}
