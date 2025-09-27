"""
Dive profile management for dives.

This module contains operations for dive profiles:
- get_dive_profile
- upload_dive_profile
- delete_dive_profile
- delete_user_profiles
"""

from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from .dives_shared import router, get_db, get_current_user, User, Dive, r2_storage
from .dives_db_utils import get_dive_by_id
from .dives_errors import raise_dive_not_found, raise_validation_error, raise_internal_error
from .dives_logging import log_dive_operation, log_error


@router.get("/{dive_id}/profile")
def get_dive_profile(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dive profile data"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view profile for this dive"
            )
        
        # Check if dive has profile data
        if not dive.profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No profile data found for this dive"
            )
        
        # Return profile data
        return {
            "dive_id": dive_id,
            "profile_data": dive.profile_data,
            "profile_url": dive.profile_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("get_dive_profile", e, current_user.id, dive_id=dive_id)
        raise_internal_error("Failed to get dive profile")


@router.post("/{dive_id}/profile")
async def upload_dive_profile(
    dive_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload dive profile data"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload profile for this dive"
            )
        
        # Validate file type
        allowed_types = ["application/json", "text/plain", "application/xml"]
        if file.content_type not in allowed_types:
            raise_validation_error("Invalid file type. Allowed types: JSON, TXT, XML")
        
        # Validate file size (5MB max)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise_validation_error("File size too large. Maximum size is 5MB")
        
        # Generate unique filename
        import uuid
        import os
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".json"
        unique_filename = f"profile_{dive_id}_{uuid.uuid4()}{file_extension}"
        
        # Upload to R2 storage
        try:
            profile_url = r2_storage.upload_file(file_content, unique_filename)
        except Exception as e:
            log_error("r2_upload_profile", e, current_user.id, dive_id=dive_id)
            raise_internal_error("Failed to upload profile file")
        
        # Update dive with profile data
        dive.profile_data = file_content.decode('utf-8')
        dive.profile_url = profile_url
        
        db.commit()
        db.refresh(dive)
        
        log_dive_operation("upload_profile", dive_id, current_user.id)
        
        return {
            "message": "Dive profile uploaded successfully",
            "profile_url": profile_url,
            "dive_id": dive_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("upload_dive_profile", e, current_user.id, dive_id=dive_id)
        raise_internal_error("Failed to upload dive profile")


@router.delete("/{dive_id}/profile")
def delete_dive_profile(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete dive profile data"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete profile for this dive"
            )
        
        # Check if dive has profile data
        if not dive.profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No profile data found for this dive"
            )
        
        # Delete from R2 storage if URL exists
        if dive.profile_url:
            try:
                # Extract filename from URL
                import os
                filename = os.path.basename(dive.profile_url)
                r2_storage.delete_file(filename)
            except Exception as e:
                log_error("r2_delete_profile", e, current_user.id, dive_id=dive_id)
                # Continue with database deletion even if R2 deletion fails
        
        # Clear profile data from dive
        dive.profile_data = None
        dive.profile_url = None
        
        db.commit()
        
        log_dive_operation("delete_profile", dive_id, current_user.id)
        
        return {"message": "Dive profile deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("delete_dive_profile", e, current_user.id, dive_id=dive_id)
        raise_internal_error("Failed to delete dive profile")


@router.delete("/profiles/user/{user_id}")
def delete_user_profiles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all profiles for a user (admin only)"""
    try:
        # Check if user is admin or deleting their own profiles
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete profiles for this user"
            )
        
        # Get all dives with profiles for the user
        dives_with_profiles = db.query(Dive).filter(
            Dive.user_id == user_id,
            Dive.profile_data.isnot(None)
        ).all()
        
        deleted_count = 0
        for dive in dives_with_profiles:
            # Delete from R2 storage if URL exists
            if dive.profile_url:
                try:
                    import os
                    filename = os.path.basename(dive.profile_url)
                    r2_storage.delete_file(filename)
                except Exception as e:
                    log_error("r2_delete_user_profile", e, current_user.id, dive_id=dive.id)
                    # Continue with database deletion even if R2 deletion fails
            
            # Clear profile data from dive
            dive.profile_data = None
            dive.profile_url = None
            deleted_count += 1
        
        db.commit()
        
        log_dive_operation("delete_user_profiles", user_id, current_user.id, deleted_count=deleted_count)
        
        return {
            "message": f"Deleted {deleted_count} profiles for user {user_id}",
            "deleted_count": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("delete_user_profiles", e, current_user.id, target_user_id=user_id)
        raise_internal_error("Failed to delete user profiles")
