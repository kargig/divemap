import sys
import os

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.database import SessionLocal
from app.models import User, UserChatRoom, UserChatRoomMember, UserChatMessage

def cleanup_broken_rooms():
    db = SessionLocal()
    try:
        # 1. Remove orphaned members (where user doesn't exist)
        all_members = db.query(UserChatRoomMember).all()
        removed_members_count = 0
        orphaned_room_ids = set()
        
        for m in all_members:
            user = db.query(User).filter(User.id == m.user_id).first()
            if not user:
                print(f"Removing orphaned member: Room {m.room_id}, User {m.user_id}")
                orphaned_room_ids.add(m.room_id)
                db.delete(m)
                removed_members_count += 1
        
        db.commit()
        print(f"✅ Removed {removed_members_count} orphaned members.")

        # 2. Find DM rooms that now have fewer than 2 members
        all_rooms = db.query(UserChatRoom).all()
        removed_rooms_count = 0
        
        for room in all_rooms:
            member_count = db.query(UserChatRoomMember).filter(UserChatRoomMember.room_id == room.id).count()
            
            # If it's a DM and has less than 2 members, it's broken
            # If it's any room with 0 members, it's broken
            is_broken = (not room.is_group and member_count < 2) or (member_count == 0)
            
            if is_broken:
                print(f"Removing broken room {room.id} ({'DM' if not room.is_group else 'Group'} with {member_count} members)")
                # Cascading delete should handle members and messages, but let's be safe
                db.query(UserChatMessage).filter(UserChatMessage.room_id == room.id).delete()
                db.query(UserChatRoomMember).filter(UserChatRoomMember.room_id == room.id).delete()
                db.delete(room)
                removed_rooms_count += 1
        
        db.commit()
        print(f"✅ Removed {removed_rooms_count} broken rooms.")

    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting cleanup of broken chat data...")
    cleanup_broken_rooms()
    print("🏁 Cleanup completed.")
