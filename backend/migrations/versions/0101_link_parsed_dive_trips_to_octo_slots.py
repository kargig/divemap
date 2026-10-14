"""link parsed dive trips to octo slots

Revision ID: 0101
Revises: 0100
Create Date: 2026-10-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0101'
down_revision = '0100'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('parsed_dive_trips', sa.Column('octo_slot_id', sa.String(length=36), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('is_bookable', sa.Boolean(), server_default='0', nullable=False))
    op.create_index(op.f('ix_parsed_dive_trips_octo_slot_id'), 'parsed_dive_trips', ['octo_slot_id'], unique=False)
    op.create_foreign_key(
        'fk_parsed_dive_trips_octo_slot_id',
        'parsed_dive_trips', 'octo_availability_slots',
        ['octo_slot_id'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_parsed_dive_trips_octo_slot_id', 'parsed_dive_trips', type_='foreignkey')
    op.drop_index(op.f('ix_parsed_dive_trips_octo_slot_id'), table_name='parsed_dive_trips')
    op.drop_column('parsed_dive_trips', 'is_bookable')
    op.drop_column('parsed_dive_trips', 'octo_slot_id')
