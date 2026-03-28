import sys
import os

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.database import SessionLocal
from app.models import User, UserChatRoom, UserChatRoomMember

def check_orphans():
    db = SessionLocal()
    try:
        members = db.query(UserChatRoomMember).all()
        print(f"Checking {len(members)} chat room members...")
        
        orphans = []
        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            if not user:
                orphans.append(m)
                print(f"🚨 Orphan found: Room {m.room_id} has member user_id {m.user_id} but user does not exist in 'users' table!")

        if not orphans:
            print("✅ No orphans found in user_chat_room_members.")
        else:
            print(f"\nTotal orphans found: {len(orphans)}")
            print("These orphans cause 'Unknown User' in the UI because the join fails or returns null for the user relationship.")

        # Check rooms with no valid members at all
        rooms = db.query(UserChatRoom).all()
        for r in rooms:
            valid_members = db.query(UserChatRoomMember).join(User).filter(UserChatRoomMember.room_id == r.id).count()
            if valid_members == 0:
                 print(f"⚠️ Room {r.id} ('{r.name or 'DM'}') has ZERO valid users.")
            elif not r.is_group and valid_members < 2:
                 print(f"⚠️ DM Room {r.id} has only {valid_members} valid user(s). DM usually needs 2.")

    finally:
        db.close()

if __name__ == "__main__":
    check_orphans()
