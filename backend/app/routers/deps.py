from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token


async def check_ban_status(user: User, db: AsyncSession, *, detailed: bool = False) -> None:
    """Check if user is banned. Lifts expired temporary bans.
    Raises HTTPException(403) if still banned.
    If detailed=True, includes ban expiry date in the error message.
    """
    if not user.is_banned:
        return
    if user.ban_until is not None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if now >= user.ban_until:
            user.is_banned = False
            user.ban_until = None
            user.ban_reason = None
            await db.flush()
            return
        if detailed:
            raise HTTPException(
                status_code=403,
                detail=f"Compte suspendu jusqu'au {user.ban_until.strftime('%d/%m/%Y %H:%M')}"
            )
        raise HTTPException(status_code=403, detail="Compte suspendu")
    raise HTTPException(status_code=403, detail="Compte définitivement suspendu" if detailed else "Compte suspendu")


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # Priority 1: HTTP-only cookie
    token = request.cookies.get("access_token")

    # Priority 2: Authorization header (backward compat / API clients)
    if not token:
        authorization = request.headers.get("authorization", "")
        if authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1]

    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token invalide")
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    await check_ban_status(user, db)

    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    token = request.cookies.get("access_token")
    authorization = request.headers.get("authorization", "")
    if not token and not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


async def get_link_token(token: Optional[str] = Query(None)) -> Optional[str]:
    """Reads ?token=XXX from query params (for access link authentication)."""
    return token


async def get_superadmin_user(current_user: User = Depends(get_current_user)) -> User:
    """Requires the caller to be the application superadmin (ADMIN_EMAIL)."""
    from app.config import settings
    if not settings.ADMIN_EMAIL or current_user.email != settings.ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Accès superadmin requis")
    return current_user


async def require_calendar_admin(
    cal_id, current_user: User, db: AsyncSession,
):
    """
    Allows access if the caller is:
    - the calendar owner
    - has CalendarAccess.permission = 'administrator' on this calendar
    - is an app admin (is_admin = True)
    - is the superadmin (ADMIN_EMAIL)
    """
    from app.config import settings
    from app.models.calendar import Calendar
    from app.utils.permissions import get_effective_permission, is_admin

    result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
    cal = result.scalar_one_or_none()
    if not cal:
        raise HTTPException(status_code=404, detail="Calendrier introuvable")
    is_superadmin = bool(settings.ADMIN_EMAIL and current_user.email == settings.ADMIN_EMAIL)
    if is_superadmin or current_user.is_admin:
        return cal
    perm = await get_effective_permission(db, cal_id, user=current_user)
    if not is_admin(perm):
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return cal
