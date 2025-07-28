"""Add country and region fields to dive sites

Revision ID: 0003
Revises: 0002
Create Date: 2025-07-27 15:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def index_exists(index_name, table_name):
    """Check if an index exists (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    indexes = [idx['name'] for idx in inspector.get_indexes(table_name)]
    return index_name in indexes


def upgrade() -> None:
    # Add country and region columns to dive_sites table if they don't exist
    if not column_exists('dive_sites', 'country'):
        op.add_column('dive_sites', sa.Column('country', sa.String(length=100), nullable=True))
    
    if not column_exists('dive_sites', 'region'):
        op.add_column('dive_sites', sa.Column('region', sa.String(length=100), nullable=True))
    
    # Create indexes for the new columns if they don't exist
    if not index_exists('ix_dive_sites_country', 'dive_sites'):
        op.create_index(op.f('ix_dive_sites_country'), 'dive_sites', ['country'], unique=False)
    
    if not index_exists('ix_dive_sites_region', 'dive_sites'):
        op.create_index(op.f('ix_dive_sites_region'), 'dive_sites', ['region'], unique=False)


def downgrade() -> None:
    # Drop indexes if they exist
    try:
        op.drop_index(op.f('ix_dive_sites_region'), table_name='dive_sites')
    except:
        pass
    
    try:
        op.drop_index(op.f('ix_dive_sites_country'), table_name='dive_sites')
    except:
        pass
    
    # Drop columns if they exist
    if column_exists('dive_sites', 'region'):
        op.drop_column('dive_sites', 'region')
    
    if column_exists('dive_sites', 'country'):
        op.drop_column('dive_sites', 'country') 