"""Add missing fields to ParsedDiveTrip model for enhanced newsletter parsing

Revision ID: parsed_trip_enhance
Revises: add_diving_center_id_to_dives
Create Date: 2025-08-04 22:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'parsed_trip_enhance'
down_revision = 'add_diving_center_id_to_dives'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new fields to parsed_dive_trips table
    op.add_column('parsed_dive_trips', sa.Column('trip_duration', sa.Integer(), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('trip_difficulty_level', sa.Enum('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('trip_price', sa.DECIMAL(precision=10, scale=2), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('trip_currency', sa.String(length=3), nullable=False, server_default='EUR'))
    op.add_column('parsed_dive_trips', sa.Column('group_size_limit', sa.Integer(), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('current_bookings', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('parsed_dive_trips', sa.Column('trip_description', sa.Text(), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('special_requirements', sa.Text(), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('trip_status', sa.Enum('scheduled', 'confirmed', 'cancelled', 'completed', name='tripstatus'), nullable=False, server_default='scheduled'))
    op.add_column('parsed_dive_trips', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    
    # Create indexes for new fields
    op.create_index(op.f('ix_parsed_dive_trips_trip_currency'), 'parsed_dive_trips', ['trip_currency'], unique=False)
    op.create_index(op.f('ix_parsed_dive_trips_trip_status'), 'parsed_dive_trips', ['trip_status'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_parsed_dive_trips_trip_status'), table_name='parsed_dive_trips')
    op.drop_index(op.f('ix_parsed_dive_trips_trip_currency'), table_name='parsed_dive_trips')
    
    # Drop columns
    op.drop_column('parsed_dive_trips', 'updated_at')
    op.drop_column('parsed_dive_trips', 'created_at')
    op.drop_column('parsed_dive_trips', 'trip_status')
    op.drop_column('parsed_dive_trips', 'special_requirements')
    op.drop_column('parsed_dive_trips', 'trip_description')
    op.drop_column('parsed_dive_trips', 'current_bookings')
    op.drop_column('parsed_dive_trips', 'group_size_limit')
    op.drop_column('parsed_dive_trips', 'trip_currency')
    op.drop_column('parsed_dive_trips', 'trip_price')
    op.drop_column('parsed_dive_trips', 'trip_difficulty_level')
    op.drop_column('parsed_dive_trips', 'trip_duration') 