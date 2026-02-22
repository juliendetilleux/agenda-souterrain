import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.access import PendingInvitation, CalendarAccess
from app.schemas.user import UserCreate, UserLogin, UserOut, Token, TokenRefresh, make_user_out
from app.utils.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.routers.deps import get_current_user
from app.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("20/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    user = User(
        email=data.email,
        name=data.name,
        hashed_password=get_password_hash(data.password),
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Apply any pending invitations for this email
    pending_result = await db.execute(
        select(PendingInvitation).where(PendingInvitation.email == data.email)
    )
    pending_invitations = pending_result.scalars().all()
    for inv in pending_invitations:
        access = CalendarAccess(
            calendar_id=inv.calendar_id,
            user_id=user.id,
            permission=inv.permission,
            sub_calendar_id=inv.sub_calendar_id,
        )
        db.add(access)
        await db.delete(inv)
    if pending_invitations:
        logger.info("Applied %d pending invitation(s) for %s", len(pending_invitations), data.email)

    return make_user_out(user)


@router.post("/login", response_model=Token)
@limiter.limit("20/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
async def refresh(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de rafraîchissement invalide")
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the current authenticated user with is_superadmin computed."""
    return make_user_out(current_user)
