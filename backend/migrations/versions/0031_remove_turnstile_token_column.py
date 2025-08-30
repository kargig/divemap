"""Remove turnstile_token column from users table

Revision ID: 0031
Revises: 0030
Create Date: 2025-08-30 21:22:36.669343

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0031'
down_revision = '0030'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove the turnstile_token column and its index
    # Keep turnstile_verified_at for audit purposes
    op.drop_index(op.f('ix_users_turnstile_token'), table_name='users')
    op.drop_column('users', 'turnstile_token')


def downgrade() -> None:
    # Recreate the turnstile_token column and index
    op.add_column('users', sa.Column('turnstile_token', sa.String(255), nullable=True))
    op.create_index(op.f('ix_users_turnstile_token'), 'users', ['turnstile_token'], unique=False)
