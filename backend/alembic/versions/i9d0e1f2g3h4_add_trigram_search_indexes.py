"""add_trigram_search_indexes

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-02-26

"""
from alembic import op

revision = "i9d0e1f2g3h4"
down_revision = "h8c9d0e1f2g3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_title_trgm "
        "ON events USING GIN (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_location_trgm "
        "ON events USING GIN (location gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_notes_trgm "
        "ON events USING GIN (notes gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_events_notes_trgm")
    op.execute("DROP INDEX IF EXISTS idx_events_location_trgm")
    op.execute("DROP INDEX IF EXISTS idx_events_title_trgm")
