"""add medical clearance audit fields to diver_medical_records

Revision ID: 0096
Revises: 0095
Create Date: 2026-09-27 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0096'
down_revision = '0095'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('diver_medical_records', sa.Column('cleared_by_user_id', sa.Integer(), nullable=True))
    op.add_column('diver_medical_records', sa.Column('cleared_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('diver_medical_records', sa.Column('cleared_reason', sa.Text(), nullable=True))
    op.add_column('diver_medical_records', sa.Column('cleared_physician_name', sa.String(length=255), nullable=True))
    op.add_column('diver_medical_records', sa.Column('cleared_physician_clinic', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_diver_medical_records_cleared_by_user',
        'diver_medical_records', 'users',
        ['cleared_by_user_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_diver_medical_records_cleared_by_user_id', 'diver_medical_records', ['cleared_by_user_id'])

def downgrade():
    op.drop_index('ix_diver_medical_records_cleared_by_user_id', table_name='diver_medical_records')
    op.drop_constraint('fk_diver_medical_records_cleared_by_user', 'diver_medical_records', type_='foreignkey')
    op.drop_column('diver_medical_records', 'cleared_physician_clinic')
    op.drop_column('diver_medical_records', 'cleared_physician_name')
    op.drop_column('diver_medical_records', 'cleared_reason')
    op.drop_column('diver_medical_records', 'cleared_at')
    op.drop_column('diver_medical_records', 'cleared_by_user_id')
