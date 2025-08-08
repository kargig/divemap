"""remove language field from dive site aliases

Revision ID: 0abf2a5c7f07
Revises: 75b96c8832aa
Create Date: 2025-08-08 20:55:30.820246

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0abf2a5c7f07'
down_revision = '75b96c8832aa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the language column from dive_site_aliases table
    op.drop_column('dive_site_aliases', 'language')


def downgrade() -> None:
    # Add back the language column (for rollback)
    op.add_column('dive_site_aliases', sa.Column('language', sa.String(10), nullable=True, index=True)) 