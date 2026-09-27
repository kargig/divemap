"""create trip_briefings table

Revision ID: 0099
Revises: 0098
Create Date: 2026-09-27 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0099'
down_revision = '0098'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'trip_briefings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('availability_id', sa.String(length=36), sa.ForeignKey('octo_availability_slots.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(length=30), server_default='DRAFT_PENDING_REVIEW', nullable=False),
        sa.Column('active_dive_site_id', sa.Integer(), sa.ForeignKey('dive_sites.id', ondelete='SET NULL'), nullable=True),
        sa.Column('meeting_notes', sa.Text(), nullable=True),
        sa.Column('site_profile_notes', sa.Text(), nullable=True),
        sa.Column('hazards_and_safety_notes', sa.Text(), nullable=True),
        sa.Column('marine_life_highlights', sa.JSON(), nullable=True),
        sa.Column('weather_forecast_data', sa.JSON(), nullable=True),
        sa.Column('crew_manifest', sa.JSON(), nullable=True),
        sa.Column('emergency_action_plan', sa.JSON(), nullable=True),
        sa.Column('contingency_notes', sa.Text(), nullable=True),
        sa.Column('compiled_pdf_path', sa.String(length=500), nullable=True),
        sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispatched_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_trip_briefings_availability_id', 'trip_briefings', ['availability_id'], unique=True)
    op.create_index('ix_trip_briefings_status', 'trip_briefings', ['status'])

def downgrade():
    op.drop_index('ix_trip_briefings_status', table_name='trip_briefings')
    op.drop_index('ix_trip_briefings_availability_id', table_name='trip_briefings')
    op.drop_table('trip_briefings')
