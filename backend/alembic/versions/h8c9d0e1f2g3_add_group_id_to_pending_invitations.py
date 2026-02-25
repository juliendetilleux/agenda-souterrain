"""add group_id to pending_invitations

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "h8c9d0e1f2g3"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pending_invitations",
        sa.Column("group_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_pending_invitations_group_id",
        "pending_invitations",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_pending_invitations_group_id", "pending_invitations", type_="foreignkey")
    op.drop_column("pending_invitations", "group_id")
