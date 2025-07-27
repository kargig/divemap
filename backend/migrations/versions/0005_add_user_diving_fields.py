"""Add diving certification and number of dives to user profile

Revision ID: 0005
Revises: 0004
Create Date: 2025-07-27 20:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to users table
    op.add_column('users', sa.Column('diving_certification', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('number_of_dives', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove the columns
    op.drop_column('users', 'number_of_dives')
    op.drop_column('users', 'diving_certification') 