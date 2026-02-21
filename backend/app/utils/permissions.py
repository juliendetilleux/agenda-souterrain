import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.access import Permission, CalendarAccess, AccessLink, group_members
from app.models.calendar import Calendar
from app.models.user import User

PERMISSION_ORDER = [
    Permission.NO_ACCESS,
    Permission.READ_ONLY_NO_DETAILS,
    Permission.READ_ONLY,
    Permission.ADD_ONLY,
    Permission.MODIFY_OWN,
    Permission.MODIFY,
    Permission.ADMINISTRATOR,
]


def permission_level(p: Permission) -> int:
    return PERMISSION_ORDER.index(p)


def highest_permission(perms: list[Permission]) -> Permission:
    if not perms:
        return Permission.NO_ACCESS
    return max(perms, key=permission_level)


def can_read(p: Permission) -> bool:
    return permission_level(p) >= permission_level(Permission.READ_ONLY)


def can_read_limited(p: Permission) -> bool:
    return permission_level(p) >= permission_level(Permission.READ_ONLY_NO_DETAILS)


def can_add(p: Permission) -> bool:
    return permission_level(p) >= permission_level(Permission.ADD_ONLY)


def can_modify(p: Permission) -> bool:
    return permission_level(p) >= permission_level(Permission.MODIFY)


def can_modify_own(p: Permission) -> bool:
    return permission_level(p) >= permission_level(Permission.MODIFY_OWN)


def is_admin(p: Permission) -> bool:
    return p == Permission.ADMINISTRATOR


async def get_effective_permission(
    db: AsyncSession,
    calendar_id: uuid.UUID,
    user: Optional[User] = None,
    link_token: Optional[str] = None,
    sub_calendar_id: Optional[uuid.UUID] = None,
) -> Permission:
    """
    Returns the highest applicable permission for this caller on this calendar.
    Resolution order:
      1. Calendar owner -> ADMINISTRATOR
      2. User-direct CalendarAccess entries
      3. Group-based CalendarAccess entries (via user's group memberships)
      4. AccessLink-based CalendarAccess entries (via link_token)
    Sub-calendar scope: entries with sub_calendar_id=NULL (global) OR exact match.
    """
    # 1. Owner -> ADMINISTRATOR
    if user:
        cal_result = await db.execute(select(Calendar).where(Calendar.id == calendar_id))
        cal = cal_result.scalar_one_or_none()
        if cal and cal.owner_id == user.id:
            return Permission.ADMINISTRATOR

    perms: list[Permission] = []

    # Sub-calendar scope filter
    sc_filter = or_(
        CalendarAccess.sub_calendar_id == None,  # noqa: E711
        CalendarAccess.sub_calendar_id == sub_calendar_id,
    )

    # 2. User-direct entries
    if user:
        result = await db.execute(
            select(CalendarAccess.permission).where(
                CalendarAccess.calendar_id == calendar_id,
                CalendarAccess.user_id == user.id,
                sc_filter,
            )
        )
        perms.extend(result.scalars().all())

        # 3. Group-based entries
        group_ids_result = await db.execute(
            select(group_members.c.group_id).where(group_members.c.user_id == user.id)
        )
        group_ids = [row[0] for row in group_ids_result.all()]
        if group_ids:
            result = await db.execute(
                select(CalendarAccess.permission).where(
                    CalendarAccess.calendar_id == calendar_id,
                    CalendarAccess.group_id.in_(group_ids),
                    sc_filter,
                )
            )
            perms.extend(result.scalars().all())

    # 4. AccessLink-based entries
    if link_token:
        link_result = await db.execute(
            select(AccessLink).where(
                AccessLink.token == link_token,
                AccessLink.active == True,  # noqa: E712
                AccessLink.calendar_id == calendar_id,
            )
        )
        link = link_result.scalar_one_or_none()
        if link:
            result = await db.execute(
                select(CalendarAccess.permission).where(
                    CalendarAccess.link_id == link.id,
                    sc_filter,
                )
            )
            perms.extend(result.scalars().all())

    return highest_permission(perms)
