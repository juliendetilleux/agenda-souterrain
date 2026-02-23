from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

EXEMPT_PATHS = {
    "/v1/auth/login",
    "/v1/auth/register",
    "/v1/auth/forgot-password",
    "/v1/auth/reset-password",
    "/v1/auth/verify-email",
}


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in SAFE_METHODS:
            return await call_next(request)

        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        # No auth cookie → no session → skip CSRF check
        if not request.cookies.get("access_token"):
            return await call_next(request)

        cookie_csrf = request.cookies.get("csrf_token", "")
        header_csrf = request.headers.get("x-csrf-token", "")

        if not cookie_csrf or cookie_csrf != header_csrf:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token invalide"},
            )

        return await call_next(request)
