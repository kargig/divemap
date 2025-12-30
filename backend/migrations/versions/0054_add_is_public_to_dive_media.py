"""add_is_public_to_dive_media

Revision ID: 0054
Revises: 0053
Create Date: 2025-12-06 17:25:10.251933

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0054'
down_revision = '0053'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add is_public column to dive_media table if it doesn't exist
    if not column_exists('dive_media', 'is_public'):
        op.add_column('dive_media', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='1'))


def downgrade() -> None:
    # Remove is_public column from dive_media table if it exists
    if column_exists('dive_media', 'is_public'):
        op.drop_column('dive_media', 'is_public')
