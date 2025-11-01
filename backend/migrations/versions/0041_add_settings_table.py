"""Add settings table for application configuration

This migration creates a settings table to store application-wide configuration
settings. The first setting is disable_diving_center_reviews which controls
whether diving center comments and ratings are enabled.

Revision ID: 0041
Revises: 0040
Create Date: 2025-11-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

# revision identifiers, used by Alembic.
revision = '0041'
down_revision = '0040'
branch_labels = None
depends_on = None


def table_exists(table_name):
    """Check if a table exists in the database (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    """Create settings table and insert initial setting."""
    connection = op.get_bind()
    
    # Step 1: Create settings table if it doesn't exist
    if not table_exists('settings'):
        op.create_table(
            'settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('key', sa.String(255), nullable=False),
            sa.Column('value', sa.Text(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('key')
        )
    
    # Step 2: Create index on key for fast lookups (if it doesn't exist)
    try:
        op.create_index('idx_settings_key', 'settings', ['key'])
    except Exception:
        pass  # Index might already exist
    
    # Step 3: Insert initial setting if it doesn't exist
    inspector = inspect(connection)
    if 'settings' in inspector.get_table_names():
        # Check if setting already exists
        result = connection.execute(
            text("SELECT COUNT(*) FROM settings WHERE `key` = 'disable_diving_center_reviews'")
        )
        count = result.scalar()
        if count == 0:
            connection.execute(
                text("""
                    INSERT INTO settings (`key`, value, description)
                    VALUES ('disable_diving_center_reviews', 'false', 'Disable comments and ratings for diving centers')
                """)
            )


def downgrade() -> None:
    """Drop settings table."""
    op.drop_index('idx_settings_key', table_name='settings')
    op.drop_table('settings')

