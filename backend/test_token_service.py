#!/usr/bin/env python3

from app.token_service import token_service
from app.database import get_db
from app.models import User
from app.auth import authenticate_user

def test_token_service():
    try:
        db = next(get_db())
        print("Database connection successful")
        
        user = authenticate_user(db, 'bubble', 'Bubble123!')
        print(f"User authenticated: {user.username if user else None}")
        
        if user:
            token_data = token_service.create_token_pair(user, None, db)
            print(f"Token data keys: {list(token_data.keys()) if token_data else None}")
            print(f"Refresh token exists: {'refresh_token' in token_data if token_data else False}")
            
            if token_data and 'refresh_token' in token_data:
                print(f"Refresh token length: {len(token_data['refresh_token'])}")
                print(f"Refresh token preview: {token_data['refresh_token'][:50]}...")
            else:
                print("No refresh token in response")
        else:
            print("User authentication failed")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_token_service()
