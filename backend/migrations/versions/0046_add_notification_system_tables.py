"""Add notification system tables

Add complete notification system infrastructure:
- notification_preferences table for user notification preferences
- notifications table for individual notification records
- email_config table for SMTP configuration (admin-managed)
- last_notification_check column to users table

Supports both in-app and email notifications with user-configurable
preferences, frequency controls, and area filtering.

Revision ID: 0045
Revises: 0044
Create Date: 2025-12-15 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0046'
down_revision = '0045'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create notification system tables and update users table."""
    
    # 1. Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('enable_website', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('enable_email', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('frequency', sa.String(length=20), nullable=False, server_default='immediate'),
        sa.Column('area_filter', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'category', name='unique_user_category')
    )
    
    op.create_index('idx_user_id', 'notification_preferences', ['user_id'])
    op.create_index('idx_category', 'notification_preferences', ['category'])
    
    # 2. Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link_url', sa.String(length=500), nullable=True),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_sent', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_user_unread', 'notifications', ['user_id', 'is_read', 'created_at'])
    op.create_index('idx_category', 'notifications', ['category'])
    op.create_index('idx_entity', 'notifications', ['entity_type', 'entity_id'])
    
    # 3. Create email_config table
    op.create_table(
        'email_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('smtp_host', sa.String(length=255), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False, server_default='587'),
        sa.Column('use_starttls', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('smtp_username', sa.String(length=255), nullable=False),
        sa.Column('smtp_password', sa.String(length=500), nullable=False),
        sa.Column('from_email', sa.String(length=255), nullable=False),
        sa.Column('from_name', sa.String(length=255), nullable=False, server_default='Divemap'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 4. Add last_notification_check column to users table
    op.add_column(
        'users',
        sa.Column('last_notification_check', sa.DateTime(timezone=True), nullable=True)
    )
    
    op.create_index('idx_last_notification_check', 'users', ['last_notification_check'])


def downgrade() -> None:
    """Remove notification system tables and column."""
    
    # Remove last_notification_check column
    op.drop_index('idx_last_notification_check', table_name='users')
    op.drop_column('users', 'last_notification_check')
    
    # Drop email_config table
    op.drop_table('email_config')
    
    # Drop notifications table
    op.drop_index('idx_entity', table_name='notifications')
    op.drop_index('idx_category', table_name='notifications')
    op.drop_index('idx_user_unread', table_name='notifications')
    op.drop_table('notifications')
    
    # Drop notification_preferences table
    op.drop_index('idx_category', table_name='notification_preferences')
    op.drop_index('idx_user_id', table_name='notification_preferences')
    op.drop_table('notification_preferences')
