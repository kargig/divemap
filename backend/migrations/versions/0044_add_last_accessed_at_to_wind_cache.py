"""Add last_accessed_at to wind cache

Add last_accessed_at column to wind_data_cache table to track when cache entries
are accessed. Update cleanup_expired_wind_cache event to only delete entries that
have expired AND have not been accessed within the last hour, preserving frequently
used cache entries.

Revision ID: 0044
Revises: 0043
Create Date: 2025-12-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0044'
down_revision = '0043'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add last_accessed_at column and update cleanup event."""
    # Add last_accessed_at column (nullable initially for existing entries)
    op.add_column(
        'wind_data_cache',
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True)
    )
    
    # Create index for efficient cleanup queries
    op.create_index('idx_wind_cache_last_accessed_at', 'wind_data_cache', ['last_accessed_at'])
    
    # Drop and recreate the cleanup event with new logic
    # Only delete entries that have expired AND haven't been accessed in the last hour
    op.execute("DROP EVENT IF EXISTS cleanup_expired_wind_cache")
    
    op.execute("""
        CREATE EVENT cleanup_expired_wind_cache
        ON SCHEDULE EVERY 15 MINUTE
        DO
            DELETE FROM wind_data_cache
            WHERE expires_at < UTC_TIMESTAMP()
            AND (last_accessed_at IS NULL OR last_accessed_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR)
    """)


def downgrade() -> None:
    """Remove last_accessed_at column and restore original cleanup event."""
    # Drop the updated cleanup event
    op.execute("DROP EVENT IF EXISTS cleanup_expired_wind_cache")
    
    # Restore original cleanup event
    op.execute("""
        CREATE EVENT cleanup_expired_wind_cache
        ON SCHEDULE EVERY 15 MINUTE
        DO
            DELETE FROM wind_data_cache
            WHERE expires_at < UTC_TIMESTAMP()
    """)
    
    # Drop index
    op.drop_index('idx_wind_cache_last_accessed_at', table_name='wind_data_cache')
    
    # Drop column
    op.drop_column('wind_data_cache', 'last_accessed_at')

