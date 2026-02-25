import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Table, Column, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Permission(str, enum.Enum):
    NO_ACCESS = "no_access"
    READ_ONLY_NO_DETAILS = "read_only_no_details"
    READ_ONLY = "read_only"
    ADD_ONLY = "add_only"
    MODIFY_OWN = "modify_own"
    MODIFY = "modify"
    ADMINISTRATOR = "administrator"


group_members = Table(
    "group_members",
    Base.metadata,
    Column("group_id", UUID(as_uuid=True), ForeignKey("groups.id"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendars.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="groups")
    members: Mapped[list["User"]] = relationship("User", secondary=group_members)
    access_entries: Mapped[list["CalendarAccess"]] = relationship("CalendarAccess", back_populates="group")


class AccessLink(Base):
    __tablename__ = "access_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendars.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="access_links")
    group: Mapped["Group"] = relationship("Group")
    access_entries: Mapped[list["CalendarAccess"]] = relationship("CalendarAccess", back_populates="link")


class CalendarAccess(Base):
    __tablename__ = "calendar_access"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendars.id"), nullable=False)
    sub_calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_calendars.id"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    link_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("access_links.id"), nullable=True)
    permission: Mapped[Permission] = mapped_column(SAEnum(Permission), nullable=False, default=Permission.READ_ONLY)

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="access_entries")
    user: Mapped["User"] = relationship("User", back_populates="access_entries")
    group: Mapped["Group"] = relationship("Group", back_populates="access_entries")
    link: Mapped["AccessLink"] = relationship("AccessLink", back_populates="access_entries")


class PendingInvitation(Base):
    __tablename__ = "pending_invitations"
    __table_args__ = (
        UniqueConstraint("calendar_id", "email", name="uq_pending_calendar_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    permission: Mapped[Permission] = mapped_column(SAEnum(Permission), nullable=False, default=Permission.READ_ONLY)
    sub_calendar_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sub_calendars.id", ondelete="SET NULL"), nullable=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
