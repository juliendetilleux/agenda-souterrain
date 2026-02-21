from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.rate_limit import limiter
from app.routers import auth, calendars, sub_calendars, events, sharing, admin, tags

app = FastAPI(title="Agenda Souterrain API", version="1.0.0", docs_url="/docs")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(calendars.router, prefix="/v1")
app.include_router(sub_calendars.router, prefix="/v1")
app.include_router(events.router, prefix="/v1")
app.include_router(sharing.router, prefix="/v1")
app.include_router(tags.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")


@app.get("/")
async def root():
    return {"message": "Agenda Souterrain API", "version": "1.0.0"}


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        return {"status": "error", "db": "unreachable"}
