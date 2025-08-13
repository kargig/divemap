"""Fix trip_difficulty_level nullable constraint

Revision ID: 0027
Revises: 0026
Create Date: 2025-08-13 00:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0027'
down_revision = '0026'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Make trip_difficulty_level nullable in parsed_dive_trips table."""
    # Alter the column to be nullable
    op.alter_column('parsed_dive_trips', 'trip_difficulty_level',
                    existing_type=mysql.INTEGER(),
                    nullable=True,
                    existing_server_default=sa.text("'2'"))


def downgrade() -> None:
    """Revert trip_difficulty_level back to NOT NULL."""
    # Alter the column back to NOT NULL
    op.alter_column('parsed_dive_trips', 'trip_difficulty_level',
                    existing_type=mysql.INTEGER(),
                    nullable=False,
                    existing_server_default=sa.text("'2'"))
