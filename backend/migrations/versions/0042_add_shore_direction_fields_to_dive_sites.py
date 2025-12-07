"""Add shore direction fields to dive sites

Add shore direction fields to dive_sites table for wind overlay feature.
These fields store the compass bearing (0-360 degrees) indicating which
direction the shore/beach faces, along with metadata about how it was determined.

Revision ID: 0042
Revises: 0041
Create Date: 2025-11-30 12:40:29.230081

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0042'
down_revision = '0041'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add shore direction fields to dive_sites table."""
    # Add shore_direction column (compass bearing 0-360 degrees)
    op.add_column('dive_sites', sa.Column('shore_direction', sa.DECIMAL(precision=5, scale=2), nullable=True))
    
    # Add shore_direction_confidence enum column
    op.add_column('dive_sites', sa.Column('shore_direction_confidence', sa.Enum('high', 'medium', 'low', name='shore_direction_confidence'), nullable=True))
    
    # Add shore_direction_method column (e.g., 'osm_coastline', 'manual', 'ai')
    op.add_column('dive_sites', sa.Column('shore_direction_method', sa.String(length=50), nullable=True))
    
    # Add shore_direction_distance_m column (distance to coastline in meters)
    op.add_column('dive_sites', sa.Column('shore_direction_distance_m', sa.DECIMAL(precision=8, scale=2), nullable=True))


def downgrade() -> None:
    """Remove shore direction fields from dive_sites table."""
    # Drop columns in reverse order
    op.drop_column('dive_sites', 'shore_direction_distance_m')
    op.drop_column('dive_sites', 'shore_direction_method')
    op.drop_column('dive_sites', 'shore_direction_confidence')
    op.drop_column('dive_sites', 'shore_direction')
    
    # Drop the enum type if it exists (MySQL handles this automatically, but included for completeness)
    # Note: MySQL doesn't require explicit enum type dropping, but if needed:
    # op.execute("DROP TYPE IF EXISTS shore_direction_confidence")
