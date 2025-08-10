"""Increase depth precision to 3 decimal places

Revision ID: 0018_depth_precision
Revises: 0abf2a5c7f07
Create Date: 2025-08-09 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0018_increase_depth_precision_to_3_decimal_places'
down_revision = '0abf2a5c7f07'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change max_depth and average_depth precision in dives table
    op.alter_column('dives', 'max_depth',
               existing_type=mysql.DECIMAL(precision=5, scale=2),
               type_=sa.DECIMAL(precision=6, scale=3),
               existing_nullable=True)

    op.alter_column('dives', 'average_depth',
               existing_type=mysql.DECIMAL(precision=5, scale=2),
               type_=sa.DECIMAL(precision=6, scale=3),
               existing_nullable=True)

    # Change max_depth precision in dive_sites table
    op.alter_column('dive_sites', 'max_depth',
               existing_type=mysql.DECIMAL(precision=5, scale=2),
               type_=sa.DECIMAL(precision=6, scale=3),
               existing_nullable=True)


def downgrade() -> None:
    # Revert max_depth and average_depth precision in dives table
    op.alter_column('dives', 'max_depth',
               existing_type=sa.DECIMAL(precision=6, scale=3),
               type_=mysql.DECIMAL(precision=5, scale=2),
               existing_nullable=True)

    op.alter_column('dives', 'average_depth',
               existing_type=sa.DECIMAL(precision=6, scale=3),
               type_=mysql.DECIMAL(precision=5, scale=2),
               existing_nullable=True)

    # Revert max_depth precision in dive_sites table
    op.alter_column('dive_sites', 'max_depth',
               existing_type=sa.DECIMAL(precision=6, scale=3),
               type_=mysql.DECIMAL(precision=5, scale=2),
               existing_nullable=True)
