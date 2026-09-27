"""create user gear profiles

Revision ID: 0094
Revises: 0093
Create Date: 2026-09-27 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0094'
down_revision = '0093'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'user_gear_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), server_default='Default', nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('preferred_unit_system', sa.String(length=10), server_default='METRIC', nullable=False),
        sa.Column('preferred_shoe_system', sa.String(length=10), server_default='EU', nullable=False),
        sa.Column('height_cm', sa.Integer(), nullable=True),
        sa.Column('weight_kg', sa.Integer(), nullable=True),
        sa.Column('shoe_size_eu', sa.DECIMAL(precision=3, scale=1), nullable=True),
        sa.Column('wetsuit_gender', sa.String(length=10), nullable=True),
        sa.Column('wetsuit_size', sa.String(length=10), nullable=True),
        sa.Column('wetsuit_thickness', sa.String(length=10), server_default='5mm', nullable=True),
        sa.Column('bcd_size', sa.String(length=10), nullable=True),
        sa.Column('fin_type', sa.String(length=20), server_default='OPEN_HEEL', nullable=True),
        sa.Column('regulator_fitting', sa.String(length=10), server_default='DIN', nullable=True),
        sa.Column('preferred_tank_id', sa.String(length=20), server_default='12', nullable=True),
        sa.Column('preferred_gas_mix_id', sa.String(length=20), server_default='air', nullable=True),
        sa.Column('estimated_lead_kg', sa.DECIMAL(precision=4, scale=1), nullable=True),
        sa.Column('has_own_dive_computer', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('has_own_smb', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('insurance_provider', sa.String(length=100), nullable=True),
        sa.Column('insurance_policy_number', sa.String(length=100), nullable=True),
        sa.Column('insurance_expiry_date', sa.Date(), nullable=True),
        sa.Column('emergency_contact_name', sa.String(length=255), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(length=50), nullable=True),
        sa.Column('emergency_contact_relation', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_user_gear_profiles_user_name')
    )
    op.create_index(op.f('ix_user_gear_profiles_id'), 'user_gear_profiles', ['id'], unique=False)
    op.create_index(op.f('ix_user_gear_profiles_user_id'), 'user_gear_profiles', ['user_id'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_user_gear_profiles_user_id'), table_name='user_gear_profiles')
    op.drop_index(op.f('ix_user_gear_profiles_id'), table_name='user_gear_profiles')
    op.drop_table('user_gear_profiles')
