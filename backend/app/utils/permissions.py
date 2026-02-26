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
    Optimized: 2-3 queries instead of 4-6.
    """
    # Sub-calendar scope filter
    sc_filter = or_(
        CalendarAccess.sub_calendar_id == None,  # noqa: E711
        CalendarAccess.sub_calendar_id == sub_calendar_id,
    )

    perms: list[Permission] = []

    # Query 1: Owner check + all user-based permissions (direct + group) in one query
    if user:
        # Owner check
        cal_result = await db.execute(
            select(Calendar.owner_id).where(Calendar.id == calendar_id)
        )
        owner_id = cal_result.scalar_one_or_none()
        if owner_id == user.id:
            return Permission.ADMINISTRATOR

        # Single query: direct user grants + group-based grants via subquery
        group_ids_subq = (
            select(group_members.c.group_id)
            .where(group_members.c.user_id == user.id)
            .correlate_except(group_members)
            .scalar_subquery()
        )

        result = await db.execute(
            select(CalendarAccess.permission).where(
                CalendarAccess.calendar_id == calendar_id,
                sc_filter,
                or_(
                    CalendarAccess.user_id == user.id,
                    CalendarAccess.group_id.in_(group_ids_subq),
                ),
            )
        )
        perms.extend(result.scalars().all())

    # Query 2 (only if link_token): link-based permissions
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
