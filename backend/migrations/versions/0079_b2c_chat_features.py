"""b2c_chat_features

Revision ID: 0079
Revises: 0078
Create Date: 2026-04-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0079'
down_revision = '0078'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Diving Center Managers & Logo (from 0079)
    op.create_table('diving_center_managers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('diving_center_id', 'user_id', name='uix_center_manager')
    )
    op.create_index(op.f('ix_diving_center_managers_id'), 'diving_center_managers', ['id'], unique=False)
    op.add_column('diving_centers', sa.Column('logo_url', sa.String(length=500), nullable=True))

    # 2. B2C Chat Models & Settings (from 0080)
    op.create_table('diving_center_chat_settings',
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('auto_greeting', sa.Text(), nullable=True),
        sa.Column('quick_replies', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('diving_center_id')
    )
    op.create_table('diving_center_followers',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'diving_center_id')
    )
    op.add_column('user_chat_rooms', sa.Column('diving_center_id', sa.Integer(), nullable=True))
    op.add_column('user_chat_rooms', sa.Column('is_broadcast', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('user_chat_rooms', sa.Column('business_status', sa.Enum('UNREAD', 'READ', 'RESOLVED', name='businesschatstatus'), nullable=False, server_default='READ'))
    op.add_column('user_chat_rooms', sa.Column('last_responded_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_user_chat_rooms_diving_center', 'user_chat_rooms', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_user_chat_rooms_last_responder', 'user_chat_rooms', 'users', ['last_responded_by_id'], ['id'], ondelete='SET NULL')

    # 3. Message Type (from 0081)
    op.add_column('user_chat_messages', sa.Column('message_type', sa.String(length=50), nullable=False, server_default='TEXT'))

    # 4. Chat Archiving (from 0083)
    op.add_column('user_chat_room_members', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('user_chat_rooms', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('user_chat_rooms', 'is_archived')
    op.drop_column('user_chat_room_members', 'is_archived')
    op.drop_column('user_chat_messages', 'message_type')
    op.drop_constraint('fk_user_chat_rooms_last_responder', 'user_chat_rooms', type_='foreignkey')
    op.drop_constraint('fk_user_chat_rooms_diving_center', 'user_chat_rooms', type_='foreignkey')
    op.drop_column('user_chat_rooms', 'last_responded_by_id')
    op.drop_column('user_chat_rooms', 'business_status')
    op.drop_column('user_chat_rooms', 'is_broadcast')
    op.drop_column('user_chat_rooms', 'diving_center_id')
    op.drop_table('diving_center_followers')
    op.drop_table('diving_center_chat_settings')
    op.drop_column('diving_centers', 'logo_url')
    op.drop_index(op.f('ix_diving_center_managers_id'), table_name='diving_center_managers')
    op.drop_table('diving_center_managers')
