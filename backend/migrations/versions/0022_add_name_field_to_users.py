"""Add name field to users table

Revision ID: 0022
Revises: 0021
Create Date: 2025-01-10 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0022'
down_revision = '0021'
depends_on = None


def upgrade():
    # Add name column to users table
    op.add_column('users', sa.Column('name', sa.String(100), nullable=True))


def downgrade():
    # Remove name column from users table
    op.drop_column('users', 'name') 