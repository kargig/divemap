"""Add view count fields to dive sites and diving centers

Revision ID: 0004
Revises: 0003
Create Date: 2025-07-27 16:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add view_count column to dive_sites table if it doesn't exist
    if not column_exists('dive_sites', 'view_count'):
        op.add_column('dive_sites', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))

    # Add view_count column to diving_centers table if it doesn't exist
    if not column_exists('diving_centers', 'view_count'):
        op.add_column('diving_centers', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove view_count column from dive_sites table if it exists
    if column_exists('dive_sites', 'view_count'):
        op.drop_column('dive_sites', 'view_count')

    # Remove view_count column from diving_centers table if it exists
    if column_exists('diving_centers', 'view_count'):
        op.drop_column('diving_centers', 'view_count')