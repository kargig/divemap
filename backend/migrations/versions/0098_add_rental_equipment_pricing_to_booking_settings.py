"""add rental_equipment_pricing to diving_center_booking_settings

Revision ID: 0098
Revises: 0097
Create Date: 2026-09-27 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0098'
down_revision = '0097'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        'diving_center_booking_settings',
        sa.Column('rental_equipment_pricing', sa.JSON(), nullable=True)
    )

def downgrade():
    op.drop_column('diving_center_booking_settings', 'rental_equipment_pricing')
