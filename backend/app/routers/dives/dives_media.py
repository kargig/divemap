"""
Media and tag operations for dives.

This module contains operations for dive media and tags:
- add_dive_media
- get_dive_media
- delete_dive_media
- add_dive_tag
- remove_dive_tag
"""

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from .dives_shared import router, get_db, get_current_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveMediaCreate, DiveMediaResponse, DiveTagResponse, DiveTagCreate


@router.post("/{dive_id}/media", response_model=DiveMediaResponse)
def add_dive_media(
    dive_id: int,
    media: DiveMediaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add media to a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    db_media = DiveMedia(
        dive_id=dive_id,
        media_type=media.media_type,
        url=media.url,
        description=media.description,
        title=media.title,
        thumbnail_url=media.thumbnail_url
    )

    db.add(db_media)
    db.commit()
    db.refresh(db_media)

    return db_media


@router.get("/{dive_id}/media", response_model=List[DiveMediaResponse])
def get_dive_media(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all media for a dive. Unauthenticated users can view media for public dives."""
    # Check if user is authenticated and enabled
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and check access permissions
    dive = db.query(Dive).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Check access permissions
    if current_user:
        # Authenticated user - can see own dives and public dives from others
        if dive.user_id != current_user.id and dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    else:
        # Unauthenticated user - can only see public dives
        if dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )

    media = db.query(DiveMedia).filter(DiveMedia.dive_id == dive_id).all()
    return media


@router.delete("/{dive_id}/media/{media_id}")
def delete_dive_media(
    dive_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete media from a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Verify media exists and belongs to the dive
    media = db.query(DiveMedia).filter(
        DiveMedia.id == media_id,
        DiveMedia.dive_id == dive_id
    ).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )

    db.delete(media)
    db.commit()

    return {"message": "Media deleted successfully"}


# Dive Tags endpoints
@router.post("/{dive_id}/tags", response_model=DiveTagResponse)
def add_dive_tag(
    dive_id: int,
    tag: DiveTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a tag to a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Verify tag exists
    available_tag = db.query(AvailableTag).filter(AvailableTag.id == tag.tag_id).first()
    if not available_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    # Check if tag is already added to this dive
    existing_tag = db.query(DiveTag).filter(
        DiveTag.dive_id == dive_id,
        DiveTag.tag_id == tag.tag_id
    ).first()

    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already added to this dive"
        )

    db_tag = DiveTag(
        dive_id=dive_id,
        tag_id=tag.tag_id
    )

    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)

    return db_tag


@router.delete("/{dive_id}/tags/{tag_id}")
def remove_dive_tag(
    dive_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a tag from a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Find and delete the tag association
    dive_tag = db.query(DiveTag).filter(
        DiveTag.dive_id == dive_id,
        DiveTag.tag_id == tag_id
    ).first()

    if not dive_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found on this dive"
        )

    db.delete(dive_tag)
    db.commit()

    return {"message": "Tag removed from dive successfully"}
