"""Add dive routes table

Revision ID: 0035_add_dive_routes_table
Revises: 0034_add_dive_site_verification
Create Date: 2025-09-29 01:53:27.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0035'
down_revision = '0034'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old dive_routes table if it exists
    op.drop_table('dive_routes')
    
    # Create the new dive_routes table with simplified schema
    op.create_table('dive_routes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('route_data', sa.JSON(), nullable=False),
        sa.Column('route_type', sa.Enum('line', 'polygon', 'waypoints', name='routetype'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dive_routes_dive_site_id'), 'dive_routes', ['dive_site_id'], unique=False)
    op.create_index(op.f('ix_dive_routes_created_by'), 'dive_routes', ['created_by'], unique=False)
    op.create_index(op.f('ix_dive_routes_deleted_at'), 'dive_routes', ['deleted_at'], unique=False)
    op.create_index('idx_dive_routes_dive_site_active', 'dive_routes', ['dive_site_id', 'deleted_at'], unique=False)
    
    # Add selected_route_id to dives table
    op.add_column('dives', sa.Column('selected_route_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_dives_selected_route_id', 'dives', 'dive_routes', ['selected_route_id'], ['id'])
    op.create_index(op.f('ix_dives_selected_route_id'), 'dives', ['selected_route_id'], unique=False)


def downgrade():
    # Remove selected_route_id from dives table
    op.drop_index(op.f('ix_dives_selected_route_id'), table_name='dives')
    op.drop_constraint('fk_dives_selected_route_id', 'dives', type_='foreignkey')
    op.drop_column('dives', 'selected_route_id')
    
    # Drop the dive_routes table
    op.drop_index('idx_dive_routes_dive_site_active', table_name='dive_routes')
    op.drop_index(op.f('ix_dive_routes_deleted_at'), table_name='dive_routes')
    op.drop_index(op.f('ix_dive_routes_created_by'), table_name='dive_routes')
    op.drop_index(op.f('ix_dive_routes_dive_site_id'), table_name='dive_routes')
    op.drop_table('dive_routes')
