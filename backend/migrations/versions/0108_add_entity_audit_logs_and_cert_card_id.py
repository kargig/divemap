"""add entity_audit_logs and cert card_id

Revision ID: 0108
Revises: 0107
Create Date: 2026-10-23 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = '0108'
down_revision = '0107'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'entity_audit_logs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=False),
        sa.Column('entity_id', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=32), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_role', sa.String(length=20), nullable=True),
        sa.Column('auth_method', sa.String(length=20), nullable=False, server_default='jwt'),
        sa.Column('pat_id', sa.Integer(), nullable=True),
        sa.Column('pat_name', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('client_type', sa.String(length=30), nullable=False, server_default='web'),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['pat_id'], ['personal_access_tokens.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_entity_lookup', 'entity_audit_logs', ['entity_type', 'entity_id', 'created_at'])
    op.create_index('idx_user_lookup', 'entity_audit_logs', ['user_id', 'created_at'])
    op.create_index('idx_pat_lookup', 'entity_audit_logs', ['pat_id'])
    op.create_index('idx_action_lookup', 'entity_audit_logs', ['action'])
    op.create_index('idx_created_at', 'entity_audit_logs', ['created_at'])

    op.add_column('user_certifications', sa.Column('card_id', sa.String(length=100), nullable=True))
    op.add_column('user_certifications', sa.Column('certification_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('user_certifications', 'certification_date')
    op.drop_column('user_certifications', 'card_id')
    op.drop_index('idx_created_at', table_name='entity_audit_logs')
    op.drop_index('idx_action_lookup', table_name='entity_audit_logs')
    op.drop_index('idx_pat_lookup', table_name='entity_audit_logs')
    op.drop_index('idx_user_lookup', table_name='entity_audit_logs')
    op.drop_index('idx_entity_lookup', table_name='entity_audit_logs')
    op.drop_table('entity_audit_logs')
