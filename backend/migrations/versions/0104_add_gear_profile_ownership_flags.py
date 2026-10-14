"""add gear profile ownership flags

Revision ID: 0104
Revises: 0103
Create Date: 2026-10-14 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0104'
down_revision = '0103'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('user_gear_profiles', sa.Column('has_own_mask', sa.Boolean(), server_default='1', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_wetsuit', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_regulator', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_bcd', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_fins', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_boots', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_torch', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('user_gear_profiles', sa.Column('has_own_lead_weights', sa.Boolean(), server_default='0', nullable=False))

def downgrade():
    op.drop_column('user_gear_profiles', 'has_own_lead_weights')
    op.drop_column('user_gear_profiles', 'has_own_torch')
    op.drop_column('user_gear_profiles', 'has_own_boots')
    op.drop_column('user_gear_profiles', 'has_own_fins')
    op.drop_column('user_gear_profiles', 'has_own_bcd')
    op.drop_column('user_gear_profiles', 'has_own_regulator')
    op.drop_column('user_gear_profiles', 'has_own_wetsuit')
    op.drop_column('user_gear_profiles', 'has_own_mask')
