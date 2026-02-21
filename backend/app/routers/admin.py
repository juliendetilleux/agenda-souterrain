import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.calendar import Calendar
from app.schemas.user import UserOut, make_user_out
from app.schemas.calendar import CalendarAdminOut
from app.routers.deps import get_superadmin_user

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
