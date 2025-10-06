"""
0035 add address to diving centers

Revision ID: 0035_add_address_to_diving_centers
Revises: 0034_add_created_at_to_dive_site_tags
Create Date: 2025-10-06
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0035'
down_revision = '0034'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('diving_centers', sa.Column('address', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('diving_centers', 'address')


