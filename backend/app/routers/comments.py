import uuid
import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.event import Event
from app.models.comment import EventComment, EventAttachment
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut, AttachmentOut
from app.routers.deps import get_optional_user, get_current_user, get_link_token
from app.utils.permissions import (
    get_effective_permission, can_read, can_add, can_modify, Permission
)
from app.services.translation import translate_text, SUPPORTED_LANGS
from app.config import settings
from app.services.storage import storage

router = APIRouter(
    prefix="/calendars/{cal_id}/events/{event_id}",
    tags=["comments", "attachments"],
)

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip", "application/x-7z-compressed",
}


async def _get_event(event_id: uuid.UUID, db: AsyncSession) -> Event:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evenement introuvable")
    return event


# ─── COMMENTS ──────────────────────────────────────────────────────────────


@router.get("/comments", response_model=List[CommentOut])
async def list_comments(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Acces refuse")

    await _get_event(event_id, db)
    result = await db.execute(
        select(EventComment)
        .options(selectinload(EventComment.user))
        .where(EventComment.event_id == event_id)
        .order_by(EventComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        CommentOut(
            id=c.id, event_id=c.event_id, user_id=c.user_id,
            user_name=c.user.name, content=c.content,
            translations=c.translations, created_at=c.created_at,
        )
        for c in comments
    ]


@router.post("/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Acces refuse")

    await _get_event(event_id, db)
    comment = EventComment(
        event_id=event_id,
        user_id=user.id,
        content=data.content,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)

    return CommentOut(
        id=comment.id, event_id=comment.event_id, user_id=comment.user_id,
        user_name=user.name, content=comment.content,
        translations=comment.translations, created_at=comment.created_at,
    )


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    result = await db.execute(select(EventComment).where(EventComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")

    is_own = comment.user_id == user.id
    if not can_modify(perm) and not is_own:
        raise HTTPException(status_code=403, detail="Acces refuse")

    await db.delete(comment)


@router.post("/comments/{comment_id}/translate")
async def translate_comment(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    comment_id: uuid.UUID,
    target_lang: str = Query(...),
    source_lang: str = Query("fr"),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    if target_lang not in SUPPORTED_LANGS or source_lang not in SUPPORTED_LANGS:
        raise HTTPException(
            status_code=400,
            detail=f"Supported languages: {', '.join(sorted(SUPPORTED_LANGS))}"
        )

    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Acces refuse")

    result = await db.execute(select(EventComment).where(EventComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")

    # Check cache
    cached = comment.translations or {}
    if target_lang in cached:
        return cached[target_lang]

    # Translate
    try:
        translated_content = await translate_text(comment.content, source_lang, target_lang)
    except Exception:
        raise HTTPException(status_code=502, detail="Translation service unavailable")

    # Cache result
    translation = {"content": translated_content}
    new_translations = {**(comment.translations or {}), target_lang: translation}
    comment.translations = new_translations
    await db.flush()

    return translation


# ─── ATTACHMENTS ────────────────────────────────────────────────────────────


@router.get("/attachments", response_model=List[AttachmentOut])
async def list_attachments(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_read(perm):
        raise HTTPException(status_code=403, detail="Acces refuse")

    await _get_event(event_id, db)
    result = await db.execute(
        select(EventAttachment)
        .options(selectinload(EventAttachment.user))
        .where(EventAttachment.event_id == event_id)
        .order_by(EventAttachment.created_at.asc())
    )
    attachments = result.scalars().all()
    return [
        AttachmentOut(
            id=a.id, event_id=a.event_id, user_id=a.user_id,
            user_name=a.user.name, original_filename=a.original_filename,
            stored_filename=a.stored_filename, mime_type=a.mime_type,
            file_size=a.file_size, url=storage.url(a.stored_filename),
            created_at=a.created_at,
        )
        for a in attachments
    ]


@router.post("/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    if not can_add(perm):
        raise HTTPException(status_code=403, detail="Acces refuse")

    await _get_event(event_id, db)

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Type de fichier non autorise: {file.content_type}")

    # Read file content and check size
    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux (max {settings.MAX_FILE_SIZE_MB} Mo)"
        )

    # Generate unique stored filename
    ext = os.path.splitext(file.filename or "file")[1]
    stored_filename = f"{uuid.uuid4().hex}{ext}"

    # Write file via storage backend
    try:
        await storage.save(stored_filename, content, content_type=file.content_type or "application/octet-stream")
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde du fichier")

    attachment = EventAttachment(
        event_id=event_id,
        user_id=user.id,
        original_filename=file.filename or "file",
        stored_filename=stored_filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)

    return AttachmentOut(
        id=attachment.id, event_id=attachment.event_id, user_id=attachment.user_id,
        user_name=user.name, original_filename=attachment.original_filename,
        stored_filename=attachment.stored_filename, mime_type=attachment.mime_type,
        file_size=attachment.file_size, url=storage.url(attachment.stored_filename),
        created_at=attachment.created_at,
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    cal_id: uuid.UUID,
    event_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    link_token: Optional[str] = Depends(get_link_token),
):
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    result = await db.execute(select(EventAttachment).where(EventAttachment.id == attachment_id))
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    is_own = attachment.user_id == user.id
    if not can_modify(perm) and not is_own:
        raise HTTPException(status_code=403, detail="Acces refuse")

    # Delete file via storage backend
    await storage.delete(attachment.stored_filename)

    await db.delete(attachment)
