import uuid
import logging
import secrets
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.calendar import Calendar
from app.models.access import AccessLink, CalendarAccess, Group, group_members, Permission, PendingInvitation
from app.models.sub_calendar import SubCalendar
from app.schemas.sharing import (
    AccessLinkCreate, AccessLinkUpdate, AccessLinkOut,
    CalendarAccessCreate, CalendarAccessOut, AccessUpdate,
    GroupCreate, GroupOut, GroupMemberOut,
    InviteUser, AddGroupMember, SetGroupAccess, MyPermissionOut,
    InviteResult, PendingInvitationOut,
    GroupAccessOut, ClaimLinkOut, GroupBrief, UserGroupMembership,
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
    # Batch-load permissions for all links in one query
    link_ids = [link.id for link in links]
    perm_map: dict[uuid.UUID, str] = {}
    if link_ids:
        perm_result = await db.execute(
            select(CalendarAccess.link_id, CalendarAccess.permission).where(
                CalendarAccess.link_id.in_(link_ids)
            )
        )
        for row in perm_result.all():
            if row.link_id not in perm_map:
                perm_map[row.link_id] = row.permission
    # Batch-load group names for links with group_id
    group_ids = {link.group_id for link in links if link.group_id}
    groups_map: dict[uuid.UUID, str] = {}
    if group_ids:
        g_result = await db.execute(select(Group).where(Group.id.in_(group_ids)))
        groups_map = {g.id: g.name for g in g_result.scalars().all()}
    out = []
    for link in links:
        out.append(AccessLinkOut(
            id=link.id, calendar_id=link.calendar_id, token=link.token,
            label=link.label, active=link.active, created_at=link.created_at,
            permission=perm_map.get(link.id),
            group_id=link.group_id,
            group_name=groups_map.get(link.group_id) if link.group_id else None,
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
    # Validate group_id belongs to this calendar if provided
    group_name = None
    if data.group_id:
        g_result = await db.execute(
            select(Group).where(Group.id == data.group_id, Group.calendar_id == cal_id)
        )
        group = g_result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Groupe introuvable")
        group_name = group.name
    link = AccessLink(
        calendar_id=cal_id, token=secrets.token_urlsafe(32),
        label=data.label, group_id=data.group_id,
    )
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
        permission=data.permission, group_id=link.group_id, group_name=group_name,
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
    if data.group_id is not None:
        # Validate group_id belongs to this calendar
        if str(data.group_id) == "00000000-0000-0000-0000-000000000000":
            link.group_id = None  # special value to unset
        else:
            g_result = await db.execute(
                select(Group).where(Group.id == data.group_id, Group.calendar_id == cal_id)
            )
            if not g_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Groupe introuvable")
            link.group_id = data.group_id
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
    # Resolve group name
    group_name = None
    if link.group_id:
        gn_result = await db.execute(select(Group.name).where(Group.id == link.group_id))
        group_name = gn_result.scalar_one_or_none()
    return AccessLinkOut(
        id=link.id, calendar_id=link.calendar_id, token=link.token,
        label=link.label, active=link.active, created_at=link.created_at,
        permission=perm, group_id=link.group_id, group_name=group_name,
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

    # Batch-load users and groups to avoid N+1 queries
    user_ids = {e.user_id for e in entries if e.user_id}
    group_ids = {e.group_id for e in entries if e.group_id}
    users_map: dict[uuid.UUID, User] = {}
    groups_map: dict[uuid.UUID, Group] = {}
    if user_ids:
        u_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in u_result.scalars().all()}
    if group_ids:
        g_result = await db.execute(select(Group).where(Group.id.in_(group_ids)))
        groups_map = {g.id: g for g in g_result.scalars().all()}

    out = []
    for entry in entries:
        user_email = user_name = group_name = None
        if entry.user_id and entry.user_id in users_map:
            u = users_map[entry.user_id]
            user_email, user_name = u.email, u.name
        if entry.group_id and entry.group_id in groups_map:
            group_name = groups_map[entry.group_id].name
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cal = await _require_admin(cal_id, current_user, db)

    # Check if the target user already has an account
    result = await db.execute(select(User).where(User.email == data.email))
    target = result.scalar_one_or_none()

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

        email_sent = False
        if cal.enable_email_notifications:
            background_tasks.add_task(
                send_invitation_email,
                recipient_email=target.email,
                recipient_name=target.name,
                inviter_name=current_user.name or current_user.email,
                calendar_title=cal.title,
                permission=data.permission.value,
                language=cal.language,
                user_exists=True,
            )
            email_sent = True

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

        email_sent = False
        if cal.enable_email_notifications:
            background_tasks.add_task(
                send_invitation_email,
                recipient_email=data.email,
                recipient_name=None,
                inviter_name=current_user.name or current_user.email,
                calendar_title=cal.title,
                permission=data.permission.value,
                language=cal.language,
                user_exists=False,
            )
            email_sent = True

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
        u_result = await db.execute(select(User).where(User.id == access.user_id))
        u = u_result.scalar_one_or_none()
        if u:
            user_email, user_name = u.email, u.name
    if access.group_id:
        g_result = await db.execute(select(Group).where(Group.id == access.group_id))
        g = g_result.scalar_one_or_none()
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


@router.get("/groups/{group_id}/access", response_model=list[GroupAccessOut])
async def list_group_access(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(CalendarAccess).where(
            CalendarAccess.calendar_id == cal_id,
            CalendarAccess.group_id == group_id,
        )
    )
    entries = result.scalars().all()
    # Batch-load sub-calendar names
    sub_cal_ids = {e.sub_calendar_id for e in entries if e.sub_calendar_id}
    sc_map: dict[uuid.UUID, str] = {}
    if sub_cal_ids:
        sc_result = await db.execute(select(SubCalendar).where(SubCalendar.id.in_(sub_cal_ids)))
        sc_map = {sc.id: sc.name for sc in sc_result.scalars().all()}
    return [
        GroupAccessOut(
            id=e.id, permission=e.permission,
            sub_calendar_id=e.sub_calendar_id,
            sub_calendar_name=sc_map.get(e.sub_calendar_id) if e.sub_calendar_id else None,
        )
        for e in entries
    ]


@router.delete("/groups/{group_id}/access/{access_id}", status_code=204)
async def delete_group_access(
    cal_id: uuid.UUID,
    group_id: uuid.UUID,
    access_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    result = await db.execute(
        select(CalendarAccess).where(
            CalendarAccess.id == access_id,
            CalendarAccess.group_id == group_id,
        )
    )
    acc = result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Introuvable")
    await db.delete(acc)


# ─── Claim link (auto-join group) ─────────────────────────────────────────────

@router.post("/claim-link", response_model=ClaimLinkOut)
async def claim_link(
    cal_id: uuid.UUID,
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AccessLink).where(
            AccessLink.calendar_id == cal_id,
            AccessLink.token == token,
            AccessLink.active == True,  # noqa: E712
        )
    )
    link = result.scalar_one_or_none()
    if not link or not link.group_id:
        raise HTTPException(status_code=404, detail="Lien invalide ou sans groupe associé")
    # Check if already a member
    existing = await db.execute(
        select(group_members).where(
            group_members.c.group_id == link.group_id,
            group_members.c.user_id == current_user.id,
        )
    )
    group_result = await db.execute(select(Group).where(Group.id == link.group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    if existing.first():
        return ClaimLinkOut(group_id=group.id, group_name=group.name)
    # Add user to group
    await db.execute(group_members.insert().values(group_id=link.group_id, user_id=current_user.id))
    return ClaimLinkOut(group_id=group.id, group_name=group.name)


# ─── Group memberships (bulk) ─────────────────────────────────────────────────

@router.get("/group-memberships", response_model=list[UserGroupMembership])
async def list_group_memberships(
    cal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(cal_id, current_user, db)
    # Get all groups for this calendar
    groups_result = await db.execute(select(Group).where(Group.calendar_id == cal_id))
    groups = groups_result.scalars().all()
    group_ids = [g.id for g in groups]
    if not group_ids:
        return []
    groups_map = {g.id: g.name for g in groups}
    # Get all memberships in one query
    members_result = await db.execute(
        select(group_members.c.user_id, group_members.c.group_id).where(
            group_members.c.group_id.in_(group_ids)
        )
    )
    # Build user_id → list of groups
    user_groups: dict[uuid.UUID, list[GroupBrief]] = {}
    for row in members_result.all():
        uid = row.user_id
        if uid not in user_groups:
            user_groups[uid] = []
        user_groups[uid].append(GroupBrief(id=row.group_id, name=groups_map[row.group_id]))
    return [
        UserGroupMembership(user_id=uid, groups=grps)
        for uid, grps in user_groups.items()
    ]


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
