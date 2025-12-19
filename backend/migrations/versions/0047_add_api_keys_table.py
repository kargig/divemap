"""Add API keys table

Add api_keys table for long-lived API key management.
Supports service authentication (e.g., Lambda functions) with
expiration, revocation, and usage tracking.

Revision ID: 0047
Revises: 0046
Create Date: 2025-12-15 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0047'
down_revision = '0046'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create api_keys table."""
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('key_hash', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_hash')
    )
    
    op.create_index('idx_api_key_hash', 'api_keys', ['key_hash'])
    op.create_index('idx_api_key_active', 'api_keys', ['is_active'])
    op.create_index('idx_api_key_expires', 'api_keys', ['expires_at'])


def downgrade() -> None:
    """Remove api_keys table."""
    op.drop_index('idx_api_key_expires', table_name='api_keys')
    op.drop_index('idx_api_key_active', table_name='api_keys')
    op.drop_index('idx_api_key_hash', table_name='api_keys')
    op.drop_table('api_keys')
