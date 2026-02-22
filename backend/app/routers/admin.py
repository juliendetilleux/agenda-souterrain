import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.database import get_db
from app.models.user import User
from app.models.calendar import Calendar
from app.models.event import Event
from app.models.access import CalendarAccess, PendingInvitation, group_members
from app.models.comment import EventComment, EventAttachment
from app.schemas.user import UserOut, BanUserRequest, make_user_out
from app.schemas.calendar import CalendarAdminOut
from app.routers.deps import get_superadmin_user
from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (superadmin only)."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [make_user_out(u) for u in users]


@router.put("/users/{user_id}/promote", response_model=UserOut)
async def promote_user(
    user_id: uuid.UUID,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Grant app admin status to a user (superadmin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = True
    await db.flush()
    await db.refresh(user)
    return make_user_out(user)


@router.put("/users/{user_id}/demote", response_model=UserOut)
async def demote_user(
    user_id: uuid.UUID,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke app admin status from a user (superadmin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = False
    await db.flush()
    await db.refresh(user)
    return make_user_out(user)


def _is_superadmin(user: User) -> bool:
    return bool(settings.ADMIN_EMAIL and user.email == settings.ADMIN_EMAIL)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a user and clean up all their data (superadmin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if _is_superadmin(user):
        raise HTTPException(status_code=403, detail="Cannot delete the superadmin")

    # Delete calendars owned by this user (cascade handles sub-objects)
    owned_cals = await db.execute(select(Calendar).where(Calendar.owner_id == user_id))
    for cal in owned_cals.scalars().all():
        await db.delete(cal)

    # Remove user from group_members
    await db.execute(delete(group_members).where(group_members.c.user_id == user_id))

    # Delete CalendarAccess entries for this user
    await db.execute(delete(CalendarAccess).where(CalendarAccess.user_id == user_id))

    # Nullify creator_user_id on events (preserve events on other calendars)
    await db.execute(
        update(Event).where(Event.creator_user_id == user_id).values(creator_user_id=None)
    )

    # Delete comments and attachments by this user
    await db.execute(delete(EventComment).where(EventComment.user_id == user_id))
    await db.execute(delete(EventAttachment).where(EventAttachment.user_id == user_id))

    # Delete pending invitations sent by this user
    await db.execute(delete(PendingInvitation).where(PendingInvitation.invited_by == user_id))

    await db.delete(user)


@router.put("/users/{user_id}/ban", response_model=UserOut)
async def ban_user(
    user_id: uuid.UUID,
    body: BanUserRequest,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Ban a user permanently or temporarily (superadmin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if _is_superadmin(user):
        raise HTTPException(status_code=403, detail="Cannot ban the superadmin")

    if not body.permanent and not body.until:
        raise HTTPException(status_code=422, detail="Temporary ban requires an end date")

    user.is_banned = True
    user.ban_until = None if body.permanent else body.until
    user.ban_reason = body.reason

    await db.flush()
    await db.refresh(user)
    return make_user_out(user)


@router.put("/users/{user_id}/unban", response_model=UserOut)
async def unban_user(
    user_id: uuid.UUID,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove ban from a user (superadmin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_banned = False
    user.ban_until = None
    user.ban_reason = None

    await db.flush()
    await db.refresh(user)
    return make_user_out(user)


@router.get("/calendars", response_model=list[CalendarAdminOut])
async def list_all_calendars(
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all calendars with owner info (superadmin only)."""
    result = await db.execute(
        select(Calendar, User).join(User, Calendar.owner_id == User.id).order_by(Calendar.id)
    )
    rows = result.all()
    return [
        CalendarAdminOut(
            **{k: v for k, v in cal.__dict__.items() if not k.startswith("_")},
            owner_email=owner.email,
            owner_name=owner.name,
        )
        for cal, owner in rows
    ]


@router.delete("/calendars/{cal_id}", status_code=204)
async def delete_calendar_admin(
    cal_id: uuid.UUID,
    _: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """Force-delete any calendar (superadmin only)."""
    cal = await db.get(Calendar, cal_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    await db.delete(cal)
