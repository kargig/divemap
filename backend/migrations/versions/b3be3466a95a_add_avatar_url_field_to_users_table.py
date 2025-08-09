"""Add avatar_url field to users table

Revision ID: b3be3466a95a
Revises: 9002229c2a67
Create Date: 2025-07-30 00:58:37.702924

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b3be3466a95a'
down_revision = '9002229c2a67'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add avatar_url column to users table
    op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    # Remove avatar_url column from users table
    op.drop_column('users', 'avatar_url')