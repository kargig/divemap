"""Add wind data cache table

Add wind_data_cache table for persistent caching of Open-Meteo API responses.
This enables caching across server restarts and shared cache across multiple backend instances.
Cache entries automatically expire after 15 minutes TTL.

Revision ID: 0043
Revises: 0042
Create Date: 2025-12-07 16:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0043'
down_revision = '0042'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create wind_data_cache table for persistent Open-Meteo API caching."""
    op.create_table(
        'wind_data_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cache_key', sa.String(length=255), nullable=False),
        sa.Column('latitude', sa.DECIMAL(precision=10, scale=8), nullable=False),
        sa.Column('longitude', sa.DECIMAL(precision=11, scale=8), nullable=False),
        sa.Column('target_datetime', sa.DateTime(timezone=True), nullable=True),
        sa.Column('wind_data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cache_key', name='uq_wind_cache_key')
    )
    
    # Create indexes for efficient lookups
    op.create_index('idx_wind_cache_cache_key', 'wind_data_cache', ['cache_key'])
    op.create_index('idx_wind_cache_latitude', 'wind_data_cache', ['latitude'])
    op.create_index('idx_wind_cache_longitude', 'wind_data_cache', ['longitude'])
    op.create_index('idx_wind_cache_target_datetime', 'wind_data_cache', ['target_datetime'])
    op.create_index('idx_wind_cache_created_at', 'wind_data_cache', ['created_at'])
    op.create_index('idx_wind_cache_expires_at', 'wind_data_cache', ['expires_at'])
    
    # Composite index for efficient lookups by location and datetime
    op.create_index('idx_wind_cache_lat_lon_datetime', 'wind_data_cache', ['latitude', 'longitude', 'target_datetime'])
    
    # Enable MySQL event scheduler if not already enabled
    # Note: This requires SUPER privilege, so it may fail in some environments
    # The event will still be created, but may not run until scheduler is enabled manually
    try:
        op.execute("SET GLOBAL event_scheduler = ON")
    except Exception:
        # Event scheduler may already be enabled or we don't have permission
        # This is not critical - the event will still be created
        pass
    
    # Create MySQL event scheduler for automatic TTL cleanup (runs every 5 minutes)
    # This automatically removes expired cache entries
    op.execute("""
        CREATE EVENT IF NOT EXISTS cleanup_expired_wind_cache
        ON SCHEDULE EVERY 15 MINUTE
        DO
            DELETE FROM wind_data_cache
            WHERE expires_at < UTC_TIMESTAMP()
    """)


def downgrade() -> None:
    """Remove wind_data_cache table and cleanup event."""
    # Drop the event scheduler
    op.execute("DROP EVENT IF EXISTS cleanup_expired_wind_cache")
    
    # Drop indexes
    op.drop_index('idx_wind_cache_lat_lon_datetime', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_expires_at', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_created_at', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_target_datetime', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_longitude', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_latitude', table_name='wind_data_cache')
    op.drop_index('idx_wind_cache_cache_key', table_name='wind_data_cache')
    
    # Drop table
    op.drop_table('wind_data_cache')

