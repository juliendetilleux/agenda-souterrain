import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.sub_calendar import SubCalendar
from app.schemas.sub_calendar import SubCalendarCreate, SubCalendarUpdate, SubCalendarOut
from app.routers.deps import get_current_user, require_calendar_admin as _require_admin

router = APIRouter(prefix="/calendars/{cal_id}/subcalendars", tags=["sub-calendars"])


@router.get("", response_model=list[SubCalendarOut])
async def list_sub_calendars(cal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SubCalendar)
        .where(SubCalendar.calendar_id == cal_id)
        .order_by(SubCalendar.position)
    )
    return result.scalars().all()


@router.post("", response_model=SubCalendarOut, status_code=201)
async def create_sub_calendar(
    cal_id: uuid.UUID,
    data: SubCalendarCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    sc = SubCalendar(calendar_id=cal_id, **data.model_dump())
    db.add(sc)
    await db.flush()
    await db.refresh(sc)
    return sc


@router.put("/{sc_id}", response_model=SubCalendarOut)
async def update_sub_calendar(
    cal_id: uuid.UUID,
    sc_id: uuid.UUID,
    data: SubCalendarUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(SubCalendar).where(SubCalendar.id == sc_id, SubCalendar.calendar_id == cal_id)
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Sous-calendrier introuvable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(sc, field, value)
    await db.flush()
    await db.refresh(sc)
    return sc


@router.delete("/{sc_id}", status_code=204)
async def delete_sub_calendar(
    cal_id: uuid.UUID,
    sc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(SubCalendar).where(SubCalendar.id == sc_id, SubCalendar.calendar_id == cal_id)
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Sous-calendrier introuvable")
    await db.delete(sc)
