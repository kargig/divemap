"""
Remove address column from dive_sites

Revision ID: 0039_remove_address_from_dive_sites
Revises: 0038_add_point_location_to_diving_centers
Create Date: 2025-10-31
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0039'
down_revision = '0038'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('dive_sites') as batch_op:
        batch_op.drop_column('address')


def downgrade() -> None:
    with op.batch_alter_table('dive_sites') as batch_op:
        batch_op.add_column(sa.Column('address', sa.Text(), nullable=True))


