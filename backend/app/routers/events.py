import uuid
import os
import secrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete as sa_delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.event import Event, EventSignup
from app.models.comment import EventAttachment
from app.models.sub_calendar import SubCalendar
from app.models.calendar import Calendar
from app.models.user import User
from app.models.tag import Tag, event_tags
from app.schemas.event import EventCreate, EventUpdate, EventOut, SignupCreate, SignupOut
from app.routers.deps import get_optional_user, get_link_token
from app.utils.ical import event_to_ical, events_to_ical
from app.utils.permissions import (
    get_effective_permission, can_read_limited, can_read, can_add,
    can_modify, can_modify_own, Permission
)
from app.services.translation import translate_text, SUPPORTED_LANGS
from app.config import settings
from app.services.storage import storage

router = APIRouter(prefix="/calendars/{cal_id}/events", tags=["events"])


async def _get_cal(cal_id: uuid.UUID, db: AsyncSession) -> Calendar:
    result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    cal = result.scalar_one_or_none()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    return cal


@router.get("", response_model=List[EventOut])
async def list_events(
    cal_id: uuid.UUID,
    start_dt: Optional[datetime] = Query(None),
    end_dt: Optional[datetime] = Query(None),
    subcalendar_ids: Optional[List[uuid.UUID]] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read_limited(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    await _get_cal(cal_id, db)
    sc_result = await db.execute(select(SubCalendar.id).where(SubCalendar.calendar_id == cal_id))
    sc_ids = [row[0] for row in sc_result.all()]

    def naive(dt: datetime) -> datetime:
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt and dt.tzinfo else dt

    base_filters = [Event.sub_calendar_id.in_(sc_ids)]
    if subcalendar_ids:
        base_filters.append(Event.sub_calendar_id.in_(subcalendar_ids))

    date_filters = []
    if start_dt:
        date_filters.append(Event.end_dt >= naive(start_dt))
    if end_dt:
        date_filters.append(Event.start_dt <= naive(end_dt))

    if date_filters:
        normal_match = and_(*base_filters, *date_filters)
        # Recurring events whose start_dt <= end of window are always included
        recur_filter = and_(*base_filters, Event.rrule.isnot(None))
        if end_dt:
            recur_filter = and_(recur_filter, Event.start_dt <= naive(end_dt))
        final_filter = or_(normal_match, recur_filter)
    else:
        final_filter = and_(*base_filters)

    result = await db.execute(
        select(Event).options(selectinload(Event.tags)).where(final_filter).order_by(Event.start_dt)
    )
    events = result.scalars().all()

    # Mask details for read_only_no_details
    if perm == Permission.READ_ONLY_NO_DETAILS:
        masked = []
        for e in events:
            e.title = "Occupé"
            e.location = None
            e.notes = None
            e.who = None
            e.rrule = None
            e.custom_fields = {}
            masked.append(e)
        return masked

    return events


def _escape_like(term: str) -> str:
    """Escape special LIKE/ILIKE characters."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/search", response_model=List[EventOut])
async def search_events(
    cal_id: uuid.UUID,
    q: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    await _get_cal(cal_id, db)
    sc_result = await db.execute(select(SubCalendar.id).where(SubCalendar.calendar_id == cal_id))
    sc_ids = [row[0] for row in sc_result.all()]
    result = await db.execute(
        select(Event).options(selectinload(Event.tags)).where(
            and_(
                Event.sub_calendar_id.in_(sc_ids),
                or_(
                    Event.title.ilike(f"%{_escape_like(q)}%"),
                    Event.location.ilike(f"%{_escape_like(q)}%"),
                    Event.notes.ilike(f"%{_escape_like(q)}%"),
                ),
            )
        )
    )
    return result.scalars().all()


@router.get("/export.ics")
async def export_calendar_ical(
    cal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    await _get_cal(cal_id, db)
    sc_result = await db.execute(select(SubCalendar.id).where(SubCalendar.calendar_id == cal_id))
    sc_ids = [row[0] for row in sc_result.all()]

    result = await db.execute(select(Event).where(Event.sub_calendar_id.in_(sc_ids)).order_by(Event.start_dt))
    events = list(result.scalars().all())

    return Response(
        content=events_to_ical(events),
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=calendar.ics"},
    )


@router.get("/{event_id}", response_model=EventOut)
async def get_event(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read_limited(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    sc_result = await db.execute(select(SubCalendar.id).where(SubCalendar.calendar_id == cal_id))
    sc_ids = [row[0] for row in sc_result.all()]
    result = await db.execute(
        select(Event).options(selectinload(Event.tags)).where(
            Event.id == event_id, Event.sub_calendar_id.in_(sc_ids)
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return event


@router.get("/{event_id}/ics")
async def export_event_ical(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    sc_result = await db.execute(select(SubCalendar.id).where(SubCalendar.calendar_id == cal_id))
    sc_ids = [row[0] for row in sc_result.all()]
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.sub_calendar_id.in_(sc_ids))
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return Response(content=event_to_ical(event), media_type="text/calendar")


@router.post("", response_model=EventOut, status_code=201)
async def create_event(
    cal_id: uuid.UUID,
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(
        db, cal_id, user=user, link_token=link_token,
        sub_calendar_id=data.sub_calendar_id,
    )
    if not can_add(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    await _get_cal(cal_id, db)
    sc_result = await db.execute(
        select(SubCalendar).where(
            SubCalendar.id == data.sub_calendar_id,
            SubCalendar.calendar_id == cal_id,
        )
    )
    if not sc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sous-calendrier introuvable dans ce calendrier")

    creator_user_id = user.id if user else None
    tag_ids = data.tag_ids
    event_data = data.model_dump(exclude={"tag_ids"})
    event = Event(
        **event_data,
        creator_token=secrets.token_urlsafe(32),
        creator_user_id=creator_user_id,
    )
    db.add(event)
    await db.flush()

    if tag_ids:
        # Validate tags exist in this calendar
        tag_result = await db.execute(
            select(Tag.id).where(Tag.id.in_(tag_ids), Tag.calendar_id == cal_id)
        )
        valid_tag_ids = [row[0] for row in tag_result.all()]
        for tid in valid_tag_ids:
            await db.execute(event_tags.insert().values(event_id=event.id, tag_id=tid))
        await db.flush()

    # Re-fetch with tags eager-loaded
    result = await db.execute(
        select(Event).options(selectinload(Event.tags)).where(Event.id == event.id)
    )
    return result.scalar_one()


@router.put("/{event_id}", response_model=EventOut)
async def update_event(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    perm = await get_effective_permission(
        db, cal_id, user=user, link_token=link_token,
        sub_calendar_id=event.sub_calendar_id,
    )

    is_own = user and event.creator_user_id == user.id
    if not can_modify(perm) and not (can_modify_own(perm) and is_own):
        raise HTTPException(status_code=403, detail="Accès refusé")

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)

    # Invalidate translation cache if title or notes changed
    if "title" in update_data or "notes" in update_data:
        event.translations = {}

    for field, value in update_data.items():
        setattr(event, field, value)
    event.update_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    if tag_ids is not None:
        # Clear existing tags
        await db.execute(
            sa_delete(event_tags).where(event_tags.c.event_id == event.id)
        )
        # Add new tags
        tag_result = await db.execute(
            select(Tag.id).where(Tag.id.in_(tag_ids), Tag.calendar_id == cal_id)
        )
        valid_tag_ids = [row[0] for row in tag_result.all()]
        for tid in valid_tag_ids:
            await db.execute(event_tags.insert().values(event_id=event.id, tag_id=tid))

    await db.flush()

    # Re-fetch with tags eager-loaded
    result2 = await db.execute(
        select(Event).options(selectinload(Event.tags)).where(Event.id == event.id)
    )
    return result2.scalar_one()


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    perm = await get_effective_permission(
        db, cal_id, user=user, link_token=link_token,
        sub_calendar_id=event.sub_calendar_id,
    )

    is_own = user and event.creator_user_id == user.id
    if not can_modify(perm) and not (can_modify_own(perm) and is_own):
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Delete attachment files before cascade-deleting DB rows
    att_result = await db.execute(
        select(EventAttachment).where(EventAttachment.event_id == event_id)
    )
    for att in att_result.scalars().all():
        await storage.delete(att.stored_filename)

    await db.delete(event)


@router.post("/{event_id}/translate")
async def translate_event(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    target_lang: str = Query(...),
    source_lang: str = Query("fr"),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    """Translate event title and notes to target language using LibreTranslate."""
    if target_lang not in SUPPORTED_LANGS or source_lang not in SUPPORTED_LANGS:
        raise HTTPException(status_code=400, detail=f"Supported languages: {', '.join(sorted(SUPPORTED_LANGS))}")

    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    # Check cache
    cached = event.translations or {}
    if target_lang in cached:
        return cached[target_lang]

    # Translate
    try:
        translated_title = await translate_text(event.title, source_lang, target_lang)
        translated_notes = await translate_text(event.notes or "", source_lang, target_lang) if event.notes else ""
    except Exception:
        raise HTTPException(status_code=502, detail="Translation service unavailable")

    # Cache result
    translation = {"title": translated_title, "notes": translated_notes}
    if not event.translations:
        event.translations = {}
    # SQLAlchemy needs a new dict to detect JSON mutation
    new_translations = {**event.translations, target_lang: translation}
    event.translations = new_translations
    await db.flush()

    return translation


@router.get("/{event_id}/signups", response_model=List[SignupOut])
async def list_signups(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")
    result = await db.execute(select(EventSignup).where(EventSignup.event_id == event_id))
    return result.scalars().all()


@router.post("/{event_id}/signups", response_model=SignupOut, status_code=201)
async def create_signup(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    data: SignupCreate,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read_limited(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")

    ev_result = await db.execute(select(Event).where(Event.id == event_id))
    event = ev_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    if not event.signup_enabled:
        raise HTTPException(status_code=400, detail="Les inscriptions ne sont pas activées pour cet événement")
    # Anti-duplicate: check if this email is already signed up
    dup_result = await db.execute(
        select(EventSignup).where(EventSignup.event_id == event_id, EventSignup.email == data.email)
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cette adresse email est déjà inscrite")
    if event.signup_max:
        count_result = await db.execute(
            select(func.count()).select_from(EventSignup).where(EventSignup.event_id == event_id)
        )
        if count_result.scalar() >= event.signup_max:
            raise HTTPException(status_code=400, detail="Événement complet")
    signup = EventSignup(event_id=event_id, **data.model_dump())
    db.add(signup)
    await db.flush()
    await db.refresh(signup)
    return signup


@router.delete("/{event_id}/signups/{signup_id}", status_code=204)
async def delete_signup(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    signup_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_modify(perm):
        raise HTTPException(status_code=403, detail="Accès refusé")
    result = await db.execute(select(EventSignup).where(EventSignup.id == signup_id))
    signup = result.scalar_one_or_none()
    if not signup:
        raise HTTPException(status_code=404, detail="Inscription introuvable")
    await db.delete(signup)
