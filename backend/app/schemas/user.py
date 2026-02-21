import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import User
from app.config import settings


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_verified: bool
    is_admin: bool
    is_superadmin: bool = False  # computed from ADMIN_EMAIL, not stored in DB
    created_at: datetime

    model_config = {"from_attributes": True}


def make_user_out(user: User) -> UserOut:
    """Build UserOut from a User model, computing is_superadmin from settings."""
    out = UserOut.model_validate(user)
    return out.model_copy(update={"is_superadmin": bool(settings.ADMIN_EMAIL and user.email == settings.ADMIN_EMAIL)})


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str
