"""Add max_depth and alternative_names to dive_sites

Revision ID: 0002
Revises: 0001
Create Date: 2025-07-27 14:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from sqlalchemy import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add max_depth column to dive_sites table if it doesn't exist
    if not column_exists('dive_sites', 'max_depth'):
        op.add_column('dive_sites', sa.Column('max_depth', sa.DECIMAL(precision=5, scale=2), nullable=True))
    
    # Add alternative_names column to dive_sites table if it doesn't exist
    if not column_exists('dive_sites', 'alternative_names'):
        op.add_column('dive_sites', sa.Column('alternative_names', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove alternative_names column from dive_sites table if it exists
    if column_exists('dive_sites', 'alternative_names'):
        op.drop_column('dive_sites', 'alternative_names')
    
    # Remove max_depth column from dive_sites table if it exists
    if column_exists('dive_sites', 'max_depth'):
        op.drop_column('dive_sites', 'max_depth') 