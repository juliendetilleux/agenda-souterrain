"""add ban fields to users table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("ban_until", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("ban_reason", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "ban_reason")
    op.drop_column("users", "ban_until")
    op.drop_column("users", "is_banned")
