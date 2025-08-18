"""Add refresh tokens system

Revision ID: 0029_add_refresh_tokens_system
Revises: 0028_add_geographic_fields_to_diving_centers
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0029_add_refresh_tokens_system'
down_revision = '0028_add_geographic_fields_to_diving_centers'
branch_labels = None
depends_on = None


def upgrade():
    # Create refresh_tokens table
    op.create_table('refresh_tokens',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), nullable=True),
        sa.Column('device_info', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('idx_refresh_tokens_expires_at', 'refresh_tokens', ['expires_at'])
    op.create_index('idx_refresh_tokens_revoked', 'refresh_tokens', ['is_revoked'])
    
    # Create auth_audit_logs table
    op.create_table('auth_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('auth_audit_logs')
    op.drop_table('refresh_tokens')
