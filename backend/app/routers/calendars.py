import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.user import User
from app.models.calendar import Calendar
from app.models.sub_calendar import SubCalendar
from app.models.access import CalendarAccess, Permission, group_members
from app.schemas.calendar import CalendarCreate, CalendarUpdate, CalendarOut, slugify
from app.routers.deps import get_current_user, get_superadmin_user

router = APIRouter(prefix="/calendars", tags=["calendars"])


@router.post("", response_model=CalendarOut, status_code=201)
async def create_calendar(
    data: CalendarCreate,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    # Auto-generate slug from title if not provided
    base_slug = data.slug or slugify(data.title)
    slug = base_slug
    for _ in range(10):
        exists = await db.scalar(select(Calendar.id).where(Calendar.slug == slug))
        if not exists:
            break
        slug = f"{base_slug}-{_uuid.uuid4().hex[:6]}"

    cal_data = data.model_dump(exclude={"slug"})
    calendar = Calendar(**cal_data, slug=slug, owner_id=current_user.id)
    db.add(calendar)
    await db.flush()
    default_sc = SubCalendar(calendar_id=calendar.id, name="Principal", color="#3788d8", position=0)
    db.add(default_sc)
    await db.refresh(calendar)
    return calendar


@router.get("/mine", response_model=list[CalendarOut])
async def list_my_calendars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return calendars owned by the current user."""
    result = await db.execute(
        select(Calendar).where(Calendar.owner_id == current_user.id).order_by(Calendar.created_at)
    )
    return result.scalars().all()


@router.get("/accessible", response_model=list[CalendarOut])
async def list_accessible_calendars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all calendars the user can access: owned + shared (directly or via group).
    Superadmin sees ALL calendars."""
    from app.config import settings

    is_superadmin = bool(settings.ADMIN_EMAIL and current_user.email == settings.ADMIN_EMAIL)

    if is_superadmin:
        result = await db.execute(select(Calendar).order_by(Calendar.created_at))
        return result.scalars().all()

    # Subquery: group IDs the user belongs to
    user_group_ids = select(group_members.c.group_id).where(
        group_members.c.user_id == current_user.id
    ).scalar_subquery()

    # Subquery: calendar IDs shared with the user (directly or via group), non-no_access
    shared_cal_ids = select(CalendarAccess.calendar_id).where(
        or_(
            CalendarAccess.user_id == current_user.id,
            CalendarAccess.group_id.in_(user_group_ids),
        ),
        CalendarAccess.permission != Permission.NO_ACCESS,
    ).scalar_subquery()

    result = await db.execute(
        select(Calendar)
        .where(or_(Calendar.owner_id == current_user.id, Calendar.id.in_(shared_cal_ids)))
        .order_by(Calendar.created_at)
    )
    return result.scalars().all()


@router.get("/slug/{slug}", response_model=CalendarOut)
async def get_calendar_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Calendar).where(Calendar.slug == slug))
    calendar = result.scalar_one_or_none()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    return calendar


@router.get("/{cal_id}", response_model=CalendarOut)
async def get_calendar(cal_id: _uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    calendar = result.scalar_one_or_none()
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    return calendar


@router.put("/{cal_id}", response_model=CalendarOut)
async def update_calendar(
    cal_id: _uuid.UUID,
    data: CalendarUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    calendar = result.scalar_one_or_none()
    if not calendar:
        raise HTTPException(status_code=404, detail="Introuvable")
    if calendar.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(calendar, field, value)
    await db.flush()
    await db.refresh(calendar)
    return calendar


@router.delete("/{cal_id}", status_code=204)
async def delete_calendar(
    cal_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    calendar = result.scalar_one_or_none()
    if not calendar:
        raise HTTPException(status_code=404, detail="Introuvable")
    if calendar.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès interdit")
    await db.delete(calendar)
