"""add booking access and claim tokens

Revision ID: 0105
Revises: 0104
Create Date: 2026-10-14 15:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0105'
down_revision = '0104'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('octo_bookings', sa.Column('access_token_hash', sa.String(length=64), nullable=True))
    op.add_column('octo_bookings', sa.Column('access_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_octo_bookings_access_token_hash', 'octo_bookings', ['access_token_hash'])

    op.add_column('octo_booking_unit_items', sa.Column('claim_token_hash', sa.String(length=64), nullable=True))
    op.add_column(
        'octo_booking_unit_items',
        sa.Column('claim_status', sa.String(length=30), server_default='CLAIMED', nullable=False),
    )
    op.add_column('octo_booking_unit_items', sa.Column('claim_invited_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('octo_booking_unit_items', sa.Column('claim_completed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_octo_booking_unit_items_claim_token_hash', 'octo_booking_unit_items', ['claim_token_hash'], unique=True)

    # Allow guest medical audit rows without inventing user_id=1
    op.alter_column(
        'auth_audit_logs',
        'user_id',
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    op.alter_column(
        'auth_audit_logs',
        'user_id',
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.drop_index('ix_octo_booking_unit_items_claim_token_hash', table_name='octo_booking_unit_items')
    op.drop_column('octo_booking_unit_items', 'claim_completed_at')
    op.drop_column('octo_booking_unit_items', 'claim_invited_at')
    op.drop_column('octo_booking_unit_items', 'claim_status')
    op.drop_column('octo_booking_unit_items', 'claim_token_hash')

    op.drop_index('ix_octo_bookings_access_token_hash', table_name='octo_bookings')
    op.drop_column('octo_bookings', 'access_token_expires_at')
    op.drop_column('octo_bookings', 'access_token_hash')
