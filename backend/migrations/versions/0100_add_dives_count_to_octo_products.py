"""add dives_count to octo_products

Revision ID: 0100
Revises: 0099
Create Date: 2026-09-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0100'
down_revision = '0099'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        'octo_products',
        sa.Column('dives_count', sa.Integer(), nullable=False, server_default='2')
    )

def downgrade():
    op.drop_column('octo_products', 'dives_count')
