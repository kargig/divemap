from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List

from app.database import get_db
from app.models import DiveSite, User
from app.auth import get_current_active_user
from app.schemas import DiveSiteResponse
from app.limiter import skip_rate_limit_for_admin

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
    
    requests = db.query(DiveSiteEditRequest)\
        .options(
            joinedload(DiveSiteEditRequest.requested_by),
            joinedload(DiveSiteEditRequest.dive_site).selectinload(DiveSite.media)
        )\
        .filter(DiveSiteEditRequest.status == EditRequestStatus.pending)\
        .all()
        
    result = []
    for req in requests:
        # Build safe dictionary without geometry fields
        # Safely convert dive_site to dict, excluding 'location'
        site_dict = None
        if req.dive_site:
            site_dict = {
                c.name: getattr(req.dive_site, c.name) 
                for c in req.dive_site.__table__.columns 
                if c.name != 'location'
            }
            # Add media for diffing if needed
            site_dict['media'] = [
                {
                    "id": m.id,
                    "media_type": m.media_type.value if hasattr(m.media_type, 'value') else str(m.media_type),
                    "url": m.url,
                    "description": m.description
                } for m in req.dive_site.media
            ]
            
        result.append({
            "id": req.id,
            "dive_site_id": req.dive_site_id,
            "dive_site": site_dict,
            "requested_by_id": req.requested_by_id,
            "requested_by": {
                "id": req.requested_by.id,
                "username": req.requested_by.username
            } if req.requested_by else None,
            "status": req.status,
            "edit_type": req.edit_type,
            "proposed_data": req.proposed_data,
            "created_at": req.created_at
        })
    return result

@router.post("/edit-requests/{request_id}/approve")
@skip_rate_limit_for_admin("30/minute")
async def approve_edit_request(request: Request, request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")

    edit_req = db.query(DiveSiteEditRequest).filter(DiveSiteEditRequest.id == request_id).first()
    if not edit_req or edit_req.status != EditRequestStatus.pending:
        raise HTTPException(status_code=404, detail="Pending request not found")

    if edit_req.edit_type == EditRequestType.site_data:
        dive_site = db.query(DiveSite).filter(DiveSite.id == edit_req.dive_site_id).first()
        if not dive_site:
            raise HTTPException(status_code=404, detail="Dive site not found")
            
        proposed = edit_req.proposed_data.copy()
        
        # Translate difficulty_code back to difficulty_id if present
        if 'difficulty_code' in proposed:
            from app.models import get_difficulty_id_by_code
            difficulty_code = proposed.pop('difficulty_code')
            if difficulty_code is not None:
                proposed['difficulty_id'] = get_difficulty_id_by_code(db, difficulty_code)
            else:
                proposed['difficulty_id'] = None

        for key, value in proposed.items():
            setattr(dive_site, key, value)
            
    elif edit_req.edit_type == EditRequestType.media_addition:
        media = SiteMedia(
            dive_site_id=edit_req.dive_site_id, 
            user_id=edit_req.requested_by_id,
            **edit_req.proposed_data
        )
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

    elif edit_req.edit_type == EditRequestType.tag_addition:
        from app.models import DiveSiteTag
        tag_id = edit_req.proposed_data.get("tag_id")
        if tag_id:
            # Check if already exists to avoid duplicates
            existing = db.query(DiveSiteTag).filter(
                DiveSiteTag.dive_site_id == edit_req.dive_site_id,
                DiveSiteTag.tag_id == tag_id
            ).first()
            if not existing:
                tag_assignment = DiveSiteTag(
                    dive_site_id=edit_req.dive_site_id,
                    tag_id=tag_id
                )
                db.add(tag_assignment)

    elif edit_req.edit_type == EditRequestType.tag_removal:
        from app.models import DiveSiteTag
        tag_id = edit_req.proposed_data.get("tag_id")
        if tag_id:
            db.query(DiveSiteTag).filter(
                DiveSiteTag.dive_site_id == edit_req.dive_site_id,
                DiveSiteTag.tag_id == tag_id
            ).delete()

    elif edit_req.edit_type == EditRequestType.center_association:
        from app.models import CenterDiveSite
        # proposed_data was serialized from CenterDiveSiteCreate
        dc_id = edit_req.proposed_data.get("diving_center_id")
        if dc_id:
            # Check if already exists to avoid duplicates
            existing = db.query(CenterDiveSite).filter(
                CenterDiveSite.dive_site_id == edit_req.dive_site_id,
                CenterDiveSite.diving_center_id == dc_id
            ).first()
            if not existing:
                association = CenterDiveSite(
                    dive_site_id=edit_req.dive_site_id,
                    diving_center_id=dc_id,
                    dive_cost=edit_req.proposed_data.get("dive_cost"),
                    currency=edit_req.proposed_data.get("currency", "EUR")
                )
                db.add(association)

    elif edit_req.edit_type == EditRequestType.center_removal:
        from app.models import CenterDiveSite
        dc_id = edit_req.proposed_data.get("diving_center_id")
        if dc_id:
            db.query(CenterDiveSite).filter(
                CenterDiveSite.dive_site_id == edit_req.dive_site_id,
                CenterDiveSite.diving_center_id == dc_id
            ).delete()

    edit_req.status = EditRequestStatus.approved
    from datetime import datetime, timezone
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
