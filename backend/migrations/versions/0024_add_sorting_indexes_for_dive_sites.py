"""Add sorting indexes for optimal performance

Revision ID: 0024
Revises: 0023
Create Date: 2025-01-10 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None

def upgrade():
    # Add indexes for dive sites sorting
    op.create_index('idx_dive_sites_view_count', 'dive_sites', ['view_count'])
    op.create_index('idx_dive_sites_created_at', 'dive_sites', ['created_at'])
    op.create_index('idx_dive_sites_updated_at', 'dive_sites', ['updated_at'])
    
    # Add indexes for diving centers sorting
    op.create_index('idx_diving_centers_view_count', 'diving_centers', ['view_count'])
    op.create_index('idx_diving_centers_created_at', 'diving_centers', ['created_at'])
    op.create_index('idx_diving_centers_updated_at', 'diving_centers', ['updated_at'])
    
    # Add indexes for dives sorting
    op.create_index('idx_dives_dive_date', 'dives', ['dive_date'])
    op.create_index('idx_dives_max_depth', 'dives', ['max_depth'])
    op.create_index('idx_dives_duration', 'dives', ['duration'])
    op.create_index('idx_dives_difficulty_level', 'dives', ['difficulty_level'])
    op.create_index('idx_dives_visibility_rating', 'dives', ['visibility_rating'])
    op.create_index('idx_dives_user_rating', 'dives', ['user_rating'])
    op.create_index('idx_dives_view_count', 'dives', ['view_count'])
    op.create_index('idx_dives_created_at', 'dives', ['created_at'])
    op.create_index('idx_dives_updated_at', 'dives', ['updated_at'])

def downgrade():
    # Remove indexes for dive sites sorting
    op.drop_index('idx_dive_sites_view_count', table_name='dive_sites')
    op.drop_index('idx_dive_sites_created_at', table_name='dive_sites')
    op.drop_index('idx_dive_sites_updated_at', table_name='dive_sites')
    
    # Remove indexes for diving centers sorting
    op.drop_index('idx_diving_centers_view_count', table_name='diving_centers')
    op.drop_index('idx_diving_centers_created_at', table_name='diving_centers')
    op.drop_index('idx_diving_centers_updated_at', table_name='diving_centers')
    
    # Remove indexes for dives sorting
    op.drop_index('idx_dives_dive_date', table_name='dives')
    op.drop_index('idx_dives_max_depth', table_name='dives')
    op.drop_index('idx_dives_duration', table_name='dives')
    op.drop_index('idx_dives_difficulty_level', table_name='dives')
    op.drop_index('idx_dives_visibility_rating', table_name='dives')
    op.drop_index('idx_dives_user_rating', table_name='dives')
    op.drop_index('idx_dives_view_count', table_name='dives')
    op.drop_index('idx_dives_created_at', table_name='dives')
    op.drop_index('idx_dives_updated_at', table_name='dives')
