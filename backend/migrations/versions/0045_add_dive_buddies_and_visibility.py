"""Add dive buddies and buddy visibility

Create dive_buddies junction table to link dives with buddy users, and add
buddy_visibility field to users table to control whether users can be added
as buddies by others.

Revision ID: 0045
Revises: 0044
Create Date: 2025-12-14 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '0045'
down_revision = '0044'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create dive_buddies table and add buddy_visibility to users."""
    # Add buddy_visibility column to users table
    op.add_column(
        'users',
        sa.Column('buddy_visibility', sa.String(20), nullable=False, server_default='public')
    )
    
    # Create index on buddy_visibility for efficient filtering
    op.create_index('idx_users_buddy_visibility', 'users', ['buddy_visibility'])
    
    # Create dive_buddies junction table
    op.create_table(
        'dive_buddies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dive_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['dive_id'], ['dives.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dive_id', 'user_id', name='_dive_buddy_uc')
    )
    
    # Create indexes for efficient queries
    op.create_index('idx_dive_buddies_dive_id', 'dive_buddies', ['dive_id'])
    op.create_index('idx_dive_buddies_user_id', 'dive_buddies', ['user_id'])


def downgrade() -> None:
    """Remove dive_buddies table and buddy_visibility column."""
    # Drop indexes
    op.drop_index('idx_dive_buddies_user_id', table_name='dive_buddies')
    op.drop_index('idx_dive_buddies_dive_id', table_name='dive_buddies')
    
    # Drop dive_buddies table
    op.drop_table('dive_buddies')
    
    # Drop index on users
    op.drop_index('idx_users_buddy_visibility', table_name='users')
    
    # Drop buddy_visibility column
    op.drop_column('users', 'buddy_visibility')
