"""add group_id to access_links

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "access_links",
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("groups.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("access_links", "group_id")
