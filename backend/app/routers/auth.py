import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.user import User
from app.models.access import PendingInvitation, CalendarAccess
from app.schemas.user import (
    UserCreate, UserLogin, UserOut, Token, TokenRefresh,
    ForgotPasswordRequest, ResetPasswordRequest, make_user_out,
)
from app.utils.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    create_verification_token, create_password_reset_token,
    generate_csrf_token, decode_token,
)
from app.utils.cookies import set_auth_cookies, clear_auth_cookies
from app.routers.deps import get_current_user
from app.rate_limit import limiter
from app.services.email import send_verification_email, send_password_reset_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("20/minute")
async def register(
    request: Request,
    data: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    user = User(
        email=data.email,
        name=data.name,
        hashed_password=get_password_hash(data.password),
        is_verified=False,
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

    # Send verification email
    token = create_verification_token(str(user.id))
    background_tasks.add_task(send_verification_email, email=user.email, name=user.name, token=token)

    return make_user_out(user)


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verification":
        raise HTTPException(status_code=400, detail="Token de vérification invalide ou expiré")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if user.is_verified:
        return {"message": "Email déjà vérifié"}

    user.is_verified = True
    await db.flush()
    return {"message": "Email vérifié avec succès"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    if current_user.is_verified:
        raise HTTPException(status_code=400, detail="Email déjà vérifié")

    token = create_verification_token(str(current_user.id))
    background_tasks.add_task(
        send_verification_email,
        email=current_user.email,
        name=current_user.name,
        token=token,
    )
    return {"message": "Email de vérification renvoyé"}


@router.post("/login")
@limiter.limit("20/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    # Ban check
    if user.is_banned:
        if user.ban_until is not None:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if now >= user.ban_until:
                user.is_banned = False
                user.ban_until = None
                user.ban_reason = None
                await db.flush()
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Compte suspendu jusqu'au {user.ban_until.strftime('%d/%m/%Y %H:%M')}"
                )
        else:
            raise HTTPException(status_code=403, detail="Compte définitivement suspendu")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    csrf_token = generate_csrf_token()

    user_out = make_user_out(user)
    response = JSONResponse(content=user_out.model_dump(mode="json"))
    set_auth_cookies(response, access_token, refresh_token, csrf_token)
    return response


@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token de rafraîchissement manquant")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de rafraîchissement invalide")
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    # Ban check on refresh
    if user.is_banned:
        if user.ban_until is not None:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if now >= user.ban_until:
                user.is_banned = False
                user.ban_until = None
                user.ban_reason = None
                await db.flush()
            else:
                raise HTTPException(status_code=403, detail="Compte suspendu")
        else:
            raise HTTPException(status_code=403, detail="Compte suspendu")

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    csrf_token = generate_csrf_token()

    user_out = make_user_out(user)
    response = JSONResponse(content=user_out.model_dump(mode="json"))
    set_auth_cookies(response, access_token, new_refresh, csrf_token)
    return response


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "ok"})
    clear_auth_cookies(response)
    return response


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send a password reset email. Always returns 200 to not reveal if the email exists."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        token = create_password_reset_token(str(user.id))
        background_tasks.add_task(send_password_reset_email, email=user.email, token=token)

    return {"message": "Si cette adresse est enregistrée, un email a été envoyé."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(data.token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    user.hashed_password = get_password_hash(data.password)
    await db.flush()
    return {"message": "Mot de passe réinitialisé avec succès"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the current authenticated user with is_superadmin computed."""
    return make_user_out(current_user)
