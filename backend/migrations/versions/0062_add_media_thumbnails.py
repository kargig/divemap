"""add_media_thumbnails

Revision ID: 0062
Revises: 0061
Create Date: 2026-01-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0062'
down_revision = '0061'
branch_labels = None
depends_on = None


def upgrade():
    # Add thumbnail_url and medium_url to site_media table
    op.add_column('site_media', sa.Column('thumbnail_url', sa.String(length=500), nullable=True))
    op.add_column('site_media', sa.Column('medium_url', sa.String(length=500), nullable=True))

    # Add medium_url to dive_media table (thumbnail_url already exists)
    op.add_column('dive_media', sa.Column('medium_url', sa.String(length=500), nullable=True))


def downgrade():
    # Remove columns from dive_media table
    op.drop_column('dive_media', 'medium_url')

    # Remove columns from site_media table
    op.drop_column('site_media', 'medium_url')
    op.drop_column('site_media', 'thumbnail_url')
