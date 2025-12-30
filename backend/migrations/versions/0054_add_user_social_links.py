"""add user social links

Revision ID: 0054
Revises: 0053
Create Date: 2025-12-30 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0054'
down_revision = '0053'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_social_links',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('platform', sa.String(length=50), nullable=False),
    sa.Column('url', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'platform', name='_user_platform_uc')
    )
    op.create_index(op.f('ix_user_social_links_id'), 'user_social_links', ['id'], unique=False)
    op.create_index(op.f('ix_user_social_links_user_id'), 'user_social_links', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_user_social_links_user_id'), table_name='user_social_links')
    op.drop_index(op.f('ix_user_social_links_id'), table_name='user_social_links')
    op.drop_table('user_social_links')
