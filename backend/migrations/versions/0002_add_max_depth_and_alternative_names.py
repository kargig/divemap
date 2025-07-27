"""Add max_depth and alternative_names to dive_sites

Revision ID: 0002
Revises: 0001
Create Date: 2025-07-27 14:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add max_depth column to dive_sites table
    op.add_column('dive_sites', sa.Column('max_depth', sa.DECIMAL(precision=5, scale=2), nullable=True))
    
    # Add alternative_names column to dive_sites table
    op.add_column('dive_sites', sa.Column('alternative_names', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove alternative_names column from dive_sites table
    op.drop_column('dive_sites', 'alternative_names')
    
    # Remove max_depth column from dive_sites table
    op.drop_column('dive_sites', 'max_depth') 