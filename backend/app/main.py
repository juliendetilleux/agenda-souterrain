import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.config import settings
from app.database import get_db
from app.rate_limit import limiter
from app.routers import auth, calendars, sub_calendars, events, sharing, admin, tags, comments, uploads
from app.services.email import log_email_status
from app.middleware.csrf import CSRFMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup & shutdown logic."""
    # ── Startup ──
    log_email_status()
    ping_task = None
    if settings.SELF_PING_URL:
        async def _ping_loop():
            await asyncio.sleep(60)
            while True:
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        await client.get(settings.SELF_PING_URL)
                except Exception:
                    pass
                await asyncio.sleep(300)
        ping_task = asyncio.create_task(_ping_loop())

    yield

    # ── Shutdown ──
    if ping_task:
        ping_task.cancel()


app = FastAPI(title="Agenda Souterrain API", version="1.0.0", docs_url="/docs", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(CSRFMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(calendars.router, prefix="/v1")
app.include_router(sub_calendars.router, prefix="/v1")
app.include_router(events.router, prefix="/v1")
app.include_router(sharing.router, prefix="/v1")
app.include_router(tags.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")
app.include_router(comments.router, prefix="/v1")
app.include_router(uploads.router, prefix="/v1")


@app.get("/")
async def root():
    return {"message": "Agenda Souterrain API", "version": "1.0.0"}


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "unreachable"
    return {
        "status": "ok" if db_status == "ok" else "error",
        "db": db_status,
        "admin_email_set": bool(settings.ADMIN_EMAIL),
        "email_configured": bool(settings.RESEND_API_KEY),
    }
