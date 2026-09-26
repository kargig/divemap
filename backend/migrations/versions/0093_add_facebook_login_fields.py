"""add facebook login fields

Revision ID: 0093
Revises: 0092
Create Date: 2026-08-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0093'
down_revision = '0092'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('facebook_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_facebook_id'), 'users', ['facebook_id'], unique=True)
    op.add_column('users', sa.Column('facebook_avatar_url', sa.String(length=500), nullable=True))

def downgrade():
    op.drop_column('users', 'facebook_avatar_url')
    op.drop_index(op.f('ix_users_facebook_id'), table_name='users')
    op.drop_column('users', 'facebook_id')
