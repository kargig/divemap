from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import User, SiteRating, SiteComment, CenterComment
from app.schemas import UserResponse, UserUpdate, UserCreateAdmin, UserUpdateAdmin, UserListResponse, PasswordChangeRequest, UserPublicProfileResponse, UserStats
from app.auth import get_current_active_user, get_current_admin_user, get_password_hash, verify_password
from sqlalchemy import func

router = APIRouter()

# Admin user management endpoints - must be defined before regular routes
@router.get("/admin/users", response_model=List[UserListResponse])
async def list_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""
    users = db.query(User).all()
    return users

@router.post("/admin/users", response_model=UserListResponse)
async def create_user(
    user_data: UserCreateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        is_admin=user_data.is_admin,
        is_moderator=user_data.is_moderator,
        enabled=user_data.enabled
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.put("/admin/users/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update only provided fields
    update_data = user_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(db_user)
    db.commit()
    
    return {"message": "User deleted successfully"}

# Regular user endpoints
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update only provided fields
    update_data = user_update.dict(exclude_unset=True)
    
    # Handle password update separately
    if 'password' in update_data:
        password = update_data.pop('password')
        current_user.password_hash = get_password_hash(password)
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.post("/me/change-password")
async def change_password(
    password_change: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not verify_password(password_change.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.password_hash = get_password_hash(password_change.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

@router.get("/{username}/public", response_model=UserPublicProfileResponse)
async def get_user_public_profile(
    username: str,
    db: Session = Depends(get_db)
):
    """Get public profile information for a user by username"""
    # Find user by username
    user = db.query(User).filter(
        User.username == username,
        User.enabled == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Calculate user statistics
    dive_sites_rated = db.query(func.count(SiteRating.id)).filter(
        SiteRating.user_id == user.id
    ).scalar()
    
    site_comments_count = db.query(func.count(SiteComment.id)).filter(
        SiteComment.user_id == user.id
    ).scalar()
    
    center_comments_count = db.query(func.count(CenterComment.id)).filter(
        CenterComment.user_id == user.id
    ).scalar()
    
    comments_posted = (site_comments_count or 0) + (center_comments_count or 0)
    
    # Create stats object
    stats = UserStats(
        dive_sites_rated=dive_sites_rated or 0,
        comments_posted=comments_posted or 0
    )
    
    # Create response object
    response = UserPublicProfileResponse(
        username=user.username,
        avatar_url=user.avatar_url,
        number_of_dives=user.number_of_dives,
        member_since=user.created_at,
        certifications=user.certifications,
        stats=stats
    )
    
    return response 