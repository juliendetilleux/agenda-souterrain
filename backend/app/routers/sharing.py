import uuid
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.calendar import Calendar
from app.models.access import AccessLink, CalendarAccess, Group, group_members, Permission, PendingInvitation
from app.schemas.sharing import (
    AccessLinkCreate, AccessLinkUpdate, AccessLinkOut,
    CalendarAccessCreate, CalendarAccessOut, AccessUpdate,
    GroupCreate, GroupOut, GroupMemberOut,
    InviteUser, AddGroupMember, SetGroupAccess, MyPermissionOut,
    InviteResult, PendingInvitationOut,
)
from app.routers.deps import get_current_user, get_optional_user, get_link_token, require_calendar_admin
from app.utils.permissions import get_effective_permission, is_admin
from app.services.email import send_invitation_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendars/{cal_id}", tags=["sharing"])

# Alias for local usage
_require_admin = require_calendar_admin


async def _find_user_by_email(email: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"Utilisateur '{email}' introuvable")
    return user


# ─── My permission ─────────────────────────────────────────────────────────────

@router.get("/my-permission", response_model=MyPermissionOut)
async def get_my_permission(
    cal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
    link_token: str | None = Depends(get_link_token),
):
    cal_result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    cal = cal_result.scalar_one_or_none()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    is_owner = bool(user and cal.owner_id == user.id)
    perm = await get_effective_permission(db, cal_id, user=user, link_token=link_token)
    return MyPermissionOut(permission=perm, is_owner=is_owner)


# ─── Access links ──────────────────────────────────────────────────────────────

@router.get("/links", response_model=list[AccessLinkOut])
async def list_links(
    cal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(AccessLink).where(AccessLink.calendar_id == cal_id))
    links = result.scalars().all()
    out = []
    for link in links:
        perm_result = await db.execute(
            select(CalendarAccess.permission).where(CalendarAccess.link_id == link.id).limit(1)
        )
        perm = perm_result.scalar_one_or_none()
        out.append(AccessLinkOut(
            id=link.id, calendar_id=link.calendar_id, token=link.token,
            label=link.label, active=link.active, created_at=link.created_at,
            permission=perm,
        ))
    return out


@router.post("/links", response_model=AccessLinkOut, status_code=201)
async def create_link(
    cal_id: uuid.UUID,
    data: AccessLinkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    link = AccessLink(calendar_id=cal_id, token=secrets.token_urlsafe(32), label=data.label)
    db.add(link)
    await db.flush()
    access = CalendarAccess(
        calendar_id=cal_id, link_id=link.id,
        permission=data.permission, sub_calendar_id=data.sub_calendar_id,
    )
    db.add(access)
    await db.flush()
    await db.refresh(link)
    return AccessLinkOut(
        id=link.id, calendar_id=link.calendar_id, token=link.token,
        label=link.label, active=link.active, created_at=link.created_at,
        permission=data.permission,
    )


@router.put("/links/{link_id}", response_model=AccessLinkOut)
async def update_link(
    cal_id: uuid.UUID,
    link_id: uuid.UUID,
    data: AccessLinkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(AccessLink).where(AccessLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Introuvable")
    if data.label is not None:
        link.label = data.label
    if data.active is not None:
        link.active = data.active
    if data.permission is not None:
        acc_result = await db.execute(
            select(CalendarAccess).where(CalendarAccess.link_id == link_id).limit(1)
        )
        acc = acc_result.scalar_one_or_none()
        if acc:
            acc.permission = data.permission
    await db.flush()
    await db.refresh(link)
    perm_result = await db.execute(
        select(CalendarAccess.permission).where(CalendarAccess.link_id == link.id).limit(1)
    )
    perm = perm_result.scalar_one_or_none()
    return AccessLinkOut(
        id=link.id, calendar_id=link.calendar_id, token=link.token,
        label=link.label, active=link.active, created_at=link.created_at, permission=perm,
    )


@router.delete("/links/{link_id}", status_code=204)
async def delete_link(
    cal_id: uuid.UUID,
    link_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(AccessLink).where(AccessLink.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Introuvable")
    acc_result = await db.execute(select(CalendarAccess).where(CalendarAccess.link_id == link_id))
    for acc in acc_result.scalars().all():
        await db.delete(acc)
    await db.delete(link)


# ─── User access ───────────────────────────────────────────────────────────────

@router.get("/access", response_model=list[CalendarAccessOut])
async def list_access(
    cal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(CalendarAccess).where(
            CalendarAccess.calendar_id == cal_id,
            CalendarAccess.link_id == None,  # noqa: E711
        )
    )
    entries = result.scalars().all()
    out = []
    for entry in entries:
        user_email = user_name = group_name = None
        if entry.user_id:
            u = await db.get(User, entry.user_id)
            if u:
                user_email, user_name = u.email, u.name
        if entry.group_id:
            g = await db.get(Group, entry.group_id)
            if g:
                group_name = g.name
        out.append(CalendarAccessOut(
            id=entry.id, sub_calendar_id=entry.sub_calendar_id,
            user_id=entry.user_id, group_id=entry.group_id, link_id=entry.link_id,
            permission=entry.permission,
            user_email=user_email, user_name=user_name, group_name=group_name,
        ))
    return out


@router.post("/invite", response_model=InviteResult, status_code=201)
async def invite_user(
    cal_id: uuid.UUID,
    data: InviteUser,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cal = await _require_admin(cal_id, current_user, db)

    # Check if the target user already has an account
    result = await db.execute(select(User).where(User.email == data.email))
    target = result.scalar_one_or_none()

    email_sent = False

    if target:
        # User exists — create CalendarAccess directly
        existing = await db.execute(
            select(CalendarAccess).where(
                CalendarAccess.calendar_id == cal_id,
                CalendarAccess.user_id == target.id,
                CalendarAccess.sub_calendar_id == data.sub_calendar_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Cet utilisateur a déjà un accès")
        access = CalendarAccess(
            calendar_id=cal_id, user_id=target.id,
            permission=data.permission, sub_calendar_id=data.sub_calendar_id,
        )
        db.add(access)
        await db.flush()

        if cal.enable_email_notifications:
            email_sent = await send_invitation_email(
                recipient_email=target.email,
                recipient_name=target.name,
                inviter_name=current_user.name or current_user.email,
                calendar_title=cal.title,
                permission=data.permission.value,
                language=cal.language,
                user_exists=True,
            )

        return InviteResult(
            status="added", email=target.email,
            permission=data.permission, email_sent=email_sent,
        )
    else:
        # User does NOT exist — create PendingInvitation
        existing = await db.execute(
            select(PendingInvitation).where(
                PendingInvitation.calendar_id == cal_id,
                PendingInvitation.email == data.email,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Une invitation est déjà en attente pour cet email")
        pending = PendingInvitation(
            calendar_id=cal_id, email=data.email,
            permission=data.permission, sub_calendar_id=data.sub_calendar_id,
            invited_by=current_user.id,
        )
        db.add(pending)
        await db.flush()

        if cal.enable_email_notifications:
            email_sent = await send_invitation_email(
                recipient_email=data.email,
                recipient_name=None,
                inviter_name=current_user.name or current_user.email,
                calendar_title=cal.title,
                permission=data.permission.value,
                language=cal.language,
                user_exists=False,
            )

        return InviteResult(
            status="pending", email=data.email,
            permission=data.permission, email_sent=email_sent,
        )


@router.get("/pending-invitations", response_model=list[PendingInvitationOut])
async def list_pending_invitations(
    cal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(PendingInvitation).where(PendingInvitation.calendar_id == cal_id)
    )
    return result.scalars().all()


@router.delete("/pending-invitations/{invitation_id}", status_code=204)
async def delete_pending_invitation(
    cal_id: uuid.UUID,
    invitation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(PendingInvitation).where(PendingInvitation.id == invitation_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable")
    await db.delete(inv)


@router.put("/access/{access_id}", response_model=CalendarAccessOut)
async def update_access(
    cal_id: uuid.UUID,
    access_id: uuid.UUID,
    data: AccessUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(CalendarAccess).where(CalendarAccess.id == access_id))
    access = result.scalar_one_or_none()
    if not access:
        raise HTTPException(status_code=404, detail="Introuvable")
    access.permission = data.permission
    await db.flush()
    user_email = user_name = group_name = None
    if access.user_id:
        u = await db.get(User, access.user_id)
        if u:
            user_email, user_name = u.email, u.name
    if access.group_id:
        g = await db.get(Group, access.group_id)
        if g:
            group_name = g.name
    return CalendarAccessOut(
        id=access.id, sub_calendar_id=access.sub_calendar_id,
        user_id=access.user_id, group_id=access.group_id, link_id=access.link_id,
        permission=access.permission, user_email=user_email, user_name=user_name,
        group_name=group_name,
    )


@router.delete("/access/{access_id}", status_code=204)
async def delete_access(
    cal_id: uuid.UUID,
    access_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(CalendarAccess).where(CalendarAccess.id == access_id))
    access = result.scalar_one_or_none()
    if not access:
        raise HTTPException(status_code=404, detail="Introuvable")
    await db.delete(access)


# ─── Groups ────────────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[GroupOut])
async def list_groups(
    cal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(Group).where(Group.calendar_id == cal_id))
    return result.scalars().all()


@router.post("/groups", response_model=GroupOut, status_code=201)
async def create_group(
    cal_id: uuid.UUID,
    data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    group = Group(calendar_id=cal_id, name=data.name)
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Introuvable")
    acc_result = await db.execute(select(CalendarAccess).where(CalendarAccess.group_id == group_id))
    for acc in acc_result.scalars().all():
        await db.delete(acc)
    await db.delete(group)


@router.get("/groups/{group_id}/members", response_model=list[GroupMemberOut])
async def list_group_members(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(User).join(group_members, User.id == group_members.c.user_id).where(
            group_members.c.group_id == group_id
        )
    )
    return result.scalars().all()


@router.post("/groups/{group_id}/members", response_model=GroupMemberOut, status_code=201)
async def add_group_member(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    data: AddGroupMember,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    target = await _find_user_by_email(data.email, db)
    existing = await db.execute(
        select(group_members).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == target.id,
        )
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Déjà membre du groupe")
    await db.execute(group_members.insert().values(group_id=group_id, user_id=target.id))
    return GroupMemberOut(id=target.id, email=target.email, name=target.name)


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_group_member(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    await db.execute(
        group_members.delete().where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )


@router.post("/groups/{group_id}/access", response_model=CalendarAccessOut, status_code=201)
async def set_group_access(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    data: SetGroupAccess,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    existing = await db.execute(
        select(CalendarAccess).where(
            CalendarAccess.calendar_id == cal_id,
            CalendarAccess.group_id == group_id,
            CalendarAccess.sub_calendar_id == data.sub_calendar_id,
        )
    )
    acc = existing.scalar_one_or_none()
    if acc:
        acc.permission = data.permission
    else:
        acc = CalendarAccess(
            calendar_id=cal_id, group_id=group_id,
            permission=data.permission, sub_calendar_id=data.sub_calendar_id,
        )
        db.add(acc)
    await db.flush()
    if not acc.id:
        await db.refresh(acc)
    return CalendarAccessOut(
        id=acc.id, sub_calendar_id=acc.sub_calendar_id,
        user_id=None, group_id=group_id, link_id=None,
        permission=acc.permission, group_name=group.name,
    )


# ─── Legacy ────────────────────────────────────────────────────────────────────

@router.post("/access", response_model=CalendarAccessOut, status_code=201)
async def set_access(
    cal_id: uuid.UUID,
    data: CalendarAccessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    access = CalendarAccess(calendar_id=cal_id, **data.model_dump())
    db.add(access)
    await db.flush()
    await db.refresh(access)
    return CalendarAccessOut(
        id=access.id, sub_calendar_id=access.sub_calendar_id,
        user_id=access.user_id, group_id=access.group_id, link_id=access.link_id,
        permission=access.permission,
    )
