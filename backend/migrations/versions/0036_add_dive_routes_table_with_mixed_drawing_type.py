"""add_dive_routes_table_without_drawing_type

Revision ID: 0036
Revises: 0035
Create Date: 2025-10-12 14:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision = '0036'
down_revision = '0035'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the dive_routes table with multi-segment support (drawing_type computed on-demand)
    op.create_table('dive_routes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('route_data', sa.JSON(), nullable=False, comment='Multi-segment GeoJSON FeatureCollection'),
        sa.Column('route_type', sa.Enum('scuba', 'walk', 'swim', name='routetype'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=True),
        # Soft delete fields
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index(op.f('ix_dive_routes_dive_site_id'), 'dive_routes', ['dive_site_id'], unique=False)
    op.create_index(op.f('ix_dive_routes_created_by'), 'dive_routes', ['created_by'], unique=False)
    op.create_index(op.f('ix_dive_routes_deleted_at'), 'dive_routes', ['deleted_at'], unique=False)
    op.create_index('idx_dive_routes_dive_site_active', 'dive_routes', ['dive_site_id', 'deleted_at'], unique=False)
    op.create_index('idx_dive_routes_route_type', 'dive_routes', ['route_type'], unique=False)
    
    # Add selected_route_id to dives table
    op.add_column('dives', sa.Column('selected_route_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_dives_selected_route_id', 'dives', 'dive_routes', ['selected_route_id'], ['id'])
    op.create_index(op.f('ix_dives_selected_route_id'), 'dives', ['selected_route_id'], unique=False)


def downgrade() -> None:
    # Remove selected_route_id from dives table
    # Drop foreign key constraint first, then index
    try:
        op.drop_constraint('fk_dives_selected_route_id', 'dives', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    
    try:
        op.drop_index(op.f('ix_dives_selected_route_id'), table_name='dives')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_column('dives', 'selected_route_id')
    except Exception:
        pass  # Column might not exist
    
    # Drop the dive_routes table
    try:
        op.drop_index('idx_dive_routes_route_type', table_name='dive_routes')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_index('idx_dive_routes_dive_site_active', table_name='dive_routes')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_index(op.f('ix_dive_routes_deleted_at'), table_name='dive_routes')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_index(op.f('ix_dive_routes_created_by'), table_name='dive_routes')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_index(op.f('ix_dive_routes_dive_site_id'), table_name='dive_routes')
    except Exception:
        pass  # Index might not exist
    
    try:
        op.drop_table('dive_routes')
    except Exception:
        pass  # Table might not exist
