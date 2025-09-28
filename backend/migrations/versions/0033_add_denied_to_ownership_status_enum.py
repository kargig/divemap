"""Add 'denied' value to ownership_status enum

Revision ID: 0033_add_denied_to_ownership_status_enum
Revises: 0032_add_dive_profile_metadata
Create Date: 2025-09-28 17:47:04.747998

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision = '0033'
down_revision = '0032'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'denied' value to the ownership_status enum
    # First, we need to alter the enum to include the new value
    op.execute("ALTER TABLE diving_centers MODIFY COLUMN ownership_status ENUM('unclaimed', 'claimed', 'approved', 'denied') NOT NULL DEFAULT 'unclaimed'")


def downgrade() -> None:
    # Remove 'denied' value from the ownership_status enum
    # First, update any existing 'denied' values to 'unclaimed'
    op.execute("UPDATE diving_centers SET ownership_status = 'unclaimed' WHERE ownership_status = 'denied'")
    # Then alter the enum to remove the 'denied' value
    op.execute("ALTER TABLE diving_centers MODIFY COLUMN ownership_status ENUM('unclaimed', 'claimed', 'approved') NOT NULL DEFAULT 'unclaimed'") 
