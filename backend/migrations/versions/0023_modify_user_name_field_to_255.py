"""Modify user name field to String(255)

Revision ID: 0023
Revises: 0022
Create Date: 2025-01-10 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None

def upgrade():
    # Modify the name column in users table from VARCHAR(100) to VARCHAR(255)
    op.alter_column('users', 'name',
                    existing_type=sa.String(100),
                    type_=sa.String(255),
                    existing_nullable=True)

def downgrade():
    # Revert the name column in users table back to VARCHAR(100)
    op.alter_column('users', 'name',
                    existing_type=sa.String(255),
                    type_=sa.String(100),
                    existing_nullable=True) 