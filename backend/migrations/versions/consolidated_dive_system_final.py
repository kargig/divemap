"""Consolidated dive system migration - final version

Revision ID: consolidated_dive_system_final
Revises: b3be3466a95a
Create Date: 2025-08-02 16:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'consolidated_dive_system_final'
down_revision = 'b3be3466a95a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to diving_centers table
    op.add_column('diving_centers', sa.Column('owner_id', sa.Integer(), nullable=True))
    op.add_column('diving_centers', sa.Column('ownership_status', sa.Enum('unclaimed', 'claimed', 'approved', name='ownershipstatus'), nullable=False, server_default='unclaimed'))
    
    # Create foreign key constraint for owner_id
    op.create_foreign_key(None, 'diving_centers', 'users', ['owner_id'], ['id'])
    
    # Create dives table
    op.create_table('dives',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=True),
        sa.Column('dive_information', sa.Text(), nullable=True),
        sa.Column('max_depth', sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column('average_depth', sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column('gas_bottles_used', sa.Text(), nullable=True),
        sa.Column('suit_type', sa.Enum('wet_suit', 'dry_suit', 'shortie', name='suittype'), nullable=True),
        sa.Column('difficulty_level', sa.Enum('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), nullable=True),
        sa.Column('visibility_rating', sa.Integer(), nullable=True),
        sa.Column('user_rating', sa.Integer(), nullable=True),
        sa.Column('dive_date', sa.Date(), nullable=False),
        sa.Column('dive_time', sa.Time(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dives_id'), 'dives', ['id'], unique=False)
    
    # Create dive_media table
    op.create_table('dive_media',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dive_id', sa.Integer(), nullable=False),
        sa.Column('media_type', sa.Enum('photo', 'video', 'dive_plan', 'external_link', name='mediatype'), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['dive_id'], ['dives.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dive_media_id'), 'dive_media', ['id'], unique=False)
    
    # Create dive_tags table
    op.create_table('dive_tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dive_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['dive_id'], ['dives.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['available_tags.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dive_tags_id'), 'dive_tags', ['id'], unique=False)
    
    # Remove columns from dive_sites table (these may not exist in all database states)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('dive_sites')]
    
    if 'dive_plans' in columns:
        op.drop_column('dive_sites', 'dive_plans')
    if 'gas_tanks_necessary' in columns:
        op.drop_column('dive_sites', 'gas_tanks_necessary')


def downgrade() -> None:
    # Remove dive_tags table
    op.drop_index(op.f('ix_dive_tags_id'), table_name='dive_tags')
    op.drop_table('dive_tags')
    
    # Remove dive_media table
    op.drop_index(op.f('ix_dive_media_id'), table_name='dive_media')
    op.drop_table('dive_media')
    
    # Remove dives table
    op.drop_index(op.f('ix_dives_id'), table_name='dives')
    op.drop_table('dives')
    
    # Remove columns from diving_centers table
    # First drop the foreign key constraint by finding its name
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    foreign_keys = inspector.get_foreign_keys('diving_centers')
    for fk in foreign_keys:
        if 'owner_id' in fk['constrained_columns']:
            op.drop_constraint(fk['name'], 'diving_centers', type_='foreignkey')
            break
    
    op.drop_column('diving_centers', 'ownership_status')
    op.drop_column('diving_centers', 'owner_id')
    
    # Add back columns to dive_sites table (if they were removed)
    op.add_column('dive_sites', sa.Column('dive_plans', sa.Text(), nullable=True))
    op.add_column('dive_sites', sa.Column('gas_tanks_necessary', sa.Text(), nullable=True)) 