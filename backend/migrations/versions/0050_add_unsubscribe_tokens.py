"""Add unsubscribe tokens

Add email_notifications_opted_out and email_opt_out_at fields to users table.
Create unsubscribe_tokens table for storing unsubscribe tokens (one per user).
Set existing users' email_notifications_opted_out=False.

Revision ID: 0050
Revises: 0049
Create Date: 2025-12-20 20:40:28.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '0050'
down_revision = '0049'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add unsubscribe token fields and table."""
    # Add email_notifications_opted_out and email_opt_out_at columns to users table
    op.add_column('users', sa.Column('email_notifications_opted_out', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('email_opt_out_at', sa.DateTime(timezone=True), nullable=True))
    
    # Set existing users' email_notifications_opted_out=False
    op.execute(text("UPDATE users SET email_notifications_opted_out = 0 WHERE email_notifications_opted_out = 1"))
    
    # Create unsubscribe_tokens table
    op.create_table(
        'unsubscribe_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('previous_preferences', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
        sa.UniqueConstraint('user_id')  # One token per user
    )
    
    # Create indexes
    op.create_index('idx_unsubscribe_token', 'unsubscribe_tokens', ['token'])
    op.create_index('idx_unsubscribe_user', 'unsubscribe_tokens', ['user_id'])
    op.create_index('idx_unsubscribe_expires', 'unsubscribe_tokens', ['expires_at'])


def downgrade() -> None:
    """Remove unsubscribe token fields and table."""
    # Drop indexes
    op.drop_index('idx_unsubscribe_expires', table_name='unsubscribe_tokens')
    op.drop_index('idx_unsubscribe_user', table_name='unsubscribe_tokens')
    op.drop_index('idx_unsubscribe_token', table_name='unsubscribe_tokens')
    
    # Drop unsubscribe_tokens table
    op.drop_table('unsubscribe_tokens')
    
    # Remove columns from users table
    op.drop_column('users', 'email_opt_out_at')
    op.drop_column('users', 'email_notifications_opted_out')

