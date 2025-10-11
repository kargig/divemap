"""add_walk_swim_scuba_route_types

Revision ID: 0036
Revises: 0035
Create Date: 2025-10-11 21:10:00.252573

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0036'
down_revision = '0035'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new route types to the existing enum
    op.execute("ALTER TABLE dive_routes MODIFY COLUMN route_type ENUM('line', 'polygon', 'waypoints', 'walk', 'swim', 'scuba') DEFAULT 'line'")


def downgrade() -> None:
    # Remove the new route types from the enum
    op.execute("ALTER TABLE dive_routes MODIFY COLUMN route_type ENUM('line', 'polygon', 'waypoints') DEFAULT 'line'") 
