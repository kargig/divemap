"""add dive site lists

Revision ID: 0091
Revises: 0090
Create Date: 2026-07-08 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0091'
down_revision = '0090'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'dive_site_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('show_on_profile', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('system_type', sa.String(length=50), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_dive_site_lists_id', 'dive_site_lists', ['id'], unique=False)
    op.create_index('ix_dive_site_lists_slug', 'dive_site_lists', ['slug'], unique=False)

    op.create_table(
        'dive_site_list_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('list_id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['list_id'], ['dive_site_lists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('list_id', 'dive_site_id', name='uq_list_dive_site')
    )
    op.create_index('ix_dive_site_list_items_id', 'dive_site_list_items', ['id'], unique=False)

def downgrade():
    op.drop_index('ix_dive_site_list_items_id', table_name='dive_site_list_items')
    op.drop_table('dive_site_list_items')
    op.drop_index('ix_dive_site_lists_slug', table_name='dive_site_lists')
    op.drop_index('ix_dive_site_lists_id', table_name='dive_site_lists')
    op.drop_table('dive_site_lists')
