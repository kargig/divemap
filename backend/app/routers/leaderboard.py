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
    ParsedDiveTrip, DiveMedia, SiteMedia
)
from app.schemas import LeaderboardUserResponse, LeaderboardCenterResponse, LeaderboardUserEntry, LeaderboardCenterEntry, AvatarType
from app.utils import populate_avatar_full_url

router = APIRouter()

# Point weights for gamification
POINTS = {
    "DIVE_SITE_CREATED": 20,
    "DIVE_LOGGED": 10,
    "DIVING_CENTER_CREATED": 15,
    "DIVE_SITE_EDITED": 15,
    "REVIEW_POSTED": 2,
    "COMMENT_POSTED": 5,
    "DIVE_MEDIA_ADDED": 5,
    "SITE_MEDIA_ADDED": 10,
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
    edits_sub = db.query(DiveSiteEditRequest.requested_by_id.label("user_id"), func.count(DiveSiteEditRequest.id).label("cnt")).filter(DiveSiteEditRequest.status == 'approved').group_by(DiveSiteEditRequest.requested_by_id).subquery()
    d_media_sub = db.query(Dive.user_id, func.count(DiveMedia.id).label("cnt")).join(DiveMedia, Dive.id == DiveMedia.dive_id).group_by(Dive.user_id).subquery()
    s_media_sub = db.query(SiteMedia.user_id, func.count(SiteMedia.id).label("cnt")).group_by(SiteMedia.user_id).subquery()
    
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
        func.coalesce(d_media_sub.c.cnt, 0) * POINTS["DIVE_MEDIA_ADDED"] +
        func.coalesce(s_media_sub.c.cnt, 0) * POINTS["SITE_MEDIA_ADDED"] +
        (func.coalesce(s_ratings_sub.c.cnt, 0) + func.coalesce(c_ratings_sub.c.cnt, 0)) * POINTS["REVIEW_POSTED"] +
        (func.coalesce(s_comments_sub.c.cnt, 0) + func.coalesce(c_comments_sub.c.cnt, 0)) * POINTS["COMMENT_POSTED"]
    ).label("total_points")

    query = db.query(
        User.id,
        User.username,
        User.avatar_url,
        User.avatar_type,
        User.google_avatar_url,
        total_points_expr
    ).outerjoin(dives_sub, User.id == dives_sub.c.user_id)\
     .outerjoin(sites_sub, User.id == sites_sub.c.user_id)\
     .outerjoin(centers_sub, User.id == centers_sub.c.user_id)\
     .outerjoin(edits_sub, User.id == edits_sub.c.user_id)\
     .outerjoin(d_media_sub, User.id == d_media_sub.c.user_id)\
     .outerjoin(s_media_sub, User.id == s_media_sub.c.user_id)\
     .outerjoin(s_ratings_sub, User.id == s_ratings_sub.c.user_id)\
     .outerjoin(c_ratings_sub, User.id == c_ratings_sub.c.user_id)\
     .outerjoin(s_comments_sub, User.id == s_comments_sub.c.user_id)\
     .outerjoin(c_comments_sub, User.id == c_comments_sub.c.user_id)\
     .filter(total_points_expr > 0)\
     .order_by(desc("total_points"))\
     .limit(limit)

    results = query.all()
    
    entries = []
    for i, row in enumerate(results):
        entry = LeaderboardUserEntry(
            user_id=row.id,
            username=row.username,
            avatar_url=row.avatar_url,
            avatar_type=row.avatar_type or AvatarType.google,
            count=row.total_points,
            points=row.total_points,
            rank=i + 1
        )
        # Populate avatar_full_url using the helper
        # We pass a simple object with avatar_url and avatar_type
        from collections import namedtuple
        UserMock = namedtuple('UserMock', ['avatar_url', 'avatar_type', 'google_avatar_url'])
        mock_user = UserMock(avatar_url=row.avatar_url, avatar_type=row.avatar_type, google_avatar_url=row.google_avatar_url)
        entry_dict = entry.model_dump()
        populated = populate_avatar_full_url(mock_user, entry_dict)
        entries.append(LeaderboardUserEntry(**populated))
            
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
        
        results = db.query(User.id, User.username, User.avatar_url, User.avatar_type, User.google_avatar_url, total_count)\
            .outerjoin(s_sub, User.id == s_sub.c.user_id)\
            .outerjoin(c_sub, User.id == c_sub.c.user_id)\
            .filter(total_count > 0)\
            .order_by(desc("total_count"))\
            .limit(limit).all()
            
        entries = []
        for i, r in enumerate(results):
            entry = LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, avatar_type=r.avatar_type or AvatarType.google, count=r.total_count, rank=i+1)
            from collections import namedtuple
            UserMock = namedtuple('UserMock', ['avatar_url', 'avatar_type', 'google_avatar_url'])
            mock_user = UserMock(avatar_url=r.avatar_url, avatar_type=r.avatar_type, google_avatar_url=r.google_avatar_url)
            entries.append(LeaderboardUserEntry(**populate_avatar_full_url(mock_user, entry.model_dump())))

        return LeaderboardUserResponse(
            metric=metric,
            entries=entries,
            updated_at=datetime.now(timezone.utc)
        )
    elif metric == "comments":
        s_sub = db.query(SiteComment.user_id, func.count(SiteComment.id).label("cnt")).group_by(SiteComment.user_id).subquery()
        c_sub = db.query(CenterComment.user_id, func.count(CenterComment.id).label("cnt")).group_by(CenterComment.user_id).subquery()
        total_count = (func.coalesce(s_sub.c.cnt, 0) + func.coalesce(c_sub.c.cnt, 0)).label("total_count")
        
        results = db.query(User.id, User.username, User.avatar_url, User.avatar_type, User.google_avatar_url, total_count)\
            .outerjoin(s_sub, User.id == s_sub.c.user_id)\
            .outerjoin(c_sub, User.id == c_sub.c.user_id)\
            .filter(total_count > 0)\
            .order_by(desc("total_count"))\
            .limit(limit).all()
            
        entries = []
        for i, r in enumerate(results):
            entry = LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, avatar_type=r.avatar_type or AvatarType.google, count=r.total_count, rank=i+1)
            from collections import namedtuple
            UserMock = namedtuple('UserMock', ['avatar_url', 'avatar_type', 'google_avatar_url'])
            mock_user = UserMock(avatar_url=r.avatar_url, avatar_type=r.avatar_type, google_avatar_url=r.google_avatar_url)
            entries.append(LeaderboardUserEntry(**populate_avatar_full_url(mock_user, entry.model_dump())))

        return LeaderboardUserResponse(
            metric=metric,
            entries=entries,
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

    results = db.query(User.id, User.username, User.avatar_url, User.avatar_type, User.google_avatar_url, subq.c.cnt)\
        .join(subq, User.id == subq.c.user_id)\
        .order_by(desc("cnt"))\
        .limit(limit).all()

    entries = []
    for i, r in enumerate(results):
        entry = LeaderboardUserEntry(user_id=r.id, username=r.username, avatar_url=r.avatar_url, avatar_type=r.avatar_type or AvatarType.google, count=r.cnt, rank=i+1)
        from collections import namedtuple
        UserMock = namedtuple('UserMock', ['avatar_url', 'avatar_type', 'google_avatar_url'])
        mock_user = UserMock(avatar_url=r.avatar_url, avatar_type=r.avatar_type, google_avatar_url=r.google_avatar_url)
        entries.append(LeaderboardUserEntry(**populate_avatar_full_url(mock_user, entry.model_dump())))

    return LeaderboardUserResponse(
        metric=metric,
        entries=entries,
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


def get_user_leaderboard_data(db: Session, user_id: int):
    """Calculate total points and overall rank for a specific user using optimized aggregation."""
    
    # 1. Sum counts for this user (Fast indexed queries)
    dives = db.query(func.count(Dive.id)).filter(Dive.user_id == user_id).scalar() or 0
    sites = db.query(func.count(DiveSite.id)).filter(DiveSite.created_by == user_id).scalar() or 0
    centers = db.query(func.count(DivingCenter.id)).filter(DivingCenter.owner_id == user_id).scalar() or 0
    edits = db.query(func.count(DiveSiteEditRequest.id)).filter(DiveSiteEditRequest.requested_by_id == user_id, DiveSiteEditRequest.status == 'approved').scalar() or 0
    d_media = db.query(func.count(DiveMedia.id)).join(Dive, Dive.id == DiveMedia.dive_id).filter(Dive.user_id == user_id).scalar() or 0
    s_media = db.query(func.count(SiteMedia.id)).filter(SiteMedia.user_id == user_id).scalar() or 0
    s_ratings = db.query(func.count(SiteRating.id)).filter(SiteRating.user_id == user_id).scalar() or 0
    c_ratings = db.query(func.count(CenterRating.id)).filter(CenterRating.user_id == user_id).scalar() or 0
    s_comments = db.query(func.count(SiteComment.id)).filter(SiteComment.user_id == user_id).scalar() or 0
    c_comments = db.query(CenterComment.id).filter(CenterComment.user_id == user_id).count()

    points = (dives * POINTS["DIVE_LOGGED"] + 
              sites * POINTS["DIVE_SITE_CREATED"] + 
              centers * POINTS["DIVING_CENTER_CREATED"] + 
              edits * POINTS["DIVE_SITE_EDITED"] + 
              d_media * POINTS["DIVE_MEDIA_ADDED"] + 
              s_media * POINTS["SITE_MEDIA_ADDED"] + 
              (s_ratings + c_ratings) * POINTS["REVIEW_POSTED"] + 
              (s_comments + c_comments) * POINTS["COMMENT_POSTED"])
    
    if points == 0:
        return 0, None

    # 2. Rank calculation: Count users with more total points
    # Activity subqueries
    d_q = db.query(Dive.user_id, func.count(Dive.id).label("c")).group_by(Dive.user_id).subquery()
    s_q = db.query(DiveSite.created_by.label("user_id"), func.count(DiveSite.id).label("c")).group_by(DiveSite.created_by).subquery()
    dc_q = db.query(DivingCenter.owner_id.label("user_id"), func.count(DivingCenter.id).label("c")).group_by(DivingCenter.owner_id).subquery()
    e_q = db.query(DiveSiteEditRequest.requested_by_id.label("user_id"), func.count(DiveSiteEditRequest.id).label("c")).filter(DiveSiteEditRequest.status == 'approved').group_by(DiveSiteEditRequest.requested_by_id).subquery()
    dm_q = db.query(Dive.user_id, func.count(DiveMedia.id).label("c")).join(DiveMedia, Dive.id == DiveMedia.dive_id).group_by(Dive.user_id).subquery()
    sm_q = db.query(SiteMedia.user_id, func.count(SiteMedia.id).label("c")).group_by(SiteMedia.user_id).subquery()
    sr_q = db.query(SiteRating.user_id, func.count(SiteRating.id).label("c")).group_by(SiteRating.user_id).subquery()
    cr_q = db.query(CenterRating.user_id, func.count(CenterRating.id).label("c")).group_by(CenterRating.user_id).subquery()
    sc_q = db.query(SiteComment.user_id, func.count(SiteComment.id).label("c")).group_by(SiteComment.user_id).subquery()
    cc_q = db.query(CenterComment.user_id, func.count(CenterComment.id).label("c")).group_by(CenterComment.user_id).subquery()

    # Calculate rank by counting users whose calculated total points > current user's points
    # We join all subqueries against the User table
    total_pts_expr = (
        func.coalesce(d_q.c.c, 0) * POINTS["DIVE_LOGGED"] +
        func.coalesce(s_q.c.c, 0) * POINTS["DIVE_SITE_CREATED"] +
        func.coalesce(dc_q.c.c, 0) * POINTS["DIVING_CENTER_CREATED"] +
        func.coalesce(e_q.c.c, 0) * POINTS["DIVE_SITE_EDITED"] +
        func.coalesce(dm_q.c.c, 0) * POINTS["DIVE_MEDIA_ADDED"] +
        func.coalesce(sm_q.c.c, 0) * POINTS["SITE_MEDIA_ADDED"] +
        (func.coalesce(sr_q.c.c, 0) + func.coalesce(cr_q.c.c, 0)) * POINTS["REVIEW_POSTED"] +
        (func.coalesce(sc_q.c.c, 0) + func.coalesce(cc_q.c.c, 0)) * POINTS["COMMENT_POSTED"]
    )
    
    # We only need to check users who have SOME activity
    rank_count = db.query(User.id).outerjoin(d_q, User.id == d_q.c.user_id)\
        .outerjoin(s_q, User.id == s_q.c.user_id)\
        .outerjoin(dc_q, User.id == dc_q.c.user_id)\
        .outerjoin(e_q, User.id == e_q.c.user_id)\
        .outerjoin(dm_q, User.id == dm_q.c.user_id)\
        .outerjoin(sm_q, User.id == sm_q.c.user_id)\
        .outerjoin(sr_q, User.id == sr_q.c.user_id)\
        .outerjoin(cr_q, User.id == cr_q.c.user_id)\
        .outerjoin(sc_q, User.id == sc_q.c.user_id)\
        .outerjoin(cc_q, User.id == cc_q.c.user_id)\
        .filter(total_pts_expr > points).count()

    return points, rank_count + 1
