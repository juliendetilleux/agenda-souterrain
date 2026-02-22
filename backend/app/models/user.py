import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ban_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ban_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    calendars: Mapped[list["Calendar"]] = relationship(
        "Calendar", back_populates="owner", foreign_keys="Calendar.owner_id"
    )
    access_entries: Mapped[list["CalendarAccess"]] = relationship(
        "CalendarAccess", back_populates="user"
    )
