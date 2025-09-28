"""Add created_at column to dive_site_tags table

Revision ID: 0034_add_created_at_to_dive_site_tags
Revises: 0033_add_denied_to_ownership_status_enum
Create Date: 2025-01-06 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0034'
down_revision = '0033'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add created_at column to dive_site_tags table if it doesn't exist
    connection = op.get_bind()
    
    # Check if the column already exists
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('dive_site_tags')]
    
    if 'created_at' not in columns:
        op.add_column('dive_site_tags', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    # Remove created_at column from dive_site_tags table if it exists
    connection = op.get_bind()
    
    # Check if the column exists
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('dive_site_tags')]
    
    if 'created_at' in columns:
        op.drop_column('dive_site_tags', 'created_at')
