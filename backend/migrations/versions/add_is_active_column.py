"""Add missing is_active column to user_certifications table

Revision ID: add_is_active_column
Revises: consolidated_dive_system_final
Create Date: 2025-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_is_active_column'
down_revision = 'consolidated_dive_system_final'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_active column to user_certifications table
    op.add_column('user_certifications', sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'))


def downgrade() -> None:
    # Remove is_active column from user_certifications table
    op.drop_column('user_certifications', 'is_active') 