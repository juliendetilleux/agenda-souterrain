from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import warnings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/agenda_db"
    SECRET_KEY: str = "change-me-in-production"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if v == "change-me-in-production":
            warnings.warn("SECRET_KEY is using the default value. Set a real secret in .env!", stacklevel=2)
        return v
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_EMAIL: str = ""
    LIBRETRANSLATE_URL: str = "http://libretranslate:5000"
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE_MB: int = 10

    # Storage backend: "local" (filesystem) or "r2" (Cloudflare R2)
    STORAGE_BACKEND: str = "local"
    R2_ENDPOINT: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    R2_BUCKET: str = ""
    R2_PUBLIC_URL: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
