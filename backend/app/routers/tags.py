from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import AvailableTag, DiveSiteTag, User
from app.schemas import TagCreate, TagResponse, TagUpdate, DiveSiteTagCreate, DiveSiteTagResponse, TagWithCountResponse
from app.auth import get_current_user, is_admin_or_moderator

router = APIRouter(prefix="/api/v1/tags", tags=["Tags"])

@router.get("/", response_model=List[TagResponse])
def get_all_tags(db: Session = Depends(get_db)):
    """Get all available tags"""
    tags = db.query(AvailableTag).order_by(AvailableTag.name.asc()).all()
    return tags

@router.get("/with-counts", response_model=List[TagWithCountResponse])
def get_all_tags_with_counts(db: Session = Depends(get_db)):
    """Get all available tags with count of associated dive sites"""
    # Get all tags
    tags = db.query(AvailableTag).order_by(AvailableTag.name.asc()).all()
    
    result = []
    for tag in tags:
        # Count associated dive sites for this tag
        dive_site_count = db.query(DiveSiteTag).filter(DiveSiteTag.tag_id == tag.id).count()
        
        tag_dict = {
            "id": tag.id,
            "name": tag.name,
            "description": tag.description,
            "created_by": tag.created_by,
            "created_at": tag.created_at,
            "dive_site_count": dive_site_count
        }
        result.append(tag_dict)
    
    return result

@router.post("/", response_model=TagResponse)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_admin_or_moderator)
):
    """Create a new tag (admin/moderator only)"""
    # Check if tag already exists
    existing_tag = db.query(AvailableTag).filter(AvailableTag.name == tag.name).first()
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag with this name already exists"
        )
    
    db_tag = AvailableTag(
        name=tag.name,
        description=tag.description,
        created_by=current_user.id
    )
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    tag_update: TagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_admin_or_moderator)
):
    """Update a tag (admin/moderator only)"""
    db_tag = db.query(AvailableTag).filter(AvailableTag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    if tag_update.name is not None:
        # Check if new name conflicts with existing tag
        existing_tag = db.query(AvailableTag).filter(
            AvailableTag.name == tag_update.name,
            AvailableTag.id != tag_id
        ).first()
        if existing_tag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tag with this name already exists"
            )
        db_tag.name = tag_update.name
    
    if tag_update.description is not None:
        db_tag.description = tag_update.description
    
    db.commit()
    db.refresh(db_tag)
    return db_tag

@router.delete("/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_admin_or_moderator)
):
    """Delete a tag (admin/moderator only)"""
    db_tag = db.query(AvailableTag).filter(AvailableTag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    db.delete(db_tag)
    db.commit()
    return {"message": "Tag deleted successfully"}

@router.post("/dive-sites/{dive_site_id}/tags", response_model=DiveSiteTagResponse)
def add_tag_to_dive_site(
    dive_site_id: int,
    tag_assignment: DiveSiteTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_admin_or_moderator)
):
    """Add a tag to a dive site (admin/moderator only)"""
    # Verify dive site exists
    from app.models import DiveSite
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    # Verify tag exists
    tag = db.query(AvailableTag).filter(AvailableTag.id == tag_assignment.tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check if tag is already assigned to this dive site
    existing_assignment = db.query(DiveSiteTag).filter(
        DiveSiteTag.dive_site_id == dive_site_id,
        DiveSiteTag.tag_id == tag_assignment.tag_id
    ).first()
    
    if existing_assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag is already assigned to this dive site"
        )
    
    db_tag_assignment = DiveSiteTag(
        dive_site_id=dive_site_id,
        tag_id=tag_assignment.tag_id
    )
    db.add(db_tag_assignment)
    db.commit()
    db.refresh(db_tag_assignment)
    return db_tag_assignment

@router.delete("/dive-sites/{dive_site_id}/tags/{tag_id}")
def remove_tag_from_dive_site(
    dive_site_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(is_admin_or_moderator)
):
    """Remove a tag from a dive site (admin/moderator only)"""
    tag_assignment = db.query(DiveSiteTag).filter(
        DiveSiteTag.dive_site_id == dive_site_id,
        DiveSiteTag.tag_id == tag_id
    ).first()
    
    if not tag_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag assignment not found"
        )
    
    db.delete(tag_assignment)
    db.commit()
    return {"message": "Tag removed from dive site successfully"} 