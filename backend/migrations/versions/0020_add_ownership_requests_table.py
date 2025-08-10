"""Add ownership requests table for tracking ownership history

Revision ID: 0020_ownership_requests
Revises: 0019_add_created_by_field
Create Date: 2025-08-10 13:56:48.413763

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0020_ownership_requests'
down_revision = '0019_add_created_by_field'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ownership_requests table
    op.create_table('ownership_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('request_status', sa.Enum('unclaimed', 'claimed', 'approved', 'denied', name='ownershipstatus'), nullable=False),
        sa.Column('request_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('processed_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_by', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ),
        sa.ForeignKeyConstraint(['processed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index(op.f('ix_ownership_requests_id'), 'ownership_requests', ['id'], unique=False)
    op.create_index(op.f('ix_ownership_requests_diving_center_id'), 'ownership_requests', ['diving_center_id'], unique=False)
    op.create_index(op.f('ix_ownership_requests_user_id'), 'ownership_requests', ['user_id'], unique=False)
    op.create_index(op.f('ix_ownership_requests_request_status'), 'ownership_requests', ['request_status'], unique=False)
    op.create_index(op.f('ix_ownership_requests_request_date'), 'ownership_requests', ['request_date'], unique=False)


def downgrade() -> None:
    # Drop indexes first
    op.drop_index(op.f('ix_ownership_requests_request_date'), table_name='ownership_requests')
    op.drop_index(op.f('ix_ownership_requests_request_status'), table_name='ownership_requests')
    op.drop_index(op.f('ix_ownership_requests_user_id'), table_name='ownership_requests')
    op.drop_index(op.f('ix_ownership_requests_diving_center_id'), table_name='ownership_requests')
    op.drop_index(op.f('ix_ownership_requests_id'), table_name='ownership_requests')
    
    # Drop the table
    op.drop_table('ownership_requests')
