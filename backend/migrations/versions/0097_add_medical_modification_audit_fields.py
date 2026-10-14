"""add medical modification audit fields to diver_medical_records

Revision ID: 0097
Revises: 0096
Create Date: 2026-09-27 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0097'
down_revision = '0096'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('diver_medical_records', sa.Column('modified_by_user_id', sa.Integer(), nullable=True))
    op.add_column('diver_medical_records', sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('diver_medical_records', sa.Column('modification_reason', sa.Text(), nullable=True))
    op.add_column('diver_medical_records', sa.Column('modification_history', sa.JSON(), nullable=True))
    op.create_foreign_key(
        'fk_diver_medical_records_modified_by_user',
        'diver_medical_records', 'users',
        ['modified_by_user_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_diver_medical_records_modified_by_user_id', 'diver_medical_records', ['modified_by_user_id'])

def downgrade():
    op.drop_index('ix_diver_medical_records_modified_by_user_id', table_name='diver_medical_records')
    op.drop_constraint('fk_diver_medical_records_modified_by_user', 'diver_medical_records', type_='foreignkey')
    op.drop_column('diver_medical_records', 'modification_history')
    op.drop_column('diver_medical_records', 'modification_reason')
    op.drop_column('diver_medical_records', 'modified_at')
    op.drop_column('diver_medical_records', 'modified_by_user_id')
