from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app.models import User, SiteRating, SiteComment, CenterComment, DiveSite, Dive, DivingCenter, DiveBuddy, ApiKey, UserSocialLink
from app.schemas import (
    UserResponse, UserUpdate, UserCreateAdmin, UserUpdateAdmin, UserListResponse, 
    PasswordChangeRequest, UserPublicProfileResponse, UserProfileStats, UserSearchResponse,
    ApiKeyResponse, ApiKeyCreate, ApiKeyCreateResponse, ApiKeyUpdate, CertificationStats,
    UserSocialLinkCreate, UserSocialLinkResponse
)
from app.auth import get_current_active_user, get_current_admin_user, get_password_hash, verify_password, is_admin_or_moderator
from app.limiter import skip_rate_limit_for_admin
from sqlalchemy import func
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
    
    user_list = [UserListResponse.model_validate(user).model_dump() for user in users]

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
        enabled=user_data.enabled
    )

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

    return db_user

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

    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)

    return db_user

@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
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

    # Delete related email verification tokens first to avoid foreign key issues
    from app.models import EmailVerificationToken
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == db_user.id).delete()

    db.delete(db_user)
    db.commit()

    return {"message": "User deleted successfully"}

# Regular user endpoints
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update only provided fields
    update_data = user_update.model_dump(exclude_unset=True)

    # Handle password update separately
    if 'password' in update_data:
        password = update_data.pop('password')
        current_user.password_hash = get_password_hash(password)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user

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
    
    return [
        UserSearchResponse(
            id=user.id,
            username=user.username,
            name=user.name,
            avatar_url=user.avatar_url
        )
        for user in users
    ]

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
        buddy_dives_count=buddy_dives_count or 0
    )

    # Calculate certification stats
    cert_stats = calculate_certification_stats(user.certifications)

    # Create response object
    response = UserPublicProfileResponse(
        username=user.username,
        avatar_url=user.avatar_url,
        is_admin=user.is_admin,
        is_moderator=user.is_moderator,
        number_of_dives=user.number_of_dives,
        member_since=user.created_at,
        certifications=user.certifications,
        social_links=user.social_links,
        stats=stats,
        certification_stats=cert_stats
    )

    return response


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