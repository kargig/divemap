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
