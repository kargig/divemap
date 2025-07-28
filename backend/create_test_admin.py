#!/usr/bin/env python3

"""
Script to create a test admin user for testing purposes
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

def create_test_admin():
    """Create a test admin user with known credentials"""
    
    # Test admin credentials
    username = "testadmin"
    email = "testadmin@example.com"
    password = "TestAdmin123!"
    
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"User '{username}' already exists. Updating password...")
            existing_user.password_hash = get_password_hash(password)
            db.commit()
            print(f"✅ Updated password for user '{username}'")
        else:
            # Create new admin user
            hashed_password = get_password_hash(password)
            new_user = User(
                username=username,
                email=email,
                password_hash=hashed_password,
                enabled=True,
                is_admin=True,
                is_moderator=False
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"✅ Created admin user '{username}' with email '{email}'")
        
        # Verify the user was created/updated
        user = db.query(User).filter(User.username == username).first()
        if user:
            print(f"✅ User verified: {user.username} (Admin: {user.is_admin}, Enabled: {user.enabled})")
            print(f"📧 Email: {user.email}")
            print(f"🔑 Test credentials: username='{username}', password='{password}'")
        else:
            print("❌ Failed to create/update user")
            
    except Exception as e:
        print(f"❌ Error creating test admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Creating test admin user...")
    create_test_admin()
    print("✅ Done!") 