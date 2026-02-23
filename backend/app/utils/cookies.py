from fastapi.responses import JSONResponse
from app.config import settings


def set_auth_cookies(
    response: JSONResponse,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    domain = settings.COOKIE_DOMAIN or None

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=domain,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=domain,
        path="/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=domain,
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def clear_auth_cookies(response: JSONResponse) -> None:
    domain = settings.COOKIE_DOMAIN or None

    for name, path in [
        ("access_token", "/"),
        ("refresh_token", "/v1/auth"),
        ("csrf_token", "/"),
    ]:
        response.delete_cookie(key=name, domain=domain, path=path)
