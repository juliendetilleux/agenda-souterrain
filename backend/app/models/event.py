import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sub_calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_calendars.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    start_dt: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_dt: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    who: Mapped[str] = mapped_column(String(255), nullable=True)
    signup_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    signup_max: Mapped[int] = mapped_column(Integer, nullable=True)
    rrule: Mapped[str] = mapped_column(String(500), nullable=True)
    recurrence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    translations: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    creator_token: Mapped[str] = mapped_column(String(100), nullable=True)
    creator_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    creation_dt: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    update_dt: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    sub_calendar: Mapped["SubCalendar"] = relationship("SubCalendar", back_populates="events")
    signups: Mapped[list["EventSignup"]] = relationship(
        "EventSignup", back_populates="event", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", secondary="event_tags", back_populates="events"
    )


class EventSignup(Base):
    __tablename__ = "event_signups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    event: Mapped["Event"] = relationship("Event", back_populates="signups")
