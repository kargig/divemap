"""Add diving certification and number of dives to user profile

Revision ID: 0005
Revises: 0004
Create Date: 2025-07-27 20:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add new columns to users table if they don't exist
    if not column_exists('users', 'diving_certification'):
        op.add_column('users', sa.Column('diving_certification', sa.String(length=100), nullable=True))

    if not column_exists('users', 'number_of_dives'):
        op.add_column('users', sa.Column('number_of_dives', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove the columns if they exist
    if column_exists('users', 'number_of_dives'):
        op.drop_column('users', 'number_of_dives')

    if column_exists('users', 'diving_certification'):
        op.drop_column('users', 'diving_certification')