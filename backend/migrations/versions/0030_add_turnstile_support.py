"""Add Turnstile support to users table

Revision ID: 0030
Revises: 0029
Create Date: 2024-01-15 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0030'
down_revision = '0029'
branch_labels = None
depends_on = None

def upgrade():
    # Add turnstile_token field to users table
    op.add_column('users', sa.Column('turnstile_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('turnstile_verified_at', sa.DateTime(timezone=True), nullable=True))
    
    # Add index for performance
    op.create_index(op.f('ix_users_turnstile_token'), 'users', ['turnstile_token'], unique=False)

def downgrade():
    # Remove turnstile fields
    op.drop_index(op.f('ix_users_turnstile_token'), table_name='users')
    op.drop_column('users', 'turnstile_verified_at')
    op.drop_column('users', 'turnstile_token')
