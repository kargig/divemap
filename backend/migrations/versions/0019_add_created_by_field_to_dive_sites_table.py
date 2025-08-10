"""Add created_by field to dive_sites table

Revision ID: 0019_add_created_by_field
Revises: 0018_depth_precision
Create Date: 2025-08-09 16:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0019_add_created_by_field'
down_revision = '0018_depth_precision'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add created_by column to dive_sites table
    op.add_column('dive_sites', sa.Column('created_by', sa.Integer(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_dive_sites_created_by_users',
        'dive_sites', 'users',
        ['created_by'], ['id']
    )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_dive_sites_created_by_users', 'dive_sites', type_='foreignkey')

    # Remove created_by column
    op.drop_column('dive_sites', 'created_by')
