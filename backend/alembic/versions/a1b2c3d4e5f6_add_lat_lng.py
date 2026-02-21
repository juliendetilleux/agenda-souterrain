"""add_lat_lng

Revision ID: a1b2c3d4e5f6
Revises: 5ed1ee3262f1
Create Date: 2026-02-21 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '5ed1ee3262f1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('events', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('events', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'longitude')
    op.drop_column('events', 'latitude')
