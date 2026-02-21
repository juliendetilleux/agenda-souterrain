"""add translations column to events

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-21
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("translations", sa.JSON(), server_default="{}", nullable=True))


def downgrade() -> None:
    op.drop_column("events", "translations")
