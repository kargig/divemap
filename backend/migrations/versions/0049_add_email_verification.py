"""Add email verification

Add email_verified and email_verified_at fields to users table.
Create email_verification_tokens table for storing verification tokens.
Set existing users' email_verified=True for backward compatibility.
Set Google OAuth users' email_verified=True automatically.

Revision ID: 0049
Revises: 0048
Create Date: 2025-12-20 12:48:30.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '0049'
down_revision = '0048'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add email verification fields and table."""
    # Add email_verified and email_verified_at columns to users table
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))
    
    # Set existing users' email_verified=True for backward compatibility
    op.execute(text("UPDATE users SET email_verified = 1 WHERE email_verified = 0"))
    
    # Set Google OAuth users' email_verified=True automatically
    op.execute(text("UPDATE users SET email_verified = 1, email_verified_at = created_at WHERE google_id IS NOT NULL"))
    
    # Create email_verification_tokens table
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    
    # Create indexes
    op.create_index('idx_email_verification_token', 'email_verification_tokens', ['token'])
    op.create_index('idx_email_verification_user', 'email_verification_tokens', ['user_id'])
    op.create_index('idx_email_verification_expires', 'email_verification_tokens', ['expires_at'])


def downgrade() -> None:
    """Remove email verification fields and table."""
    # Drop indexes
    op.drop_index('idx_email_verification_expires', table_name='email_verification_tokens')
    op.drop_index('idx_email_verification_user', table_name='email_verification_tokens')
    op.drop_index('idx_email_verification_token', table_name='email_verification_tokens')
    
    # Drop email_verification_tokens table
    op.drop_table('email_verification_tokens')
    
    # Remove columns from users table
    op.drop_column('users', 'email_verified_at')
    op.drop_column('users', 'email_verified')

