"""Remove unnecessary certification fields (name, date, number) - fixed

Revision ID: 9002229c2a67
Revises: c85d7af66778
Create Date: 2025-07-29 21:48:45.125979

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '9002229c2a67'
down_revision = 'c85d7af66778'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Only remove the unnecessary certification fields
    # Make certification_level non-nullable
    op.alter_column('user_certifications', 'certification_level',
               existing_type=mysql.VARCHAR(length=100),
               nullable=False)
    
    # Drop the certification_name index
    op.drop_index(op.f('ix_user_certifications_certification_name'), table_name='user_certifications')
    
    # Remove the unnecessary columns
    op.drop_column('user_certifications', 'certification_number')
    op.drop_column('user_certifications', 'certification_date')
    op.drop_column('user_certifications', 'certification_name')


def downgrade() -> None:
    # Add back the removed columns
    op.add_column('user_certifications', sa.Column('certification_name', mysql.VARCHAR(length=100), nullable=False))
    op.add_column('user_certifications', sa.Column('certification_date', sa.DATE(), nullable=True))
    op.add_column('user_certifications', sa.Column('certification_number', mysql.VARCHAR(length=100), nullable=True))
    
    # Recreate the certification_name index
    op.create_index(op.f('ix_user_certifications_certification_name'), 'user_certifications', ['certification_name'], unique=False)
    
    # Make certification_level nullable again
    op.alter_column('user_certifications', 'certification_level',
               existing_type=mysql.VARCHAR(length=100),
               nullable=True) 