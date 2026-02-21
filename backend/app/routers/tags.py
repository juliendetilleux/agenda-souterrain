import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.tag import Tag
from app.schemas.tag import TagCreate, TagUpdate, TagOut
from app.routers.deps import get_current_user, require_calendar_admin as _require_admin

router = APIRouter(prefix="/calendars/{cal_id}/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(cal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tag).where(Tag.calendar_id == cal_id).order_by(Tag.position)
    )
    return result.scalars().all()


@router.post("", response_model=TagOut, status_code=201)
async def create_tag(
    cal_id: uuid.UUID,
    data: TagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    tag = Tag(calendar_id=cal_id, **data.model_dump())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagOut)
async def update_tag(
    cal_id: uuid.UUID,
    tag_id: uuid.UUID,
    data: TagUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.calendar_id == cal_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Étiquette introuvable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tag, field, value)
    await db.flush()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    cal_id: uuid.UUID,
    tag_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.calendar_id == cal_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Étiquette introuvable")
    await db.delete(tag)
