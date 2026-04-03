"""migrate_chat_to_uuid

Revision ID: 0080
Revises: 0079
Create Date: 2026-04-02 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0080'
down_revision = '0079'
branch_labels = None
depends_on = None

def upgrade() -> None:
    import uuid
    # 1. Add uuid columns
    op.add_column('user_chat_rooms', sa.Column('id_uuid', sa.String(36), nullable=True))
    op.add_column('user_chat_messages', sa.Column('room_id_uuid', sa.String(36), nullable=True))
    op.add_column('user_chat_room_members', sa.Column('room_id_uuid', sa.String(36), nullable=True))

    # 2. Populate id_uuid for user_chat_rooms using Python's uuid.uuid4() for V4 randomness
    # Create a database connection
    conn = op.get_bind()
    rooms = conn.execute(sa.text("SELECT id FROM user_chat_rooms")).fetchall()
    
    for room in rooms:
        old_id = room[0]
        new_uuid = str(uuid.uuid4())
        conn.execute(
            sa.text("UPDATE user_chat_rooms SET id_uuid = :new_uuid WHERE id = :old_id"),
            {"new_uuid": new_uuid, "old_id": old_id}
        )
    
    # 3. Populate room_id_uuid for child tables by joining with user_chat_rooms
    op.execute('UPDATE user_chat_messages msg JOIN user_chat_rooms rm ON msg.room_id = rm.id SET msg.room_id_uuid = rm.id_uuid')
    op.execute('UPDATE user_chat_room_members mmb JOIN user_chat_rooms rm ON mmb.room_id = rm.id SET mmb.room_id_uuid = rm.id_uuid')

    # 4. Drop old FK constraints
    # These names come from MySQL information schema
    # Note: we need to drop the new FKs added in 0079 as well!
    try:
        op.drop_constraint('user_chat_messages_ibfk_1', 'user_chat_messages', type_='foreignkey')
    except:
        pass
    try:
        op.drop_constraint('user_chat_room_members_ibfk_1', 'user_chat_room_members', type_='foreignkey')
    except:
        pass
    try:
        op.drop_constraint('fk_user_chat_rooms_diving_center', 'user_chat_rooms', type_='foreignkey')
        op.drop_constraint('fk_user_chat_rooms_last_responder', 'user_chat_rooms', type_='foreignkey')
    except:
        pass

    # Drop composite index depending on room_id
    op.drop_index('idx_chat_messages_room_updated', table_name='user_chat_messages')
    
    # Remove auto-increment from id before dropping primary key
    op.execute("ALTER TABLE user_chat_rooms MODIFY id INT NOT NULL")

    # 5. Drop old PK constraints and index
    op.drop_constraint('PRIMARY', 'user_chat_rooms', type_='primary')
    op.drop_index('ix_user_chat_rooms_id', table_name='user_chat_rooms')
    op.drop_constraint('PRIMARY', 'user_chat_room_members', type_='primary')

    # 6. Drop old integer columns
    op.drop_column('user_chat_rooms', 'id')
    op.drop_column('user_chat_messages', 'room_id')
    op.drop_column('user_chat_room_members', 'room_id')

    # 7. Rename UUID columns to final names
    op.alter_column('user_chat_rooms', 'id_uuid', new_column_name='id', existing_type=sa.String(36), nullable=False)
    op.alter_column('user_chat_messages', 'room_id_uuid', new_column_name='room_id', existing_type=sa.String(36), nullable=False)
    op.alter_column('user_chat_room_members', 'room_id_uuid', new_column_name='room_id', existing_type=sa.String(36), nullable=False)

    # 8. Recreate PKs and FKs
    op.create_primary_key('pk_user_chat_rooms', 'user_chat_rooms', ['id'])
    op.create_primary_key('pk_user_chat_room_members', 'user_chat_room_members', ['room_id', 'user_id'])
    op.create_index('ix_user_chat_rooms_id', 'user_chat_rooms', ['id'])

    op.create_foreign_key('fk_user_chat_messages_room_id', 'user_chat_messages', 'user_chat_rooms', ['room_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_user_chat_room_members_room_id', 'user_chat_room_members', 'user_chat_rooms', ['room_id'], ['id'], ondelete='CASCADE')
    
    # Restore the B2C FKs
    op.create_foreign_key('fk_user_chat_rooms_diving_center', 'user_chat_rooms', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_user_chat_rooms_last_responder', 'user_chat_rooms', 'users', ['last_responded_by_id'], ['id'], ondelete='SET NULL')

    op.create_index('idx_chat_messages_room_updated', 'user_chat_messages', ['room_id', 'updated_at'])

def downgrade() -> None:
    raise NotImplementedError("Downgrading from UUIDs to integers is destructive and not supported.")
