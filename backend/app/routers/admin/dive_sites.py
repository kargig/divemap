from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.models import DiveSite, User
from app.auth import get_current_active_user
from app.schemas import DiveSiteResponse

router = APIRouter(
    prefix="/dive-sites",
    tags=["admin_dive_sites"]
)

@router.get("/pending", response_model=List[DiveSiteResponse])
async def get_pending_dive_sites(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to get all pending dive sites."""
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Using string 'pending' to avoid conflict with starlette.status module
    sites = db.query(DiveSite).options(
        joinedload(DiveSite.difficulty),
        joinedload(DiveSite.aliases)
    ).filter(DiveSite.status == 'pending', DiveSite.deleted_at.is_(None)).all()
    
    # Pre-populate fields that Pydantic expects but aren't direct model attributes
    for site in sites:
        site.difficulty_code = site.difficulty.code if site.difficulty else None
        site.difficulty_label = site.difficulty.label if site.difficulty else None
        site.average_rating = 0.0
        site.total_ratings = 0
        site.comment_count = 0
        site.route_count = 0
        site.tags = []
        # The schema expects a list of DiveSiteAliasResponse objects, not just strings
        # But we can just pass the ORM objects from the relationship
        
    return sites

from app.models import DiveSiteEditRequest, EditRequestStatus, EditRequestType, SiteMedia
from datetime import datetime, timezone

@router.get("/edit-requests")
async def get_pending_edit_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    return db.query(DiveSiteEditRequest)\
        .options(
            joinedload(DiveSiteEditRequest.requested_by),
            joinedload(DiveSiteEditRequest.dive_site)
        )\
        .filter(DiveSiteEditRequest.status == EditRequestStatus.pending)\
        .all()

@router.post("/edit-requests/{request_id}/approve")
async def approve_edit_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    edit_req = db.query(DiveSiteEditRequest).filter(DiveSiteEditRequest.id == request_id).first()
    if not edit_req or edit_req.status != EditRequestStatus.pending:
        raise HTTPException(status_code=404, detail="Pending request not found")
        
    if edit_req.edit_type == EditRequestType.site_data:
        dive_site = db.query(DiveSite).filter(DiveSite.id == edit_req.dive_site_id).first()
        if not dive_site:
            raise HTTPException(status_code=404, detail="Dive site not found")
        for key, value in edit_req.proposed_data.items():
            setattr(dive_site, key, value)
            
    elif edit_req.edit_type == EditRequestType.media_addition:
        media = SiteMedia(dive_site_id=edit_req.dive_site_id, **edit_req.proposed_data)
        db.add(media)

    elif edit_req.edit_type == EditRequestType.media_update:
        media_id = edit_req.proposed_data.pop("id", None)
        if media_id:
            media = db.query(SiteMedia).filter(SiteMedia.id == media_id).first()
            if media:
                for key, value in edit_req.proposed_data.items():
                    setattr(media, key, value)

    elif edit_req.edit_type == EditRequestType.media_deletion:
        media_id = edit_req.proposed_data.get("id")
        if media_id:
            db.query(SiteMedia).filter(SiteMedia.id == media_id).delete()

    edit_req.status = EditRequestStatus.approved
    edit_req.reviewed_at = datetime.now(timezone.utc)
    edit_req.reviewed_by_id = current_user.id
    db.commit()
    return {"message": "Approved"}

@router.post("/edit-requests/{request_id}/reject")
async def reject_edit_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    edit_req = db.query(DiveSiteEditRequest).filter(DiveSiteEditRequest.id == request_id).first()
    if not edit_req or edit_req.status != EditRequestStatus.pending:
        raise HTTPException(status_code=404, detail="Pending request not found")
        
    edit_req.status = EditRequestStatus.rejected
    edit_req.reviewed_at = datetime.now(timezone.utc)
    edit_req.reviewed_by_id = current_user.id
    db.commit()
    return {"message": "Rejected"}
