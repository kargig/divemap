"""add annual and center medical clearances

Revision ID: 0103
Revises: 0102
Create Date: 2026-10-13 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0103'
down_revision = '0102'
branch_labels = None
depends_on = None

def upgrade():
    # 1. User-level annual medical profiles
    op.create_table(
        'user_medical_profiles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('encrypted_dek', sa.Text(), nullable=False),
        sa.Column('encrypted_answers', sa.LargeBinary(), nullable=False),
        sa.Column('physician_certificate_url', sa.String(length=500), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('audit_signature_hash', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_user_medical_profiles_id', 'user_medical_profiles', ['id'])
    op.create_index('ix_user_medical_profiles_user_id', 'user_medical_profiles', ['user_id'])

    # 2. Per-center diver medical approvals
    op.create_table(
        'center_diver_medical_approvals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('diving_center_id', sa.Integer(), sa.ForeignKey('diving_centers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('approved_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('physician_name', sa.String(length=255), nullable=True),
        sa.Column('physician_clinic', sa.String(length=255), nullable=True),
        sa.Column('approval_notes', sa.Text(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('diving_center_id', 'user_id', name='uix_center_user_medical_approval'),
    )
    op.create_index('ix_center_diver_medical_approvals_id', 'center_diver_medical_approvals', ['id'])
    op.create_index('ix_center_diver_medical_approvals_diving_center_id', 'center_diver_medical_approvals', ['diving_center_id'])
    op.create_index('ix_center_diver_medical_approvals_user_id', 'center_diver_medical_approvals', ['user_id'])
    op.create_index('ix_center_diver_medical_approvals_approved_by_user_id', 'center_diver_medical_approvals', ['approved_by_user_id'])

def downgrade():
    op.drop_table('center_diver_medical_approvals')
    op.drop_table('user_medical_profiles')
