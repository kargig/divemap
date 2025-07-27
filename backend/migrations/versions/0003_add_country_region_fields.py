"""Add country and region fields to dive sites

Revision ID: 0003
Revises: 0002
Create Date: 2025-07-27 15:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add country and region columns to dive_sites table
    op.add_column('dive_sites', sa.Column('country', sa.String(length=100), nullable=True))
    op.add_column('dive_sites', sa.Column('region', sa.String(length=100), nullable=True))
    
    # Create indexes for the new columns
    op.create_index(op.f('ix_dive_sites_country'), 'dive_sites', ['country'], unique=False)
    op.create_index(op.f('ix_dive_sites_region'), 'dive_sites', ['region'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_dive_sites_region'), table_name='dive_sites')
    op.drop_index(op.f('ix_dive_sites_country'), table_name='dive_sites')
    
    # Drop columns
    op.drop_column('dive_sites', 'region')
    op.drop_column('dive_sites', 'country') 