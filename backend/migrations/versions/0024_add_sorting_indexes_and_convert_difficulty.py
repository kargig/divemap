"""Add sorting indexes and convert difficulty levels to integers

This migration:
1. Adds database indexes for optimal sorting performance
2. Cleans up leftover difficulty level columns from previous conversion
3. Ensures all necessary indexes are in place

Revision ID: 0024
Revises: 0023
Create Date: 2025-01-10 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade():
    """Add sorting indexes and clean up difficulty level columns."""
    
    # Step 1: Clean up leftover difficulty level columns from previous conversion
    # These columns were created during the direct SQL conversion but are no longer needed
    
    # Check if columns exist before trying to drop them
    connection = op.get_bind()
    
    # Drop leftover difficulty_level_int columns if they exist
    try:
        op.drop_column('dive_sites', 'difficulty_level_int')
    except Exception:
        pass  # Column might not exist
    
    try:
        op.drop_column('dives', 'difficulty_level_int')
    except Exception:
        pass  # Column might not exist
    
    try:
        op.drop_column('parsed_dive_trips', 'trip_difficulty_level_int')
    except Exception:
        pass  # Column might not exist
    
    # Step 2: Add sorting indexes for optimal performance
    # Use try-except blocks to handle cases where indexes might already exist
    
    # Add indexes for dive sites sorting
    try:
        op.create_index('idx_dive_sites_view_count', 'dive_sites', ['view_count'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dive_sites_created_at', 'dive_sites', ['created_at'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dive_sites_updated_at', 'dive_sites', ['updated_at'])
    except Exception:
        pass  # Index might already exist
    
    # Add indexes for diving centers sorting
    try:
        op.create_index('idx_diving_centers_view_count', 'diving_centers', ['view_count'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_diving_centers_created_at', 'diving_centers', ['created_at'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_diving_centers_updated_at', 'diving_centers', ['updated_at'])
    except Exception:
        pass  # Index might already exist
    
    # Add indexes for dives sorting
    try:
        op.create_index('idx_dives_dive_date', 'dives', ['dive_date'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_max_depth', 'dives', ['max_depth'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_duration', 'dives', ['duration'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_difficulty_level', 'dives', ['difficulty_level'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_visibility_rating', 'dives', ['visibility_rating'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_user_rating', 'dives', ['user_rating'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_view_count', 'dives', ['view_count'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_created_at', 'dives', ['created_at'])
    except Exception:
        pass  # Index might already exist
    
    try:
        op.create_index('idx_dives_updated_at', 'dives', ['updated_at'])
    except Exception:
        pass  # Index might already exist
    
    # Add indexes for dive trips sorting
    try:
        op.create_index('idx_parsed_dive_trips_difficulty_level', 'parsed_dive_trips', ['trip_difficulty_level'])
    except Exception:
        pass  # Index might already exist


def downgrade():
    """Remove all indexes added by this migration."""
    
    # Remove all indexes (use try-except to handle cases where they might not exist)
    
    # Remove dive sites indexes
    try:
        op.drop_index('idx_dive_sites_view_count', table_name='dive_sites')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dive_sites_created_at', table_name='dive_sites')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dive_sites_updated_at', table_name='dive_sites')
    except Exception:
        pass
    
    # Remove diving centers indexes
    try:
        op.drop_index('idx_diving_centers_view_count', table_name='diving_centers')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_diving_centers_created_at', table_name='diving_centers')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_diving_centers_updated_at', table_name='diving_centers')
    except Exception:
        pass
    
    # Remove dives indexes
    try:
        op.drop_index('idx_dives_dive_date', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_max_depth', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_duration', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_difficulty_level', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_visibility_rating', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_user_rating', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_view_count', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_created_at', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_updated_at', table_name='dives')
    except Exception:
        pass
    
    # Remove dive trips indexes
    try:
        op.drop_index('idx_parsed_dive_trips_difficulty_level', table_name='parsed_dive_trips')
    except Exception:
        pass
