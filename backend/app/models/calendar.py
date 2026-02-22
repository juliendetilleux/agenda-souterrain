import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Calendar(Base):
    __tablename__ = "calendars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), default="Europe/Paris")
    language: Mapped[str] = mapped_column(String(10), default="fr")
    week_start: Mapped[int] = mapped_column(Integer, default=1)
    date_format: Mapped[str] = mapped_column(String(20), default="DD/MM/YYYY")
    default_view: Mapped[str] = mapped_column(String(30), default="month")
    visible_time_start: Mapped[str] = mapped_column(String(5), default="00:00")
    visible_time_end: Mapped[str] = mapped_column(String(5), default="24:00")
    default_event_duration: Mapped[int] = mapped_column(Integer, default=60)
    show_weekends: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    owner: Mapped["User"] = relationship("User", back_populates="calendars", foreign_keys=[owner_id])
    sub_calendars: Mapped[list["SubCalendar"]] = relationship(
        "SubCalendar", back_populates="calendar", cascade="all, delete-orphan"
    )
    access_entries: Mapped[list["CalendarAccess"]] = relationship(
        "CalendarAccess", back_populates="calendar", cascade="all, delete-orphan"
    )
    access_links: Mapped[list["AccessLink"]] = relationship(
        "AccessLink", back_populates="calendar", cascade="all, delete-orphan"
    )
    groups: Mapped[list["Group"]] = relationship(
        "Group", back_populates="calendar", cascade="all, delete-orphan"
    )
    custom_fields: Mapped[list["CustomEventField"]] = relationship(
        "CustomEventField", back_populates="calendar", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", back_populates="calendar", cascade="all, delete-orphan"
    )
