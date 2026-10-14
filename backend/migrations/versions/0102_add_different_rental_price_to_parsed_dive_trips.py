"""add different rental price options to parsed dive trips

Revision ID: 0102
Revises: 0101
Create Date: 2026-10-09 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0102'
down_revision = '0101'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        'parsed_dive_trips',
        sa.Column('different_rental_price', sa.Boolean(), server_default='1', nullable=False)
    )
    op.add_column(
        'parsed_dive_trips',
        sa.Column('custom_rental_price', sa.DECIMAL(precision=10, scale=2), nullable=True)
    )

def downgrade():
    op.drop_column('parsed_dive_trips', 'custom_rental_price')
    op.drop_column('parsed_dive_trips', 'different_rental_price')
