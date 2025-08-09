"""deprecate alternative_names column

Revision ID: 75b96c8832aa
Revises: 29fac01eff2e
Create Date: 2025-08-08 20:47:24.557362

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '75b96c8832aa'
down_revision = '29fac01eff2e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the alternative_names column from dive_sites table
    op.drop_column('dive_sites', 'alternative_names')


def downgrade() -> None:
    # Add back the alternative_names column (for rollback)
    op.add_column('dive_sites', sa.Column('alternative_names', sa.Text(), nullable=True))