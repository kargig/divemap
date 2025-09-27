"""
Media and tag operations for dives.

This module contains operations for dive media and tags:
- add_dive_media
- get_dive_media
- delete_dive_media
- add_dive_tag
- remove_dive_tag
"""

from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
import os

from .dives_shared import router, get_db, get_current_user, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from .dives_db_utils import get_dive_by_id
from .dives_errors import raise_dive_not_found, raise_media_not_found, raise_tag_not_found, raise_validation_error
from .dives_logging import log_dive_operation, log_error
from ..schemas import DiveMediaResponse, DiveTagResponse


@router.post("/{dive_id}/media", response_model=DiveMediaResponse)
def add_dive_media(
    dive_id: int,
    file: UploadFile = File(...),
    caption: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add media to a dive"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to add media to this dive"
            )
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"]
        if file.content_type not in allowed_types:
            raise_validation_error("Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, MP4, WebM")
        
        # Validate file size (10MB max)
        file_size = 0
        file_content = await file.read()
        file_size = len(file_content)
        if file_size > 10 * 1024 * 1024:  # 10MB
            raise_validation_error("File size too large. Maximum size is 10MB")
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Upload to R2 storage
        try:
            upload_url = r2_storage.upload_file(file_content, unique_filename)
        except Exception as e:
            log_error("r2_upload", e, current_user.id, dive_id=dive_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file"
            )
        
        # Create media record
        media = DiveMedia(
            dive_id=dive_id,
            filename=unique_filename,
            original_filename=file.filename,
            file_url=upload_url,
            file_type=file.content_type,
            file_size=file_size,
            caption=caption
        )
        
        db.add(media)
        db.commit()
        db.refresh(media)
        
        log_dive_operation("add_media", dive_id, current_user.id, media_id=media.id)
        
        return media
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("add_dive_media", e, current_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add media"
        )


@router.get("/{dive_id}/media", response_model=List[DiveMediaResponse])
def get_dive_media(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all media for a dive"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view media for this dive"
            )
        
        # Get media
        media = db.query(DiveMedia).filter(DiveMedia.dive_id == dive_id).all()
        
        return media
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("get_dive_media", e, current_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get media"
        )


@router.delete("/{dive_id}/media/{media_id}")
def delete_dive_media(
    dive_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete media from a dive"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete media from this dive"
            )
        
        # Check if media exists and belongs to dive
        media = db.query(DiveMedia).filter(
            DiveMedia.id == media_id,
            DiveMedia.dive_id == dive_id
        ).first()
        
        if not media:
            raise_media_not_found(media_id)
        
        # Delete from R2 storage
        try:
            r2_storage.delete_file(media.filename)
        except Exception as e:
            log_error("r2_delete", e, current_user.id, dive_id=dive_id, media_id=media_id)
            # Continue with database deletion even if R2 deletion fails
        
        # Delete from database
        db.delete(media)
        db.commit()
        
        log_dive_operation("delete_media", dive_id, current_user.id, media_id=media_id)
        
        return {"message": "Media deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("delete_dive_media", e, current_user.id, dive_id=dive_id, media_id=media_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete media"
        )


@router.post("/{dive_id}/tags", response_model=DiveTagResponse)
def add_dive_tag(
    dive_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a tag to a dive"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to add tags to this dive"
            )
        
        # Check if tag exists
        tag = db.query(AvailableTag).filter(AvailableTag.id == tag_id).first()
        if not tag:
            raise_tag_not_found(tag_id)
        
        # Check if tag is already added
        existing_tag = db.query(DiveTag).filter(
            DiveTag.dive_id == dive_id,
            DiveTag.tag_id == tag_id
        ).first()
        
        if existing_tag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tag already added to this dive"
            )
        
        # Add tag
        dive_tag = DiveTag(
            dive_id=dive_id,
            tag_id=tag_id
        )
        
        db.add(dive_tag)
        db.commit()
        db.refresh(dive_tag)
        
        log_dive_operation("add_tag", dive_id, current_user.id, tag_id=tag_id)
        
        return dive_tag
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("add_dive_tag", e, current_user.id, dive_id=dive_id, tag_id=tag_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add tag"
        )


@router.delete("/{dive_id}/tags/{tag_id}")
def remove_dive_tag(
    dive_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a tag from a dive"""
    try:
        # Check if dive exists and user owns it
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to remove tags from this dive"
            )
        
        # Check if tag exists and belongs to dive
        dive_tag = db.query(DiveTag).filter(
            DiveTag.dive_id == dive_id,
            DiveTag.tag_id == tag_id
        ).first()
        
        if not dive_tag:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tag not found on this dive"
            )
        
        # Remove tag
        db.delete(dive_tag)
        db.commit()
        
        log_dive_operation("remove_tag", dive_id, current_user.id, tag_id=tag_id)
        
        return {"message": "Tag removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("remove_dive_tag", e, current_user.id, dive_id=dive_id, tag_id=tag_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove tag"
        )
