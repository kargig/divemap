"""
Media and tag operations for dives.

This module contains operations for dive media and tags:
- add_dive_media
- upload_dive_photo (file upload)
- get_dive_media
- delete_dive_media
- add_dive_tag
- remove_dive_tag
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import logging
import requests
import re
from urllib.parse import quote
from pathlib import Path

from .dives_shared import router, get_db, get_current_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DeleteR2PhotoRequest, DiveMediaCreate, DiveMediaResponse, DiveMediaUpdate, DiveTagResponse, DiveTagCreate

logger = logging.getLogger(__name__)


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
        thumbnail_url=media.thumbnail_url,
        is_public=media.is_public
    )

    db.add(db_media)
    db.commit()
    db.refresh(db_media)

    return db_media


@router.post("/{dive_id}/media/upload-photo", response_model=DiveMediaResponse)
async def upload_dive_photo(
    dive_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a photo file to a dive. File is stored in R2 or local storage."""
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

    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )

    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit"
        )

    # Generate unique filename
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{file_ext}"

    # Upload to R2 or local storage
    try:
        photo_path = r2_storage.upload_photo(
            user_id=current_user.id,
            dive_id=dive_id,
            filename=unique_filename,
            content=file_content
        )
        
        # For R2 photos, store the path and generate presigned URL on-demand
        # For local storage, get the static URL
        if photo_path.startswith('user_'):
            # R2 path - store as-is, will generate presigned URL when serving
            photo_url = photo_path
        else:
            # Local storage - get static URL
            photo_url = r2_storage.get_photo_url(photo_path)
        
        # Create media record
        db_media = DiveMedia(
            dive_id=dive_id,
            media_type='photo',
            url=photo_url,
            description=description or '',
            title='',
            thumbnail_url=None,
            is_public=is_public
        )

        db.add(db_media)
        db.commit()
        db.refresh(db_media)

        # Generate presigned URL for response if it's an R2 photo
        if db_media.url.startswith('user_'):
            presigned_url = r2_storage.get_photo_url(db_media.url)
            # Return response with presigned URL
            return DiveMediaResponse(
                id=db_media.id,
                dive_id=db_media.dive_id,
                media_type=db_media.media_type.value if hasattr(db_media.media_type, 'value') else str(db_media.media_type),
                url=presigned_url,
                description=db_media.description,
                title=db_media.title,
                thumbnail_url=db_media.thumbnail_url,
                is_public=db_media.is_public,
                created_at=db_media.created_at
            )
        
        return db_media
    except Exception as e:
        logger.error(f"Failed to upload photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload photo"
        )

@router.post("/{dive_id}/media/upload-photo-r2-only")
async def upload_photo_r2_only(
    dive_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a photo file to R2 only (no database record created). Returns R2 path and presigned URL."""
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

    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )

    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit"
        )

    # Generate unique filename
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{file_ext}"

    # Upload to R2 or local storage only (no database record)
    try:
        photo_path = r2_storage.upload_photo(
            user_id=current_user.id,
            dive_id=dive_id,
            filename=unique_filename,
            content=file_content
        )
        
        # Generate presigned URL for preview
        if photo_path.startswith('user_'):
            # R2 path - generate presigned URL
            presigned_url = r2_storage.get_photo_url(photo_path)
        else:
            # Local storage - get static URL
            presigned_url = photo_path
        
        return {
            "r2_path": photo_path,
            "url": presigned_url
        }
    except Exception as e:
        logger.error(f"Failed to upload photo to R2: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload photo to R2"
        )


@router.delete("/{dive_id}/media/delete-r2-photo")
async def delete_r2_photo(
    dive_id: int,
    request: DeleteR2PhotoRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a photo from R2 only (no database record deletion)."""
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

    # Validate that the R2 path belongs to this user's dive
    # R2 path format: user_{user_id}/photos/dive_{dive_id}/{filename}
    expected_path_prefix = f"user_{current_user.id}/photos/dive_{dive_id}/"
    if not request.r2_path.startswith(expected_path_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Photo does not belong to this dive"
        )

    # Delete from R2 or local storage
    try:
        success = r2_storage.delete_photo(request.r2_path)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete photo from storage"
            )
        return {"message": "Photo deleted from R2 successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete photo from R2 {request.r2_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete photo from R2"
        )


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

    # Get all media for the dive
    media_query = db.query(DiveMedia).filter(DiveMedia.dive_id == dive_id)
    
    # Filter media based on ownership and public/private status
    if current_user and dive.user_id == current_user.id:
        # Owner can see all their media (public and private)
        media = media_query.all()
    else:
        # Non-owners can only see public media
        media = media_query.filter(DiveMedia.is_public.is_(True)).all()
    
    # Generate presigned URLs for R2 photos on-demand
    from app.services.r2_storage_service import get_r2_storage
    r2_storage = get_r2_storage()
    
    result = []
    for item in media:
        # If URL is an R2 path (starts with 'user_'), generate presigned URL
        if item.url.startswith('user_'):
            presigned_url = r2_storage.get_photo_url(item.url)
            # Create a copy with updated URL
            media_dict = {
                "id": item.id,
                "dive_id": item.dive_id,
                "media_type": item.media_type.value if hasattr(item.media_type, 'value') else str(item.media_type),
                "url": presigned_url,
                "description": item.description,
                "title": item.title,
                "thumbnail_url": item.thumbnail_url,
                "is_public": item.is_public,
                "created_at": item.created_at
            }
            result.append(DiveMediaResponse(**media_dict))
        else:
            # Local storage or external URL - use as-is
            result.append(item)
    
    return result


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

    # Delete from R2 or local storage if it's a photo stored in R2
    # Check if URL is an R2 path (starts with 'user_') or if it's a local upload
    photo_path = None
    if media.media_type.value == 'photo':
        # If URL is an R2 path, use it directly
        if media.url.startswith('user_'):
            photo_path = media.url
        # If URL is a local path (starts with /uploads/), extract the path
        elif media.url.startswith('/uploads/'):
            photo_path = media.url[1:]  # Remove leading /
        elif media.url.startswith('uploads/'):
            photo_path = media.url
    
    # Delete from storage if it's a stored photo
    if photo_path:
        try:
            r2_storage.delete_photo(photo_path)
        except Exception as e:
            logger.warning(f"Failed to delete photo from storage {photo_path}: {e}")
            # Continue with database deletion even if storage deletion fails

    db.delete(media)
    db.commit()

    return {"message": "Media deleted successfully"}


@router.patch("/{dive_id}/media/{media_id}", response_model=DiveMediaResponse)
def update_dive_media(
    dive_id: int,
    media_id: int,
    media_update: DiveMediaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update media description and/or visibility"""
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

    # Update fields if provided
    update_data = media_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(media, field, value)

    db.commit()
    db.refresh(media)

    return media


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


@router.get("/media/flickr-oembed")
async def get_flickr_oembed(
    url: str = Query(..., description="Flickr URL (short or full) to convert"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Proxy endpoint for Flickr oEmbed API to convert Flickr URLs to direct image URLs.
    This endpoint bypasses CORS restrictions by making the request server-side.
    """
    # Validate that it's a Flickr URL
    if not url or ('flic.kr/p/' not in url and 'flickr.com/photos/' not in url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Flickr URL"
        )

    try:
        # Call Flickr's oEmbed API
        oembed_url = f"https://www.flickr.com/services/oembed/?url={quote(url)}&format=json"
        
        response = requests.get(oembed_url, timeout=10, headers={
            "User-Agent": "Divemap/1.0 (https://github.com/kargig/divemap)"
        })
        
        response.raise_for_status()
        data = response.json()
        
        # Extract the direct image URL from the HTML embed code
        direct_image_url = None
        if data.get("html"):
            img_match = re.search(r'<img[^>]+src="([^"]+)"', data["html"], re.IGNORECASE)
            if img_match and img_match.group(1):
                direct_image_url = img_match.group(1)
        
        # Return the oEmbed data with extracted direct image URL
        return {
            "url": url,
            "direct_image_url": direct_image_url,
            "oembed_data": data
        }
        
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to fetch Flickr oEmbed data for {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Flickr oEmbed data"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching Flickr oEmbed data for {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
