"""Add name and privacy fields to dives table

Revision ID: add_dive_name_and_privacy
Revises: consolidated_dive_system_final
Create Date: 2025-08-02 18:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_dive_name_and_privacy'
down_revision = 'consolidated_dive_system_final'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add name and is_private fields to dives table
    op.add_column('dives', sa.Column('name', sa.String(length=255), nullable=True))
    op.add_column('dives', sa.Column('is_private', sa.Boolean(), nullable=True, server_default='0'))


def downgrade() -> None:
    # Remove name and is_private fields from dives table
    op.drop_column('dives', 'is_private')
    op.drop_column('dives', 'name') 