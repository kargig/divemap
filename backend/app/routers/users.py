from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import uuid

from app.database import get_db
from app.models import User, SiteRating, SiteComment, CenterComment, DiveSite, Dive, DivingCenter, DiveBuddy, ApiKey, UserSocialLink, PersonalAccessToken
from app.schemas import (
    UserResponse, UserUpdate, UserCreateAdmin, UserUpdateAdmin, UserListResponse, 
    PasswordChangeRequest, UserPublicProfileResponse, UserProfileStats, UserSearchResponse,
    ApiKeyResponse, ApiKeyCreate, ApiKeyCreateResponse, ApiKeyUpdate, CertificationStats,
    UserSocialLinkCreate, UserSocialLinkResponse,
    PATCreate, PATResponse, PATCreateResponse, DivingStatsResponse,
    AvatarUpdate, AvatarType
)
from app.auth import get_current_active_user, get_current_admin_user, get_password_hash, verify_password, is_admin_or_moderator
from app.services.r2_storage_service import r2_storage
from app.services.image_processing import image_processing
from app.limiter import skip_rate_limit_for_admin
from app.utils import utcnow, populate_avatar_full_url
from sqlalchemy import func, extract, desc
import secrets
import base64
import re

router = APIRouter()

def calculate_certification_stats(certifications) -> Optional[CertificationStats]:
    if not certifications:
        return None
    
    max_depth_val = 0.0
    max_depth_str = None
    all_gases = set()
    all_tanks = set()
    max_deco_minutes = -1
    max_deco_str = None
    is_unlimited_deco = False
    
    max_nitrox = 21 # Default to Air
    max_trimix = None # None means no trimix
    max_stages = 0

    # Keywords to look for (naive normalization)
    gas_keywords = ["Trimix", "Helitrox", "Helium", "Oxygen", "Nitrox", "Air"]
    tank_keywords = ["CCR", "Rebreather", "Double", "Twinset", "Sidemount", "Stage", "Pony", "Single"]

    for user_cert in certifications:
        cert_level = user_cert.certification_level_link
        if not cert_level:
            continue
        
        # Max Depth
        if cert_level.max_depth:
            # Extract all numbers preceding 'm'
            matches = re.findall(r'(\d+(?:\.\d+)?)m', cert_level.max_depth)
            if matches:
                # Take the largest value found in the string
                local_max = max(float(m) for m in matches)
                if local_max > max_depth_val:
                    max_depth_val = local_max
                    max_depth_str = cert_level.max_depth
            elif "Beyond" in cert_level.max_depth:
                 # Fallback for "Beyond Xm" if regex failed or to handle specific cases
                 # But the regex above (\d+)m should catch "65m" in "Beyond 65m"
                 pass

        # Gases
        if cert_level.gases:
            val = cert_level.gases
            # Check for keywords
            for kw in gas_keywords:
                if kw.lower() in val.lower():
                    # Normalize to capitalized keyword
                    all_gases.add(kw)
            
            # Nitrox / O2 Calculation
            if "Oxygen" in val or "O2" in val or "100%" in val:
                max_nitrox = 100
            elif "Nitrox" in val:
                # Look for percentage
                matches = re.findall(r'(\d+)%', val)
                if matches:
                    local_max = max(int(m) for m in matches)
                    if local_max > max_nitrox:
                        max_nitrox = local_max
                elif max_nitrox < 40: # Default assumption for "Nitrox" without % is usually EAN40 max for recreational
                     max_nitrox = 40
            
            # Trimix Calculation
            if "Trimix" in val or "Helitrox" in val or "Triox" in val:
                # Check for Hypoxic vs Normoxic
                if "Hypoxic" in val:
                    max_trimix = "Hypoxic"
                elif "Normoxic" in val or "Triox" in val or "Helitrox" in val:
                    if max_trimix != "Hypoxic": # Hypoxic is "higher" level
                        max_trimix = "Normoxic"
                else:
                     if max_trimix is None:
                         max_trimix = "Trimix"

        
        # Tanks & Stages
        if cert_level.tanks:
            val = cert_level.tanks
            for kw in tank_keywords:
                if kw.lower() in val.lower():
                    if kw == "Twinset": kw = "Double" # Normalize
                    if kw == "Rebreather": kw = "CCR" # Normalize
                    all_tanks.add(kw)
            
            # Count stages
            # Look for "X stages" or "X+ stages"
            stage_matches = re.findall(r'(\d+)\+?\s*stages?', val.lower())
            if stage_matches:
                local_stages = max(int(m) for m in stage_matches)
                if local_stages > max_stages:
                    max_stages = local_stages
            elif "stage" in val.lower(): # Single "stage" mentioned without number
                if max_stages < 1:
                    max_stages = 1

        # Deco Time
        val = cert_level.deco_time_limit
        if val:
            if "Unlimited" in val:
                is_unlimited_deco = True
                max_deco_str = val
            elif not is_unlimited_deco:
                # Extract minutes
                matches = re.findall(r'(\d+)\s*minutes?', val)
                if matches:
                    local_minutes = max(int(m) for m in matches)
                    if local_minutes > max_deco_minutes:
                        max_deco_minutes = local_minutes
                        max_deco_str = val
                elif "No decompression" in val and max_deco_minutes == -1:
                     if max_deco_str is None:
                         max_deco_str = val

    # Sort sets to lists
    # Custom sort for gases: Trimix > Helitrox > Oxygen > Nitrox > Air
    gas_order = {k: i for i, k in enumerate(["Trimix", "Helitrox", "Helium", "Oxygen", "Nitrox", "Air"])}
    sorted_gases = sorted(list(all_gases), key=lambda x: gas_order.get(x, 99))

    # Custom sort for tanks: CCR > Double > Sidemount > Stage > Pony > Single
    tank_order = {k: i for i, k in enumerate(["CCR", "Double", "Sidemount", "Stage", "Pony", "Single"])}
    sorted_tanks = sorted(list(all_tanks), key=lambda x: tank_order.get(x, 99))

    return CertificationStats(
        max_depth=max_depth_val if max_depth_val > 0 else None,
        max_depth_str=max_depth_str,
        best_gases=sorted_gases,
        largest_tanks=sorted_tanks,
        max_deco_time=max_deco_str,
        max_nitrox_pct=max_nitrox,
        max_trimix_pct=max_trimix,
        max_stages=max_stages
    )

    if user.avatar_type == AvatarType.custom:
        response_model_dict['avatar_full_url'] = r2_storage.get_photo_url(user.avatar_url)
    elif user.avatar_type == AvatarType.library:
        response_model_dict['avatar_full_url'] = r2_storage.get_library_avatar_url(user.avatar_url)
    else: # google or fallback
        response_model_dict['avatar_full_url'] = user.avatar_url
        
    return response_model_dict

# Admin user management endpoints - must be defined before regular routes
@router.get("/admin/users", response_model=List[UserListResponse])
async def list_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, max_length=200, description="Unified search across username and email"),
    is_admin: Optional[bool] = Query(None, description="Filter by admin role"),
    is_moderator: Optional[bool] = Query(None, description="Filter by moderator role"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    email_verified: Optional[bool] = Query(None, description="Filter by email verified status"),
    sort_by: Optional[str] = Query(None, description="Sort field (id, username, email, created_at, is_admin, enabled, email_verified)"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, 100, or 1000)")
):
    """List all users (admin only) with pagination, sorting, search, and filters"""
    # Validate page_size
    valid_page_sizes = [25, 50, 100, 1000]
    if page_size not in valid_page_sizes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"page_size must be one of: {', '.join(map(str, valid_page_sizes))}"
        )

    # Build query
    query = db.query(User)

    # Apply search filter
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term)
            )
        )

    # Apply filters
    if is_admin is not None:
        query = query.filter(User.is_admin == is_admin)
    
    if is_moderator is not None:
        query = query.filter(User.is_moderator == is_moderator)
    
    if enabled is not None:
        query = query.filter(User.enabled == enabled)
    
    if email_verified is not None:
        query = query.filter(User.email_verified == email_verified)

    # Apply sorting
    if sort_by:
        valid_sort_fields = {'id', 'username', 'email', 'created_at', 'is_admin', 'enabled', 'email_verified', 'last_accessed_at'}
        if sort_by not in valid_sort_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by field. Must be one of: {', '.join(valid_sort_fields)}"
            )

        if sort_order not in ['asc', 'desc']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sort_order must be 'asc' or 'desc'"
            )

        # Map sort fields to database columns
        if sort_by == 'id':
            sort_field = User.id
        elif sort_by == 'username':
            sort_field = func.lower(User.username)
        elif sort_by == 'email':
            sort_field = func.lower(User.email)
        elif sort_by == 'created_at':
            sort_field = User.created_at
        elif sort_by == 'is_admin':
            sort_field = User.is_admin
        elif sort_by == 'enabled':
            sort_field = User.enabled
        elif sort_by == 'email_verified':
            sort_field = User.email_verified
        elif sort_by == 'last_accessed_at':
            sort_field = User.last_accessed_at

        if sort_order == 'desc':
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    else:
        # Default sorting by id
        query = query.order_by(User.id.asc())

    # Get total count before pagination
    total_count = query.count()

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size
    has_next_page = page < total_pages
    has_prev_page = page > 1

    # Apply pagination
    users = query.offset(offset).limit(page_size).all()

    # Convert SQLAlchemy User objects to Pydantic models, then to dictionaries
    # Use orjson for optimized serialization (handles datetime natively)
    import orjson
    from fastapi.responses import Response
    
    user_list = []
    for user in users:
        dict_val = UserListResponse.model_validate(user).model_dump()
        user_list.append(populate_avatar_full_url(user, dict_val))

    # Return response with pagination headers
    # orjson.dumps returns bytes, so we pass it directly to content
    response = Response(content=orjson.dumps(user_list), media_type="application/json")
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(has_next_page).lower()
    response.headers["X-Has-Prev-Page"] = str(has_prev_page).lower()

    return response

@router.post("/admin/users", response_model=UserListResponse)
async def create_user(
    user_data: UserCreateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        is_admin=user_data.is_admin,
        is_moderator=user_data.is_moderator,
        enabled=user_data.enabled,
        email_verified=user_data.email_verified
    )

    if user_data.email_verified:
        db_user.email_verified_at = utcnow()

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default notification preferences for new user
    try:
        from app.utils import create_default_notification_preferences
        create_default_notification_preferences(db_user.id, db)
    except Exception as e:
        # Log error but don't fail user creation if preference creation fails
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to create default notification preferences for user {db_user.id}: {e}")

    response_dict = UserListResponse.model_validate(db_user).model_dump()
    return populate_avatar_full_url(db_user, response_dict)

@router.put("/admin/users/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update only provided fields
    update_data = user_update.model_dump(exclude_unset=True)

    # Handle password update separately
    if 'password' in update_data:
        password = update_data.pop('password')
        db_user.password_hash = get_password_hash(password)

    # Handle email_verified specifically to update email_verified_at
    if 'email_verified' in update_data:
        new_verified_status = update_data['email_verified']
        if new_verified_status and not db_user.email_verified:
            db_user.email_verified_at = utcnow()
        elif not new_verified_status:
            db_user.email_verified_at = None

    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)

    response_dict = UserListResponse.model_validate(db_user).model_dump()
    return populate_avatar_full_url(db_user, response_dict)

@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    force: bool = Query(False, description="Hard delete (admin only)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from deleting themselves
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    if force:
        # Delete related email verification tokens first to avoid foreign key issues
        from app.models import EmailVerificationToken
        db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == db_user.id).delete()

        db.delete(db_user)
        message = "User permanently deleted"
    else:
        from datetime import datetime, timezone
        db_user.deleted_at = utcnow()
        db_user.enabled = False
        message = "User archived successfully"

    db.commit()

    return {"message": message}

@router.post("/admin/users/{user_id}/restore")
async def restore_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Restore an archived user (admin only)"""
    db_user = db.query(User).filter(User.id == user_id).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if db_user.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not archived"
        )

    db_user.deleted_at = None
    db_user.enabled = True
    db.commit()

    return {"message": "User restored successfully"}

# Regular user endpoints
@router.delete("/me")
async def delete_current_user(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Archive current user account (soft delete)"""
    from datetime import datetime, timezone
    current_user.deleted_at = utcnow()
    current_user.enabled = False
    db.commit()
    return {"message": "Account archived successfully"}

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update only provided fields
    update_data = user_update.model_dump(exclude_unset=True)

    # Handle username update separately to enforce uniqueness and restrictions
    if 'username' in update_data:
        new_username = update_data['username']
        # Skip validation if it's the same username
        if new_username != current_user.username:
            # 1. Blacklist Check
            restricted_usernames = {"admin", "divemap", "moderator", "system", "support", "root"}
            if new_username.lower() in restricted_usernames:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This username is reserved and cannot be used."
                )
            # 2. Uniqueness Check
            existing_user = db.query(User).filter(User.username == new_username).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already registered"
                )

    # Handle password update separately
    if 'password' in update_data:
        password = update_data.pop('password')
        current_user.password_hash = get_password_hash(password)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    response_dict = UserResponse.model_validate(current_user).model_dump()
    return populate_avatar_full_url(current_user, response_dict)

@router.post("/me/change-password")
async def change_password(
    password_change: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not verify_password(password_change.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.password_hash = get_password_hash(password_change.new_password)
    db.commit()

    return {"message": "Password changed successfully"}

@router.post("/me/social-links", response_model=UserSocialLinkResponse)
async def add_social_link(
    link_data: UserSocialLinkCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add or update a social media link for the current user."""
    # Check if link for this platform already exists
    existing_link = db.query(UserSocialLink).filter(
        UserSocialLink.user_id == current_user.id,
        UserSocialLink.platform == link_data.platform
    ).first()

    if existing_link:
        # Update existing link
        existing_link.url = link_data.url
        db.commit()
        db.refresh(existing_link)
        return existing_link
    else:
        # Create new link
        new_link = UserSocialLink(
            user_id=current_user.id,
            platform=link_data.platform,
            url=link_data.url
        )
        db.add(new_link)
        db.commit()
        db.refresh(new_link)
        return new_link

@router.delete("/me/social-links/{platform}")
async def remove_social_link(
    platform: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a social media link for the current user."""
    link = db.query(UserSocialLink).filter(
        UserSocialLink.user_id == current_user.id,
        UserSocialLink.platform == platform
    ).first()

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social link not found"
        )

    db.delete(link)
    db.commit()
    return {"message": "Social link removed successfully"}

@router.get("/search", response_model=List[UserSearchResponse])
@skip_rate_limit_for_admin("60/minute")
async def search_users(
    request: Request,
    query: str = Query(..., min_length=1, max_length=100, description="Search term for username or name (max 100 characters)"),
    limit: int = Query(25, ge=1, le=100, description="Maximum number of results"),
    include_self: bool = Query(False, description="Include current user in results (useful for filtering)"),
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search for users by username or name. Only returns users with buddy_visibility='public' and enabled=True.
    By default excludes the current user from results, but can include with include_self=True."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Search for users matching query in username or name
    # Only include users with buddy_visibility='public' and enabled=True
    # Exclude current user unless include_self=True
    # When include_self=True, include current user regardless of buddy_visibility
    search_term = f"%{query.strip()}%"
    
    if include_self:
        # When including self, we need to handle current user separately
        # Current user should be included even if buddy_visibility is not 'public'
        # Other users still need buddy_visibility='public'
        from sqlalchemy import and_
        query_filter = db.query(User).filter(
            User.enabled == True,
            or_(
                and_(
                    User.id == current_user.id,
                    or_(
                        User.username.ilike(search_term),
                        User.name.ilike(search_term)
                    )
                ),
                and_(
                    User.buddy_visibility == 'public',
                    User.id != current_user.id,
                    or_(
                        User.username.ilike(search_term),
                        User.name.ilike(search_term)
                    )
                )
            )
        )
    else:
        # Default behavior: exclude current user and require buddy_visibility='public'
        query_filter = db.query(User).filter(
            User.enabled == True,
            User.buddy_visibility == 'public',
            User.id != current_user.id,
            or_(
                User.username.ilike(search_term),
                User.name.ilike(search_term)
            )
        )
    
    users = query_filter.limit(limit).all()
    
    result = []
    for user in users:
        dict_val = UserSearchResponse.model_validate(user).model_dump()
        result.append(populate_avatar_full_url(user, dict_val))
    
    return result

@router.get("/{username}/public", response_model=UserPublicProfileResponse)
@skip_rate_limit_for_admin("60/minute")
async def get_user_public_profile(
    request: Request,
    username: str,
    db: Session = Depends(get_db)
):
    """Get public profile information for a user by username"""
    # Find user by username
    user = db.query(User).filter(
        User.username == username,
        User.enabled == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Calculate user statistics for profile display
    # These queries are optimized with scalar() for single-value results
    
    # Rating and comment statistics
    dive_sites_rated = db.query(func.count(SiteRating.id)).filter(
        SiteRating.user_id == user.id
    ).scalar()

    site_comments_count = db.query(func.count(SiteComment.id)).filter(
        SiteComment.user_id == user.id
    ).scalar()

    center_comments_count = db.query(func.count(CenterComment.id)).filter(
        CenterComment.user_id == user.id
    ).scalar()

    # Total comments includes both dive site and diving center comments
    comments_posted = (site_comments_count or 0) + (center_comments_count or 0)

    # Content creation statistics
    dive_sites_created = db.query(func.count(DiveSite.id)).filter(
        DiveSite.created_by == user.id
    ).scalar()

    dives_created = db.query(func.count(Dive.id)).filter(
        Dive.user_id == user.id
    ).scalar()

    diving_centers_owned = db.query(func.count(DivingCenter.id)).filter(
        DivingCenter.owner_id == user.id
    ).scalar()

    # Rating count is the same as dive_sites_rated (for consistency in stats display)
    site_ratings_count = dive_sites_rated or 0

    # User's claimed total dives (from their profile)
    total_dives_claimed = user.number_of_dives or 0

    # Count dives where this user is a buddy (not the owner)
    buddy_dives_count = db.query(func.count(DiveBuddy.id)).filter(
        DiveBuddy.user_id == user.id
    ).scalar()

    # Leaderboard and gamification data
    from app.routers.leaderboard import get_user_leaderboard_data
    total_points, leaderboard_rank = get_user_leaderboard_data(db, user.id)

    # Create stats object
    stats = UserProfileStats(
        dive_sites_rated=dive_sites_rated or 0,
        comments_posted=comments_posted or 0,
        dive_sites_created=dive_sites_created or 0,
        dives_created=dives_created or 0,
        diving_centers_owned=diving_centers_owned or 0,
        site_comments_count=site_comments_count or 0,
        site_ratings_count=site_ratings_count or 0,
        total_dives_claimed=total_dives_claimed,
        buddy_dives_count=buddy_dives_count or 0,
        total_points=total_points,
        leaderboard_rank=leaderboard_rank
    )

    # Filter active certifications for public profile
    active_certifications = [cert for cert in user.certifications if cert.is_active]

    # Calculate certification stats using only active certifications
    cert_stats = calculate_certification_stats(active_certifications)

    # Calculate diving logbook stats
    from datetime import datetime, timedelta
    
    # 2. Max Depth, Longest Dive, TBT
    # first() on an aggregate query returns a Row object with the values
    stats_row = db.query(
        func.max(Dive.max_depth).label('max_depth'),
        func.max(Dive.duration).label('longest_dive_minutes'),
        func.sum(Dive.duration).label('total_bottom_time_minutes')
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).first()
    
    # 3. Favorite Dive Sites (Top 3)
    favorite_sites_query = db.query(
        DiveSite.id,
        DiveSite.name,
        func.count(Dive.id).label('visit_count')
    ).join(
        Dive, Dive.dive_site_id == DiveSite.id
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).group_by(
        DiveSite.id, DiveSite.name
    ).order_by(
        desc(func.count(Dive.id))
    ).limit(3).all()
    
    favorite_sites = [
        {"id": site.id, "name": site.name, "visit_count": site.visit_count}
        for site in favorite_sites_query
    ]
    
    # 4. Activity Heatmap (Last 365 days)
    # Get dives from the last year
    one_year_ago = utcnow().date() - timedelta(days=365)
    
    heatmap_query = db.query(
        Dive.dive_date,
        func.count(Dive.id).label('dive_count')
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        Dive.dive_date >= one_year_ago
    ).group_by(
        Dive.dive_date
    ).all()
    
    activity_heatmap = {
        date_obj.strftime("%Y-%m-%d"): count
        for date_obj, count in heatmap_query
        if date_obj
    }

    # 4.5 Depth Density Heatmap (Max vs Avg Depth)
    depths_query = db.query(
        Dive.max_depth,
        Dive.average_depth
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        Dive.max_depth.isnot(None),
        Dive.average_depth.isnot(None)
    ).all()

    def get_max_bucket(depth):
        if depth < 10: return "0-10"
        if depth < 20: return "10-20"
        if depth < 30: return "20-30"
        if depth < 40: return "30-40"
        if depth < 50: return "40-50"
        if depth < 60: return "50-60"
        if depth < 80: return "60-80"
        return "80+"

    def get_avg_bucket(depth):
        if depth < 5: return "0-5"
        if depth < 10: return "5-10"
        if depth < 15: return "10-15"
        if depth < 20: return "15-20"
        if depth < 25: return "20-25"
        if depth < 30: return "25-30"
        return "30+"

    heatmap_counts = {}
    for max_d, avg_d in depths_query:
        max_b = get_max_bucket(float(max_d))
        avg_b = get_avg_bucket(float(avg_d))
        
        # Key by a string tuple representation for aggregation
        key = f"{max_b}|{avg_b}"
        heatmap_counts[key] = heatmap_counts.get(key, 0) + 1

    depth_density_heatmap = [
        {"max_bin": k.split('|')[0], "avg_bin": k.split('|')[1], "count": v}
        for k, v in heatmap_counts.items()
    ]

    # 5. Most Active Month (All time)
    year_expr = extract('year', Dive.dive_date)
    month_expr = extract('month', Dive.dive_date)
    most_active_month_query = db.query(
        year_expr.label('year'),
        month_expr.label('month'),
        func.count(Dive.id).label('dive_count')
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).group_by(
        year_expr, month_expr
    ).order_by(
        desc(func.count(Dive.id))
    ).first()

    most_active_month = None
    if most_active_month_query:
        import calendar
        month_name = calendar.month_name[int(most_active_month_query.month)]
        most_active_month = f"{month_name} {int(most_active_month_query.year)} ({most_active_month_query.dive_count} dives)"
    
    # 6. Suit/Gear Preferences
    suit_query = db.query(
        Dive.suit_type,
        func.count(Dive.id).label('count')
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        Dive.suit_type.isnot(None)
    ).group_by(
        Dive.suit_type
    ).all()
    
    suit_preferences = {}
    for suit_type, count in suit_query:
      if suit_type:
        # Handle both Enum members and strings
        key = suit_type.value if hasattr(suit_type, 'value') else str(suit_type)
        suit_preferences[key] = count

    # 7. Gear Preferences (Singles vs Doubles vs Doubles+Stage)
    gear_query = db.query(
      Dive.gas_bottles_used
    ).filter(
      Dive.user_id == user.id,
      Dive.is_private == False,
      Dive.gas_bottles_used.isnot(None)
    ).all()

    gear_preferences = {"Singles": 0, "Doubles": 0, "Doubles + Stage": 0, "Singles + Stage": 0}
    
    def is_doubles_check(name):
      if not name: return False
      n = str(name).lower()
      # Explicit names
      if 'double' in n or 'twin' in n or n.startswith('d'):
        return True
      # Volumes that are definitely doubles (14=2x7, 16=2x8, 20=2x10, 24=2x12, 30=2x15)
      if n in ['14', '16', '20', '24', '30']:
        return True
      return False

    for (gear_str,) in gear_query:
      if not gear_str:
        continue
      
      try:
        # Check for structured JSON
        if gear_str.startswith('{'):
          import json
          data = json.loads(gear_str)
          if data.get('mode') == 'structured':
            back_gas = data.get('back_gas', {})
            tank_name = back_gas.get('tank', '')
            stages = data.get('stages', [])
            
            is_doubles = is_doubles_check(tank_name)
            
            if is_doubles:
              if stages:
                gear_preferences["Doubles + Stage"] += 1
              else:
                gear_preferences["Doubles"] += 1
            else:
              if stages:
                gear_preferences["Singles + Stage"] += 1
              else:
                gear_preferences["Singles"] += 1
            continue
      except:
        pass
      
      # Fallback for simple string format
      lower_gear = gear_str.lower()
      is_doubles = is_doubles_check(lower_gear)
      has_stage = 'stage' in lower_gear or '+' in lower_gear
      
      if is_doubles:
        if has_stage:
          gear_preferences["Doubles + Stage"] += 1
        else:
          gear_preferences["Doubles"] += 1
      else:
        if has_stage:
          gear_preferences["Singles + Stage"] += 1
        else:
          gear_preferences["Singles"] += 1

    # Remove empty categories
    gear_preferences = {k: v for k, v in gear_preferences.items() if v > 0}
    
    # Advanced Analytics Data (SAC, Temp, Duration, Time-Series)
    import json
    import re
    from app.physics import calculate_sac
    
    advanced_query = db.query(
        Dive.max_depth,
        Dive.duration,
        Dive.suit_type,
        Dive.dive_information,
        Dive.gas_bottles_used,
        Dive.average_depth,
        Dive.dive_date
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).order_by(Dive.dive_date.asc()).all()

    sac_vs_depth = []
    temp_vs_suit = []
    
    bubble_counts = {}
    year_counts = {}
    sac_monthly_acc = {}
    depth_monthly_acc = {}

    for d_max, d_dur, d_suit, d_info, d_gas, d_avg, d_date in advanced_query:
        month_str = d_date.strftime("%Y-%m") if d_date else None
        
        if d_date:
            year_str = str(d_date.year)
            year_counts[year_str] = year_counts.get(year_str, 0) + 1

        if d_max is not None and d_dur is not None:
            rounded_dur = int(round(float(d_dur) / 5.0) * 5)
            rounded_depth = int(round(float(d_max) / 5.0) * 5)
            b_key = f"{rounded_dur}|{rounded_depth}"
            bubble_counts[b_key] = bubble_counts.get(b_key, 0) + 1

        extracted_sac = None
        extracted_temp = None

        if d_info:
            temp_match = re.search(r"Water Temp:\s*([0-9.]+)", str(d_info))
            if temp_match:
                extracted_temp = float(temp_match.group(1))

            sac_match = re.search(r"SAC:\s*([0-9.]+)", str(d_info))
            if sac_match:
                extracted_sac = float(sac_match.group(1))

        if d_gas and d_dur and d_avg:
            try:
                if str(d_gas).startswith('{'):
                    gas_data = json.loads(d_gas)
                    if gas_data.get('mode') == 'structured':
                        bg = gas_data.get('back_gas', {})
                        t_vol = float(bg.get('tank', 0))
                        p_start = float(bg.get('start_pressure', 0))
                        p_end = float(bg.get('end_pressure', 0))
                        
                        if t_vol > 0 and p_start > p_end > 0:
                            calculated_sac = calculate_sac(
                                depth_meters=float(d_avg),
                                duration_minutes=float(d_dur),
                                tank_volume=t_vol,
                                start_pressure=p_start,
                                end_pressure=p_end
                            )
                            if calculated_sac > 0:
                                extracted_sac = calculated_sac
            except Exception:
                pass 

        if extracted_sac and d_max:
            sac_val = round(extracted_sac, 2)
            sac_vs_depth.append({"depth": float(d_max), "sac": sac_val})
            if month_str:
                sac_monthly_acc.setdefault(month_str, []).append(sac_val)

        if extracted_temp and d_suit:
            s_name = d_suit.value if hasattr(d_suit, 'value') else str(d_suit)
            temp_vs_suit.append({"suit": s_name, "temp": extracted_temp})

        if d_max and d_avg and month_str:
            acc = depth_monthly_acc.setdefault(month_str, {"max": [], "avg": []})
            acc["max"].append(float(d_max))
            acc["avg"].append(float(d_avg))

    duration_vs_depth = [
        {"duration": int(k.split('|')[0]), "depth": int(k.split('|')[1]), "count": v}
        for k, v in bubble_counts.items()
    ]
    dives_per_year = [
        {"year": k, "count": v} 
        for k, v in sorted(year_counts.items())
    ]
    sac_over_time = [
        {"date": k, "sac": round(sum(v) / len(v), 2)} 
        for k, v in sorted(sac_monthly_acc.items())
    ]
    depth_over_time = [
        {"date": k, "max": round(sum(v["max"]) / len(v["max"]), 2), "avg": round(sum(v["avg"]) / len(v["avg"]), 2)} 
        for k, v in sorted(depth_monthly_acc.items())
    ]

    from app.schemas import FavoriteDiveSite # Ensure it's imported for selection if needed, although defined in schemas/__init__.py
    
    diving_stats = DivingStatsResponse(
      max_depth=float(stats_row.max_depth) if stats_row and stats_row.max_depth else None,
      longest_dive_minutes=int(stats_row.longest_dive_minutes) if stats_row and stats_row.longest_dive_minutes else None,
      total_bottom_time_minutes=int(stats_row.total_bottom_time_minutes) if stats_row and stats_row.total_bottom_time_minutes else None,
      most_active_month=most_active_month,
      favorite_sites=favorite_sites,
      activity_heatmap=activity_heatmap,
      depth_density_heatmap=depth_density_heatmap,
      suit_preferences=suit_preferences,
      gear_preferences=gear_preferences,
      sac_vs_depth=sac_vs_depth,
      duration_vs_depth=duration_vs_depth,
      temp_vs_suit=temp_vs_suit,
      dives_per_year=dives_per_year,
      sac_over_time=sac_over_time,
      depth_over_time=depth_over_time
    )

    # Create response object
    response_dict = UserPublicProfileResponse(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        avatar_type=user.avatar_type or AvatarType.google,
        is_admin=user.is_admin,
        is_moderator=user.is_moderator,
        number_of_dives=user.number_of_dives,
        member_since=user.created_at,
        certifications=active_certifications,
        social_links=user.social_links,
        stats=stats,
        certification_stats=cert_stats,
        diving_stats=diving_stats
    ).model_dump()

    return populate_avatar_full_url(user, response_dict)


# API Key Management Endpoints (Admin Only)
@router.get("/admin/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all API keys (admin only)"""
    api_keys = db.query(ApiKey).order_by(ApiKey.created_at.desc()).all()
    
    # Build response with created_by username
    result = []
    for key in api_keys:
        created_by_username = None
        if key.created_by_user_id:
            creator = db.query(User).filter(User.id == key.created_by_user_id).first()
            if creator:
                created_by_username = creator.username
        
        result.append(ApiKeyResponse(
            id=key.id,
            name=key.name,
            description=key.description,
            created_by_user_id=key.created_by_user_id,
            created_by_username=created_by_username,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            is_active=key.is_active,
            created_at=key.created_at,
            updated_at=key.updated_at
        ))
    
    return result


@router.post("/admin/api-keys", response_model=ApiKeyCreateResponse)
async def create_api_key(
    key_data: ApiKeyCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new API key (admin only).
    The actual key value is only returned once on creation.
    """
    # Generate secure API key: "dm_" prefix + base64(32 random bytes)
    random_bytes = secrets.token_bytes(32)
    api_key_value = "dm_" + base64.urlsafe_b64encode(random_bytes).decode('utf-8').rstrip('=')
    
    # Hash the key for storage (using bcrypt like passwords)
    key_hash = get_password_hash(api_key_value)
    
    # Create API key record
    db_api_key = ApiKey(
        name=key_data.name,
        key_hash=key_hash,
        description=key_data.description,
        created_by_user_id=current_user.id,
        expires_at=key_data.expires_at,
        is_active=True
    )
    
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    # Return response with the actual key (only time it's shown)
    return ApiKeyCreateResponse(
        id=db_api_key.id,
        name=db_api_key.name,
        api_key=api_key_value,
        description=db_api_key.description,
        expires_at=db_api_key.expires_at,
        created_at=db_api_key.created_at,
        warning="Store this API key securely. It will not be shown again."
    )


@router.get("/admin/api-keys/{key_id}", response_model=ApiKeyResponse)
async def get_api_key(
    key_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get API key details (admin only, key value not shown)"""
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Get created_by username
    created_by_username = None
    if api_key.created_by_user_id:
        creator = db.query(User).filter(User.id == api_key.created_by_user_id).first()
        if creator:
            created_by_username = creator.username
    
    return ApiKeyResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        created_by_user_id=api_key.created_by_user_id,
        created_by_username=created_by_username,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at
    )


@router.put("/admin/api-keys/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: int,
    key_update: ApiKeyUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update API key (admin only)"""
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Update only provided fields
    update_data = key_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)
    
    db.commit()
    db.refresh(api_key)
    
    # Get created_by username
    created_by_username = None
    if api_key.created_by_user_id:
        creator = db.query(User).filter(User.id == api_key.created_by_user_id).first()
        if creator:
            created_by_username = creator.username
    
    return ApiKeyResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        created_by_user_id=api_key.created_by_user_id,
        created_by_username=created_by_username,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at
    )


@router.delete("/admin/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete API key (admin only)"""
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    db.delete(api_key)
    db.commit()
    
    return {"message": "API key deleted successfully"}


# Personal Access Token (PAT) Management
@router.get("/me/tokens", response_model=List[PATResponse])
async def list_pats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all Personal Access Tokens for the current user"""
    pats = db.query(PersonalAccessToken).filter(
        PersonalAccessToken.user_id == current_user.id
    ).order_by(PersonalAccessToken.created_at.desc()).all()
    return pats


@router.post("/me/tokens", response_model=PATCreateResponse)
async def create_pat(
    token_data: PATCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new Personal Access Token.
    The actual token value is only returned once on creation.
    """
    # Check current number of active tokens
    count = db.query(PersonalAccessToken).filter(
        PersonalAccessToken.user_id == current_user.id,
        PersonalAccessToken.is_active == True
    ).count()
    
    if count >= 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of active tokens (10) reached. Please revoke an old token first."
        )

    # Generate secure PAT: "dm_pat_" prefix + base64(32 random bytes)
    random_bytes = secrets.token_bytes(32)
    token_suffix = base64.urlsafe_b64encode(random_bytes).decode('utf-8').rstrip('=')
    token_value = "dm_pat_" + token_suffix
    
    # Prefix for lookup (e.g., first 12 chars of the suffix)
    token_prefix = token_suffix[:12]
    
    # Hash the token for storage
    token_hash = get_password_hash(token_value)
    
    # Calculate expiration
    expires_at = None
    if token_data.expires_in_days:
        from datetime import timedelta
        expires_at = utcnow() + timedelta(days=token_data.expires_in_days)
    
    # Create PAT record
    db_pat = PersonalAccessToken(
        user_id=current_user.id,
        name=token_data.name,
        token_prefix=token_prefix,
        token_hash=token_hash,
        expires_at=expires_at,
        is_active=True
    )
    
    db.add(db_pat)
    db.commit()
    db.refresh(db_pat)
    
    return PATCreateResponse(
        id=db_pat.id,
        name=db_pat.name,
        token=token_value,
        expires_at=db_pat.expires_at,
        last_used_at=db_pat.last_used_at,
        is_active=db_pat.is_active,
        created_at=db_pat.created_at,
        updated_at=db_pat.updated_at
    )


@router.delete("/me/tokens/{token_id}")
async def delete_pat(
    token_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke/Delete a Personal Access Token"""
    pat = db.query(PersonalAccessToken).filter(
        PersonalAccessToken.id == token_id,
        PersonalAccessToken.user_id == current_user.id
    ).first()
    
    if not pat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    db.delete(pat)
    db.commit()
    
    return {"message": "Token revoked successfully"}

# Avatar Management Endpoints
@router.post("/me/avatar/upload", response_model=UserResponse)
async def upload_user_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a custom avatar to R2/Local storage"""
    # 1. Read and process image
    content = await file.read()
    try:
        processed_stream = image_processing.process_avatar(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 2. Upload to storage
    filename = f"{uuid.uuid4()}.webp"
    file_path = r2_storage.upload_avatar(current_user.id, filename, processed_stream.getvalue())
    
    # 3. Update user model
    # Delete old custom avatar if exists (optional cleanup)
    
    current_user.avatar_url = file_path
    current_user.avatar_type = AvatarType.custom
    db.commit()
    db.refresh(current_user)
    
    response_dict = UserResponse.model_validate(current_user).model_dump()
    return populate_avatar_full_url(current_user, response_dict)

@router.post("/me/avatar/library", response_model=UserResponse)
async def set_library_avatar(
    avatar_data: AvatarUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Set avatar from the library"""
    if avatar_data.avatar_type != AvatarType.library:
        raise HTTPException(status_code=400, detail="Invalid avatar type for this endpoint")
    
    # Basic security check: ensure it's a path we expect for library
    if not avatar_data.avatar_url.startswith("library/avatars/"):
        raise HTTPException(status_code=400, detail="Invalid library avatar path")
        
    current_user.avatar_url = avatar_data.avatar_url
    current_user.avatar_type = AvatarType.library
    db.commit()
    db.refresh(current_user)
    
    response_dict = UserResponse.model_validate(current_user).model_dump()
    return populate_avatar_full_url(current_user, response_dict)

@router.delete("/me/avatar", response_model=UserResponse)
async def remove_avatar(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reset avatar to Google or None"""
    if current_user.google_avatar_url:
        current_user.avatar_url = current_user.google_avatar_url
        current_user.avatar_type = AvatarType.google
    else:
        current_user.avatar_url = None
        current_user.avatar_type = None
        
    db.commit()
    db.refresh(current_user)
    
    response_dict = UserResponse.model_validate(current_user).model_dump()
    return populate_avatar_full_url(current_user, response_dict)

@router.get("/avatars/library", response_model=List[dict])
async def get_library_avatars():
    """List available library avatars with full URLs"""
    keys = r2_storage.list_objects("library/avatars/")
    result = []
    for k in keys:
        if k.endswith('.webp'):
            result.append({
                "path": k,
                "full_url": r2_storage.get_library_avatar_url(k)
            })
    return result
