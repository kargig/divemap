"""Add dive profile metadata to dives table

Revision ID: 0032
Revises: 0031
Create Date: 2025-09-20 12:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0032'
down_revision = '0031'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('dives', sa.Column('profile_xml_path', sa.String(500), nullable=True))
    op.add_column('dives', sa.Column('profile_sample_count', sa.Integer(), nullable=True))
    op.add_column('dives', sa.Column('profile_max_depth', sa.DECIMAL(precision=6, scale=3), nullable=True))
    op.add_column('dives', sa.Column('profile_duration_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('dives', 'profile_duration_minutes')
    op.drop_column('dives', 'profile_max_depth')
    op.drop_column('dives', 'profile_sample_count')
    op.drop_column('dives', 'profile_xml_path')
