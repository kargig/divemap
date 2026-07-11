"""add list collaborators

Revision ID: 0092
Revises: 0091
Create Date: 2026-07-10 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0092'
down_revision = '0091'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'dive_site_list_collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('list_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='editor'),
        sa.Column('show_on_profile', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['list_id'], ['dive_site_lists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('list_id', 'user_id', name='uq_list_collaborator')
    )
    op.create_index('ix_dive_site_list_collaborators_id', 'dive_site_list_collaborators', ['id'], unique=False)
    op.create_index('ix_dive_site_list_collaborators_list_id', 'dive_site_list_collaborators', ['list_id'], unique=False)
    op.create_index('ix_dive_site_list_collaborators_user_id', 'dive_site_list_collaborators', ['user_id'], unique=False)

def downgrade():
    op.drop_table('dive_site_list_collaborators')
