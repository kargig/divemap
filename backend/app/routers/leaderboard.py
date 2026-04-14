from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone
from fastapi_cache.decorator import cache

from app.database import get_db
from app.models import (
    User, Dive, DiveSite, DivingCenter, DiveSiteEditRequest,
    SiteRating, CenterRating, SiteComment, CenterComment,
    ParsedDiveTrip
)
from app.schemas import LeaderboardUserResponse, LeaderboardCenterResponse, LeaderboardUserEntry, LeaderboardCenterEntry

router = APIRouter()

# Point weights for gamification
POINTS = {
    "DIVE_SITE_CREATED": 20,
    "DIVE_LOGGED": 10,
    "DIVING_CENTER_CREATED": 15,
    "DIVE_SITE_EDITED": 5,
    "REVIEW_POSTED": 5,
    "COMMENT_POSTED": 2,
}

@router.get("/users/overall", response_model=LeaderboardUserResponse)
@cache(expire=600)  # 10 minutes cache
async def get_overall_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get the overall user leaderboard based on unified points system using efficient SQL aggregation."""
    
    # Define count subqueries for each activity
    dives_sub = db.query(Dive.user_id, func.count(Dive.id).label("cnt")).group_by(Dive.user_id).subquery()
    sites_sub = db.query(DiveSite.created_by.label("user_id"), func.count(DiveSite.id).label("cnt")).group_by(DiveSite.created_by).subquery()
    centers_sub = db.query(DivingCenter.owner_id.label("user_id"), func.count(DivingCenter.id).label("cnt")).group_by(DivingCenter.owner_id).subquery()
    edits_sub = db.query(DiveSiteEditRequest.requested_by_id.label("user_id"), func.count(DiveSiteEditRequest.id).label("cnt")).group_by(DiveSiteEditRequest.requested_by_id).subquery()
    
    s_ratings_sub = db.query(SiteRating.user_id, func.count(SiteRating.id).label("cnt")).group_by(SiteRating.user_id).subquery()
    c_ratings_sub = db.query(CenterRating.user_id, func.count(CenterRating.id).label("cnt")).group_by(CenterRating.user_id).subquery()
    
    s_comments_sub = db.query(SiteComment.user_id, func.count(SiteComment.id).label("cnt")).group_by(SiteComment.user_id).subquery()
    c_comments_sub = db.query(CenterComment.user_id, func.count(CenterComment.id).label("cnt")).group_by(CenterComment.user_id).subquery()

    # Calculate total points in SQL
    total_points_expr = (
        func.coalesce(dives_sub.c.cnt, 0) * POINTS["DIVE_LOGGED"] +
        func.coalesce(sites_sub.c.cnt, 0) * POINTS["DIVE_SITE_CREATED"] +
        func.coalesce(centers_sub.c.cnt, 0) * POINTS["DIVING_CENTER_CREATED"] +
        func.coalesce(edits_sub.c.cnt, 0) * POINTS["DIVE_SITE_EDITED"] +
        (func.coalesce(s_ratings_sub.c.cnt, 0) + func.coalesce(c_ratings_sub.c.cnt, 0)) * POINTS["REVIEW_POSTED"] +
        (func.coalesce(s_comments_sub.c.cnt, 0) + func.coalesce(c_comments_sub.c.cnt, 0)) * POINTS["COMMENT_POSTED"]
    ).label("total_points")

    query = db.query(
        User.id,
        User.username,
        User.avatar_url,
        total_points_expr
    ).outerjoin(dives_sub, User.id == dives_sub.c.user_id)\
     .outerjoin(sites_sub, User.id == sites_sub.c.user_id)\
     .outerjoin(centers_sub, User.id == centers_sub.c.user_id)\
     .outerjoin(edits_sub, User.id == edits_sub.c.user_id)\
     .outerjoin(s_ratings_sub, User.id == s_ratings_sub.c.user_id)\
     .outerjoin(c_ratings_sub, User.id == c_ratings_sub.c.user_id)\
     .outerjoin(s_comments_sub, User.id == s_comments_sub.c.user_id)\
     .outerjoin(c_comments_sub, User.id == c_comments_sub.c.user_id)\
     .filter(total_points_expr > 0)\
     .order_by(desc("total_points"))\
     .limit(limit)

    results = query.all()
    
    entries = [
        LeaderboardUserEntry(
            user_id=row.id,
            username=row.username,
            avatar_url=row.avatar_url,
            count=row.total_points,
            points=row.total_points,
            rank=i + 1
        ) for i, row in enumerate(results)
    ]
            
    return LeaderboardUserResponse(
        metric="overall",
        entries=entries,
        updated_at=datetime.now(timezone.utc)
    )

@router.get("/users/category/{metric}", response_model=LeaderboardUserResponse)
@cache(expire=600)
async def get_category_leaderboard(
    metric: str,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get user leaderboard for a specific category using efficient SQL aggregation."""
    
    if metric == "reviews":
        s_sub = db.query(SiteRating.user_id, func.count(SiteRating.id).label("cnt")).group_by(SiteRating.user_id).subquery()
        c_sub = db.query(CenterRating.user_id, func.count(CenterRating.id).label("cnt")).group_by(CenterRating.user_id).subquery()
        total_count = (func.coalesce(s_sub.c.cnt, 0) + func.coalesce(c_sub.c.cnt, 0)).label("total_count")
        
        results = db.query(User.id, User.username, User.avatar_url, total_count)\
            .outerjoin(s_sub, User.id == s_sub.c.user_id)\
            .outerjoin(c_sub, User.id == c_sub.c.user_id)\
            .filter(total_count > 0)\
            .order_by(desc("total_count"))\
            .limit(limit).all()
            
        return LeaderboardUserResponse(
            metric=metric,
            entries=[LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, count=r.total_count, rank=i+1) for i, r in enumerate(results)],
            updated_at=datetime.now(timezone.utc)
        )
    elif metric == "comments":
        s_sub = db.query(SiteComment.user_id, func.count(SiteComment.id).label("cnt")).group_by(SiteComment.user_id).subquery()
        c_sub = db.query(CenterComment.user_id, func.count(CenterComment.id).label("cnt")).group_by(CenterComment.user_id).subquery()
        total_count = (func.coalesce(s_sub.c.cnt, 0) + func.coalesce(c_sub.c.cnt, 0)).label("total_count")
        
        results = db.query(User.id, User.username, User.avatar_url, total_count)\
            .outerjoin(s_sub, User.id == s_sub.c.user_id)\
            .outerjoin(c_sub, User.id == c_sub.c.user_id)\
            .filter(total_count > 0)\
            .order_by(desc("total_count"))\
            .limit(limit).all()
            
        return LeaderboardUserResponse(
            metric=metric,
            entries=[LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, count=r.total_count, rank=i+1) for i, r in enumerate(results)],
            updated_at=datetime.now(timezone.utc)
        )
    
    # Standard metrics
    if metric == "dives":
        subq = db.query(Dive.user_id, func.count(Dive.id).label("cnt")).group_by(Dive.user_id).subquery()
    elif metric == "sites":
        subq = db.query(DiveSite.created_by.label("user_id"), func.count(DiveSite.id).label("cnt")).group_by(DiveSite.created_by).subquery()
    elif metric == "edits":
        subq = db.query(DiveSiteEditRequest.requested_by_id.label("user_id"), func.count(DiveSiteEditRequest.id).label("cnt")).group_by(DiveSiteEditRequest.requested_by_id).subquery()
    else:
        return LeaderboardUserResponse(metric=metric, entries=[], updated_at=datetime.now(timezone.utc))

    results = db.query(User.id, User.username, User.avatar_url, subq.c.cnt)\
        .join(subq, User.id == subq.c.user_id)\
        .order_by(desc("cnt"))\
        .limit(limit).all()

    return LeaderboardUserResponse(
        metric=metric,
        entries=[LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, count=r.cnt, rank=i+1) for i, r in enumerate(results)],
        updated_at=datetime.now(timezone.utc)
    )

@router.get("/centers", response_model=LeaderboardCenterResponse)
@cache(expire=600)
async def get_center_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get diving center leaderboard based on organized trips using efficient SQL aggregation."""
    
    subq = db.query(ParsedDiveTrip.diving_center_id, func.count(ParsedDiveTrip.id).label("cnt")).group_by(ParsedDiveTrip.diving_center_id).subquery()
    
    results = db.query(DivingCenter.id, DivingCenter.name, DivingCenter.logo_url, subq.c.cnt)\
        .join(subq, DivingCenter.id == subq.c.diving_center_id)\
        .order_by(desc("cnt"))\
        .limit(limit).all()
    
    return LeaderboardCenterResponse(
        metric="trips",
        entries=[LeaderboardCenterEntry(
            center_id=r.id,
            name=r.name,
            logo_url=r.logo_url,
            count=r.cnt,
            rank=i+1
        ) for i, r in enumerate(results)],
        updated_at=datetime.now(timezone.utc)
    )
