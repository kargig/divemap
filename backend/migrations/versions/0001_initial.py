"""Initial migration

Revision ID: 0001
Revises:
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql
from sqlalchemy import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def table_exists(table_name):
    """Check if a table exists in the database (database-agnostic)"""
    connection = op.get_bind()
    inspector = inspect(connection)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # Create users table if it doesn't exist
    if not table_exists('users'):
        op.create_table('users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('username', sa.String(length=50), nullable=False),
            sa.Column('email', sa.String(length=100), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('google_id', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('is_admin', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('is_moderator', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('enabled', sa.Boolean(), server_default='1', nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email'),
            sa.UniqueConstraint('google_id'),
            sa.UniqueConstraint('username')
        )

    # Create dive_sites table if it doesn't exist
    if not table_exists('dive_sites'):
        op.create_table('dive_sites',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
            sa.Column('longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
            sa.Column('address', sa.String(length=500), nullable=True),
            sa.Column('access_instructions', sa.Text(), nullable=True),
            sa.Column('dive_plans', sa.Text(), nullable=True),
            sa.Column('gas_tanks_necessary', sa.String(length=255), nullable=True),
            sa.Column('difficulty_level', sa.String(length=50), nullable=True),
            sa.Column('marine_life', sa.Text(), nullable=True),
            sa.Column('safety_information', sa.Text(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )

    # Create diving_centers table if it doesn't exist
    if not table_exists('diving_centers'):
        op.create_table('diving_centers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('email', sa.String(length=100), nullable=True),
            sa.Column('phone', sa.String(length=50), nullable=True),
            sa.Column('website', sa.String(length=255), nullable=True),
            sa.Column('latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
            sa.Column('longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )

    # Create available_tags table if it doesn't exist
    if not table_exists('available_tags'):
        op.create_table('available_tags',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )

    # Create site_media table if it doesn't exist
    if not table_exists('site_media'):
        op.create_table('site_media',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('dive_site_id', sa.Integer(), nullable=False),
            sa.Column('media_type', sa.String(length=20), nullable=False),
            sa.Column('url', sa.String(length=500), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    # Create site_ratings table if it doesn't exist
    if not table_exists('site_ratings'):
        op.create_table('site_ratings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('dive_site_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('dive_site_id', 'user_id', name='unique_site_rating')
        )

    # Create site_comments table if it doesn't exist
    if not table_exists('site_comments'):
        op.create_table('site_comments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('dive_site_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('comment_text', sa.Text(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    # Create center_ratings table if it doesn't exist
    if not table_exists('center_ratings'):
        op.create_table('center_ratings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('diving_center_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('diving_center_id', 'user_id', name='unique_center_rating')
        )

    # Create center_comments table if it doesn't exist
    if not table_exists('center_comments'):
        op.create_table('center_comments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('diving_center_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('comment_text', sa.Text(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    # Create center_dive_sites table if it doesn't exist
    if not table_exists('center_dive_sites'):
        op.create_table('center_dive_sites',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('diving_center_id', sa.Integer(), nullable=False),
            sa.Column('dive_site_id', sa.Integer(), nullable=False),
            sa.Column('dive_cost', sa.DECIMAL(precision=10, scale=2), nullable=True),
            sa.Column('currency', sa.String(length=3), server_default='EUR', nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('diving_center_id', 'dive_site_id', name='unique_center_site')
        )

    # Create gear_rental_costs table if it doesn't exist
    if not table_exists('gear_rental_costs'):
        op.create_table('gear_rental_costs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('diving_center_id', sa.Integer(), nullable=False),
            sa.Column('item_name', sa.String(length=255), nullable=False),
            sa.Column('cost', sa.DECIMAL(precision=10, scale=2), nullable=False),
            sa.Column('currency', sa.String(length=3), server_default='EUR', nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    # Create dive_site_tags table if it doesn't exist
    if not table_exists('dive_site_tags'):
        op.create_table('dive_site_tags',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('dive_site_id', sa.Integer(), nullable=False),
            sa.Column('tag_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tag_id'], ['available_tags.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('dive_site_id', 'tag_id', name='unique_site_tag')
        )

    # Create indexes if they don't exist
    connection = op.get_bind()

    # Check and create indexes only if they don't exist
    try:
        op.create_index('idx_center_dive_sites_currency', 'center_dive_sites', ['currency'])
    except:
        pass  # Index might already exist

    try:
        op.create_index('idx_gear_rental_costs_currency', 'gear_rental_costs', ['currency'])
    except:
        pass  # Index might already exist

    try:
        op.create_index('idx_users_google_id', 'users', ['google_id'])
    except:
        pass  # Index might already exist


def downgrade() -> None:
    # Drop indexes
    try:
        op.drop_index('idx_users_google_id', 'users')
    except:
        pass

    try:
        op.drop_index('idx_gear_rental_costs_currency', 'gear_rental_costs')
    except:
        pass

    try:
        op.drop_index('idx_center_dive_sites_currency', 'center_dive_sites')
    except:
        pass

    # Drop tables (only if they exist)
    if table_exists('dive_site_tags'):
        op.drop_table('dive_site_tags')

    if table_exists('gear_rental_costs'):
        op.drop_table('gear_rental_costs')

    if table_exists('center_dive_sites'):
        op.drop_table('center_dive_sites')

    if table_exists('center_comments'):
        op.drop_table('center_comments')

    if table_exists('center_ratings'):
        op.drop_table('center_ratings')

    if table_exists('site_comments'):
        op.drop_table('site_comments')

    if table_exists('site_ratings'):
        op.drop_table('site_ratings')

    if table_exists('site_media'):
        op.drop_table('site_media')

    if table_exists('available_tags'):
        op.drop_table('available_tags')

    if table_exists('diving_centers'):
        op.drop_table('diving_centers')

    if table_exists('dive_sites'):
        op.drop_table('dive_sites')

    if table_exists('users'):
        op.drop_table('users')