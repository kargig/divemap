"""Add geographic fields to diving centers table

Revision ID: 0028
Revises: 0027
Create Date: 2025-08-16 20:45:12.841923

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0028'
down_revision = '0027'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add geographic fields to diving_centers table."""
    # Add country, region, and city columns to diving_centers table
    op.add_column('diving_centers', sa.Column('country', sa.String(length=100), nullable=True))
    op.add_column('diving_centers', sa.Column('region', sa.String(length=100), nullable=True))
    op.add_column('diving_centers', sa.Column('city', sa.String(length=100), nullable=True))
    
    # Create indexes for the new geographic fields
    op.create_index('ix_diving_centers_country', 'diving_centers', ['country'], unique=False)
    op.create_index('ix_diving_centers_region', 'diving_centers', ['region'], unique=False)
    op.create_index('ix_diving_centers_city', 'diving_centers', ['city'], unique=False)


def downgrade() -> None:
    """Remove geographic fields from diving_centers table."""
    # Drop indexes first
    op.drop_index('ix_diving_centers_city', 'diving_centers')
    op.drop_index('ix_diving_centers_region', 'diving_centers')
    op.drop_index('ix_diving_centers_country', 'diving_centers')
    
    # Drop columns
    op.drop_column('diving_centers', 'city')
    op.drop_column('diving_centers', 'region')
    op.drop_column('diving_centers', 'country')