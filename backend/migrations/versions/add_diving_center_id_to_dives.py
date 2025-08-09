"""Add diving_center_id to dives table

Revision ID: add_diving_center_id_to_dives
Revises: add_view_count_to_dives
Create Date: 2025-08-03 10:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_diving_center_id_to_dives'
down_revision = 'add_view_count_to_dives'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add diving_center_id column to dives table
    op.add_column('dives', sa.Column('diving_center_id', sa.Integer(), nullable=True))

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_dives_diving_center_id',
        'dives', 'diving_centers',
        ['diving_center_id'], ['id']
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_dives_diving_center_id', 'dives', type_='foreignkey')

    # Drop diving_center_id column
    op.drop_column('dives', 'diving_center_id')