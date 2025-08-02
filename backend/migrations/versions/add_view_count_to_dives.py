"""Add view_count field to dives table

Revision ID: add_view_count_to_dives
Revises: add_dive_name_and_privacy
Create Date: 2025-08-03 01:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_view_count_to_dives'
down_revision = 'add_dive_name_and_privacy'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add view_count column to dives table
    op.add_column('dives', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove view_count column from dives table
    op.drop_column('dives', 'view_count') 