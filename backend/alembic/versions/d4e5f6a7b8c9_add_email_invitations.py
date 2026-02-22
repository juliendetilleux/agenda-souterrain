"""add pending_invitations table and enable_email_notifications column

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("calendar_id", UUID(as_uuid=True), sa.ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("permission", sa.Enum(
            "NO_ACCESS", "READ_ONLY_NO_DETAILS", "READ_ONLY",
            "ADD_ONLY", "MODIFY_OWN", "MODIFY", "ADMINISTRATOR",
            name="permission", create_type=False,
        ), nullable=False, server_default="READ_ONLY"),
        sa.Column("sub_calendar_id", UUID(as_uuid=True), sa.ForeignKey("sub_calendars.id", ondelete="SET NULL"), nullable=True),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("calendar_id", "email", name="uq_pending_calendar_email"),
    )

    op.add_column(
        "calendars",
        sa.Column("enable_email_notifications", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("calendars", "enable_email_notifications")
    op.drop_table("pending_invitations")
