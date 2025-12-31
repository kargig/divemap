from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Union, Literal, Dict
from datetime import datetime, date, time, timezone
import re
import enum

# Valid difficulty codes
DifficultyCode = Optional[Literal['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']]


def normalize_datetime_to_utc(cls, v):
    """
    Pydantic validator to normalize datetime fields to UTC timezone-aware datetimes.
    Can be used as a validator for any datetime field in any schema.
    """
    if v is None:
        return v
    if isinstance(v, datetime):
        # If naive datetime, assume it's UTC (from database with timezone=True)
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        # If timezone-aware, convert to UTC
        elif v.tzinfo != timezone.utc:
            return v.astimezone(timezone.utc)
        return v
    return v

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    number_of_dives: Optional[int] = Field(None, ge=0)
    buddy_visibility: Optional[str] = Field(None, pattern=r"^(public|private)$", description="Control whether user can be added as buddy: 'public' or 'private'")

class UserResponse(UserBase):
    id: int
    name: Optional[str] = None
    enabled: bool
    email_verified: bool = False
    is_admin: bool
    is_moderator: bool
    number_of_dives: int = 0
    buddy_visibility: str = 'public'
    created_at: datetime
    updated_at: datetime

    @validator('created_at', 'updated_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=255, description="Username or email address")
    password: str = Field(..., min_length=1, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class RegistrationResponse(BaseModel):
    access_token: Optional[str]
    token_type: str
    expires_in: int
    message: str

class ResendVerificationRequest(BaseModel):
    """Request to resend email verification."""
    email: EmailStr = Field(..., description="Email address to resend verification")

class TokenData(BaseModel):
    username: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

# Admin user management schemas
class UserCreateAdmin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    is_admin: bool = False
    is_moderator: bool = False
    enabled: bool = True

class UserUpdateAdmin(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: Optional[EmailStr] = None
    is_admin: Optional[bool] = None
    is_moderator: Optional[bool] = None
    enabled: Optional[bool] = None

class UserListResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_moderator: bool
    enabled: bool
    email_verified: bool
    email_verified_at: Optional[datetime] = None
    created_at: datetime

    @validator('created_at', 'email_verified_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

# Dive Site Schemas
class DiveSiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    access_instructions: Optional[str] = None
    difficulty_code: DifficultyCode = Field(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None  # Safety information
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: Optional[str] = None  # Country name
    region: Optional[str] = None  # Region/state/province name
    shore_direction: Optional[float] = Field(None, ge=0, le=360, description="Compass bearing (0-360 degrees) indicating which direction the shore/beach faces")

class DiveSiteCreate(DiveSiteBase):
    pass

class DiveSiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    access_instructions: Optional[str] = None
    difficulty_code: DifficultyCode = Field(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None  # Safety information
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: Optional[str] = None  # Country name
    region: Optional[str] = None  # Region/state/province name
    shore_direction: Optional[float] = Field(None, ge=0, le=360, description="Compass bearing (0-360 degrees) indicating which direction the shore/beach faces")
    shore_direction_confidence: Optional[str] = Field(None, description="Confidence level: 'high', 'medium', 'low'")
    shore_direction_method: Optional[str] = Field(None, description="Method used: 'osm_coastline', 'manual', 'ai', etc.")
    shore_direction_distance_m: Optional[float] = Field(None, ge=0, description="Distance to coastline in meters")

# Dive Site Alias Schemas
class DiveSiteAliasBase(BaseModel):
    alias: str = Field(..., min_length=1, max_length=255)

class DiveSiteAliasCreate(DiveSiteAliasBase):
    pass

class DiveSiteAliasUpdate(BaseModel):
    alias: Optional[str] = Field(None, min_length=1, max_length=255)

class DiveSiteAliasResponse(DiveSiteAliasBase):
    id: int
    dive_site_id: int
    created_at: datetime

    @validator('created_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

class DiveSiteResponse(DiveSiteBase):
    id: int
    created_at: datetime
    created_by: int
    updated_at: datetime
    average_rating: Optional[float] = None
    total_ratings: int = 0
    view_count: Optional[int] = None  # Only included for admin users
    tags: List[dict] = []
    user_rating: Optional[float] = None
    distance_km: Optional[float] = None
    aliases: List[DiveSiteAliasResponse] = []  # List of aliases for this dive site
    difficulty_label: Optional[str] = None  # Human-readable difficulty label
    shore_direction: Optional[float] = None  # Compass bearing (0-360 degrees) indicating which direction the shore/beach faces
    shore_direction_confidence: Optional[str] = None  # Confidence level: 'high', 'medium', 'low'
    shore_direction_method: Optional[str] = None  # Method used: 'osm_coastline', 'manual', 'ai', etc.
    shore_direction_distance_m: Optional[float] = None  # Distance to coastline in meters

    @validator('created_at', 'updated_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

# Site Rating Schemas
class SiteRatingCreate(BaseModel):
    score: float = Field(..., ge=1, le=10)

class SiteRatingResponse(BaseModel):
    id: int
    dive_site_id: int
    user_id: int
    score: float
    created_at: datetime

    @validator('created_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

# Comment Schemas
class SiteCommentCreate(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=1000)

class SiteCommentUpdate(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=1000)

class SiteCommentResponse(BaseModel):
    id: int
    dive_site_id: int
    user_id: int
    username: str
    comment_text: str
    created_at: datetime
    updated_at: datetime
    user_diving_certification: Optional[str] = None
    user_number_of_dives: Optional[int] = None

    @validator('created_at', 'updated_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

# Media Schemas
class SiteMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None

class SiteMediaUpdate(BaseModel):
    description: Optional[str] = None

class SiteMediaResponse(BaseModel):
    id: int
    dive_site_id: int
    media_type: str
    url: str
    description: Optional[str] = None
    created_at: datetime
    # Optional fields for dive media (when media comes from a dive)
    dive_id: Optional[int] = None
    user_id: Optional[int] = None
    user_username: Optional[str] = None

    class Config:
        from_attributes = True

# Search Parameters
class DiveSiteSearchParams(BaseModel):
    name: Optional[str] = None
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING; omit for no filter",
    )
    exclude_unspecified_difficulty: bool = False
    min_rating: Optional[float] = Field(None, ge=0, le=10, description="Minimum average rating (0-10)")
    tag_ids: Optional[List[int]] = None
    country: Optional[str] = None
    region: Optional[str] = None
    sort_by: Optional[str] = Field(None, description="Sort field (name, country, region, difficulty_level, view_count, comment_count, created_at, updated_at)")
    sort_order: Optional[str] = Field("asc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

# Diving Center Schemas
class DivingCenterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    # Make description optional at the base level so responses don't fail when empty
    description: Optional[str] = None
    address: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    # Allow None in responses for legacy rows; enforce on create
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    country: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)

class DivingCenterCreate(DivingCenterBase):
    # Enforce description requirement on create to maintain data quality
    description: str = Field(..., min_length=1)
    # Enforce coordinates on create
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class DivingCenterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    address: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    country: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)

class DivingCenterResponse(DivingCenterBase):
    id: int
    created_at: datetime
    updated_at: datetime
    average_rating: Optional[float] = None
    total_ratings: int = 0
    view_count: Optional[int] = None  # Only included for admin users
    user_rating: Optional[float] = None
    ownership_status: Optional[str] = None
    owner_username: Optional[str] = None

    class Config:
        from_attributes = True

# Center Rating Schemas
class CenterRatingCreate(BaseModel):
    score: float = Field(..., ge=1, le=10)

class CenterRatingResponse(BaseModel):
    id: int
    diving_center_id: int
    user_id: int
    score: float
    created_at: datetime

    class Config:
        from_attributes = True

# Center Comment Schemas
class CenterCommentCreate(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=1000)

class CenterCommentUpdate(BaseModel):
    comment_text: str = Field(..., min_length=1, max_length=1000)

class CenterCommentResponse(BaseModel):
    id: int
    diving_center_id: int
    user_id: int
    username: str
    comment_text: str
    created_at: datetime
    updated_at: datetime
    user_diving_certification: Optional[str] = None
    user_number_of_dives: Optional[int] = None

    class Config:
        from_attributes = True

# Center Search Parameters
class DivingCenterSearchParams(BaseModel):
    name: Optional[str] = None
    search: Optional[str] = None  # Unified search across name, description, country, region, city
    country: Optional[str] = None  # Filter by country
    region: Optional[str] = None   # Filter by region
    city: Optional[str] = None     # Filter by city
    min_rating: Optional[float] = Field(None, ge=0, le=10)
    max_rating: Optional[float] = Field(None, ge=0, le=10)
    sort_by: Optional[str] = Field(None, description="Sort field (name, view_count, comment_count, created_at, updated_at, country, region, city)")
    sort_order: Optional[str] = Field("asc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

# Tag Schemas
class AvailableTagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None

class AvailableTagCreate(AvailableTagBase):
    pass

class AvailableTagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None

class AvailableTagResponse(AvailableTagBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Tag schemas with expected names for router compatibility
class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None

class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None

class TagResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TagWithCountResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    dive_site_count: int

    class Config:
        from_attributes = True

class DiveSiteTagCreate(BaseModel):
    tag_id: int

class DiveSiteTagResponse(BaseModel):
    id: int
    dive_site_id: int
    tag_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Center-Dive Site Association
class CenterDiveSiteCreate(BaseModel):
    diving_center_id: int
    dive_cost: Optional[float] = Field(None, ge=0)
    currency: str = Field("EUR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")

class CenterDiveSiteResponse(BaseModel):
    id: int
    dive_site_id: int
    diving_center_id: int
    dive_cost: Optional[float] = None
    currency: str = "EUR"
    created_at: datetime

    class Config:
        from_attributes = True

# Certification Level Schemas
class CertificationLevelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = None
    max_depth: Optional[str] = None
    gases: Optional[str] = None
    tanks: Optional[str] = None
    deco_time_limit: Optional[str] = None
    prerequisites: Optional[str] = None

class CertificationLevelCreate(CertificationLevelBase):
    diving_organization_id: int

class CertificationLevelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    max_depth: Optional[str] = None
    gases: Optional[str] = None
    tanks: Optional[str] = None
    deco_time_limit: Optional[str] = None
    prerequisites: Optional[str] = None

class CertificationLevelResponse(CertificationLevelBase):
    id: int
    diving_organization_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Gear Rental Cost Schemas
class GearRentalCostCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=100)
    cost: float = Field(..., ge=0)
    currency: str = Field("EUR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")

class GearRentalCostResponse(BaseModel):
    id: int
    diving_center_id: int
    item_name: str
    cost: float
    currency: str = "EUR"
    created_at: datetime

    class Config:
        from_attributes = True

# Diving Organization Schemas
class DivingOrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    acronym: str = Field(..., min_length=1, max_length=20)
    website: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    founded_year: Optional[int] = Field(None, ge=1800, le=2100)

class DivingOrganizationCreate(DivingOrganizationBase):
    pass

class DivingOrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    acronym: Optional[str] = Field(None, min_length=1, max_length=20)
    website: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    founded_year: Optional[int] = Field(None, ge=1800, le=2100)

class DivingOrganizationResponse(DivingOrganizationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    certification_levels: List[CertificationLevelResponse] = []

    class Config:
        from_attributes = True

# Diving Center Organization Schemas
class DivingCenterOrganizationBase(BaseModel):
    diving_organization_id: int
    is_primary: bool = False

class DivingCenterOrganizationCreate(DivingCenterOrganizationBase):
    pass

class DivingCenterOrganizationUpdate(BaseModel):
    is_primary: Optional[bool] = None

class DivingCenterOrganizationResponse(DivingCenterOrganizationBase):
    id: int
    diving_center_id: int
    diving_organization: DivingOrganizationResponse
    created_at: datetime

    class Config:
        from_attributes = True

# User Certification Schemas
class UserCertificationBase(BaseModel):
    diving_organization_id: int
    certification_level: Optional[str] = Field(None, max_length=100) # Optional now, prefer ID
    certification_level_id: Optional[int] = None
    is_active: bool = True

class UserCertificationCreate(UserCertificationBase):
    pass

class UserCertificationUpdate(BaseModel):
    diving_organization_id: Optional[int] = None
    certification_level: Optional[str] = Field(None, max_length=100)
    certification_level_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserCertificationResponse(UserCertificationBase):
    id: int
    user_id: int
    diving_organization: DivingOrganizationResponse
    certification_level_link: Optional[CertificationLevelResponse] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Updated User Response to include certifications
class UserResponseWithCertifications(UserResponse):
    certifications: List[UserCertificationResponse] = []

    class Config:
        from_attributes = True

# Public Profile Schemas
class UserProfileStats(BaseModel):
    dive_sites_rated: int
    comments_posted: int
    dive_sites_created: int
    dives_created: int
    diving_centers_owned: int
    site_comments_count: int
    site_ratings_count: int
    total_dives_claimed: int
    buddy_dives_count: int

    class Config:
        from_attributes = True

class UserPublicProfileResponse(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    number_of_dives: int
    member_since: datetime
    certifications: List[UserCertificationResponse] = []
    stats: UserProfileStats

    class Config:
        from_attributes = True

# User Public Info for buddy lists
class UserPublicInfo(BaseModel):
    id: int
    username: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

# User Search Response
class UserSearchResponse(BaseModel):
    id: int
    username: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

# Updated Diving Center Response to include organizations
class DivingCenterResponseWithOrganizations(DivingCenterResponse):
    organizations: List[DivingCenterOrganizationResponse] = []

    class Config:
        from_attributes = True

# Dive Schemas
class DiveBase(BaseModel):
    dive_site_id: Optional[int] = None
    diving_center_id: Optional[int] = None  # Link to diving center
    selected_route_id: Optional[int] = None  # Selected dive route
    name: Optional[str] = Field(None, max_length=255)  # Custom name/alias
    is_private: bool = False  # Privacy control - default public
    dive_information: Optional[str] = None
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    average_depth: Optional[float] = Field(None, ge=0, le=1000)  # Average depth in meters
    gas_bottles_used: Optional[str] = None
    suit_type: Optional[str] = Field(None, pattern=r"^(wet_suit|dry_suit|shortie)$")
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    visibility_rating: Optional[int] = Field(None, ge=1, le=10)
    user_rating: Optional[int] = Field(None, ge=1, le=10)
    dive_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD format
    dive_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")  # HH:MM:SS format
    duration: Optional[int] = Field(None, ge=1, le=1440)  # Duration in minutes

class DiveCreate(DiveBase):
    buddies: Optional[List[int]] = None  # List of user IDs to add as buddies

class DiveUpdate(BaseModel):
    dive_site_id: Optional[int] = None
    diving_center_id: Optional[int] = None  # Link to diving center
    selected_route_id: Optional[int] = None  # Selected dive route
    name: Optional[str] = Field(None, max_length=255)
    is_private: Optional[bool] = None
    dive_information: Optional[str] = None
    max_depth: Optional[float] = Field(None, ge=0, le=1000)
    average_depth: Optional[float] = Field(None, ge=0, le=1000)
    gas_bottles_used: Optional[str] = None
    suit_type: Optional[str] = Field(None, pattern=r"^(wet_suit|dry_suit|shortie)$")
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    visibility_rating: Optional[int] = Field(None, ge=1, le=10)
    user_rating: Optional[int] = Field(None, ge=1, le=10)
    dive_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    dive_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")
    duration: Optional[int] = Field(None, ge=1, le=1440)
    tags: Optional[List[int]] = None  # List of tag IDs
    buddies: Optional[List[int]] = None  # List of user IDs to add as buddies

class DiveResponse(DiveBase):
    id: int
    user_id: int
    dive_site_id: Optional[int] = None
    diving_center_id: Optional[int] = None  # Link to diving center
    selected_route_id: Optional[int] = None  # Selected dive route
    name: Optional[str] = None
    is_private: bool = False
    dive_information: Optional[str] = None
    max_depth: Optional[float] = None
    average_depth: Optional[float] = None
    gas_bottles_used: Optional[str] = None
    suit_type: Optional[str] = None
    difficulty_level: Optional[str] = None
    visibility_rating: Optional[int] = None
    user_rating: Optional[int] = None
    dive_date: str
    dive_time: Optional[str] = None
    duration: Optional[int] = None
    view_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    dive_site: Optional[dict] = None
    diving_center: Optional[dict] = None  # Diving center information
    selected_route: Optional[dict] = None  # Selected route information
    media: List[dict] = []
    tags: List[dict] = []
    buddies: List[UserPublicInfo] = []  # List of buddy users
    user_username: Optional[str] = None  # For public dives

    @validator('created_at', 'updated_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True

class DiveMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video|dive_plan|external_link)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    title: Optional[str] = Field(None, max_length=255)  # For external links
    thumbnail_url: Optional[str] = Field(None, max_length=500)  # For external links

class DiveMediaUpdate(BaseModel):
    description: Optional[str] = None

class DiveMediaResponse(BaseModel):
    id: int
    dive_id: int
    media_type: str
    url: str
    description: Optional[str] = None
    title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime

# Buddy Management Schemas
class AddBuddiesRequest(BaseModel):
    buddy_ids: List[int] = Field(..., min_items=1, max_items=20, description="List of user IDs to add as buddies (max 20)")

class ReplaceBuddiesRequest(BaseModel):
    buddy_ids: List[int] = Field(..., max_items=20, description="List of user IDs to set as buddies (max 20, can be empty to remove all)")

    class Config:
        from_attributes = True

class DiveTagCreate(BaseModel):
    tag_id: int

class DiveTagResponse(BaseModel):
    id: int
    dive_id: int
    tag_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DiveSearchParams(BaseModel):
    dive_site_id: Optional[int] = None
    search: Optional[str] = None  # Unified search across dive site name, description, notes
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING; omit for no filter",
    )
    exclude_unspecified_difficulty: bool = False
    suit_type: Optional[str] = Field(None, pattern=r"^(wet_suit|dry_suit|shortie)$")
    min_depth: Optional[float] = Field(None, ge=0, le=1000)
    max_depth: Optional[float] = Field(None, ge=0, le=1000)
    min_visibility: Optional[int] = Field(None, ge=1, le=10)
    max_visibility: Optional[int] = Field(None, ge=1, le=10)
    min_rating: Optional[int] = Field(None, ge=1, le=10)
    max_rating: Optional[int] = Field(None, ge=1, le=10)
    start_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    tag_ids: Optional[List[int]] = None
    sort_by: Optional[str] = Field(None, description="Sort field (dive_date, max_depth, duration, difficulty_level, visibility_rating, user_rating, view_count, created_at, updated_at)")
    sort_order: Optional[str] = Field("desc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

# Diving Center Ownership Schemas
class DivingCenterOwnershipClaim(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)

class DivingCenterOwnershipResponse(BaseModel):
    id: int
    name: str
    owner_id: Optional[int] = None
    ownership_status: str
    owner_username: Optional[str] = None
    location: Optional[str] = None
    claim_reason: Optional[str] = None
    request_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DivingCenterOwnershipRevocation(BaseModel):
    """Schema for revoking diving center ownership."""
    reason: Optional[str] = Field(None, max_length=1000)

class DivingCenterOwnershipApproval(BaseModel):
    approved: bool
    reason: Optional[str] = Field(None, max_length=1000)

class OwnershipRequestHistoryResponse(BaseModel):
    id: int
    diving_center_id: int
    diving_center_name: str
    user_id: int
    username: str
    request_status: str
    request_date: datetime
    processed_date: Optional[datetime] = None
    processed_by: Optional[int] = None
    admin_username: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# ParsedDiveResponse schemas
class ParsedDiveResponse(BaseModel):
    id: int
    trip_id: int
    dive_site_id: Optional[int] = None
    dive_number: int
    dive_time: Optional[time] = None
    dive_duration: Optional[int] = None
    dive_description: Optional[str] = None
    dive_site_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ParsedDiveCreate(BaseModel):
    trip_id: Optional[int] = None  # Optional when creating dives as part of a trip (backend sets it)
    dive_site_id: Optional[int] = None
    dive_number: int = Field(..., ge=1)
    dive_time: Optional[time] = None
    dive_duration: Optional[int] = Field(None, ge=1, le=1440)
    dive_description: Optional[str] = None

class ParsedDiveUpdate(BaseModel):
    dive_site_id: Optional[int] = None
    dive_number: Optional[int] = Field(None, ge=1)
    dive_time: Optional[time] = None
    dive_duration: Optional[int] = Field(None, ge=1, le=1440)
    dive_description: Optional[str] = None

class ParsedDiveTripResponse(BaseModel):
    id: int
    diving_center_id: Optional[int] = None
    trip_date: date
    trip_time: Optional[time] = None
    trip_duration: Optional[int] = None  # Total duration in minutes
    trip_difficulty_code: DifficultyCode = None
    trip_difficulty_label: Optional[str] = None
    trip_price: Optional[float] = None
    trip_currency: str = "EUR"
    group_size_limit: Optional[int] = None
    current_bookings: int = 0
    trip_description: Optional[str] = None
    special_requirements: Optional[str] = None
    trip_status: str = "scheduled"
    diving_center_name: Optional[str] = None
    dives: List[ParsedDiveResponse] = []  # List of dives in this trip
    source_newsletter_id: Optional[int] = None  # ID of the source newsletter
    newsletter_content: Optional[str] = None  # Content of the source newsletter
    extracted_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Newsletter and Parsed Dive Trip Schemas
class NewsletterUploadResponse(BaseModel):
    newsletter_id: int
    trips_created: int
    message: str

# Newsletter Text Parse Request Schema
class NewsletterParseTextRequest(BaseModel):
    content: str
    diving_center_id: Optional[int] = None
    use_openai: bool = True

# Newsletter Management Schemas
class NewsletterResponse(BaseModel):
    id: int
    content: str
    received_at: datetime
    trips_count: int = 0

    class Config:
        from_attributes = True

class NewsletterUpdateRequest(BaseModel):
    content: Optional[str] = None

class NewsletterDeleteRequest(BaseModel):
    newsletter_ids: List[int] = Field(..., min_items=1, max_items=100)

class NewsletterDeleteResponse(BaseModel):
    deleted_count: int
    message: str

# ParsedDiveTrip CRUD schemas
class ParsedDiveTripCreate(BaseModel):
    diving_center_id: Optional[int] = None
    trip_date: date
    trip_time: Optional[time] = None
    trip_duration: Optional[int] = Field(None, ge=1, le=1440)  # Duration in minutes
    trip_difficulty_code: DifficultyCode = Field(None, description="Difficulty code or null")
    trip_price: Optional[float] = Field(None, ge=0)
    trip_currency: str = Field("EUR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    group_size_limit: Optional[int] = Field(None, ge=1)
    current_bookings: int = Field(0, ge=0)
    trip_description: Optional[str] = None
    special_requirements: Optional[str] = None
    trip_status: str = Field("scheduled", pattern=r"^(scheduled|confirmed|cancelled|completed)$")
    dives: List[ParsedDiveCreate] = []

class ParsedDiveTripUpdate(BaseModel):
    diving_center_id: Optional[int] = None
    trip_date: Optional[date] = None
    trip_time: Optional[time] = None
    trip_duration: Optional[int] = Field(None, ge=1, le=1440)  # Duration in minutes
    trip_difficulty_code: DifficultyCode = Field(None, description="Difficulty code or null")
    trip_price: Optional[float] = Field(None, ge=0)
    trip_currency: Optional[str] = Field(None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    group_size_limit: Optional[int] = Field(None, ge=1)
    current_bookings: Optional[int] = Field(None, ge=0)
    trip_description: Optional[str] = None
    special_requirements: Optional[str] = None
    trip_status: Optional[str] = Field(None, pattern=r"^(scheduled|confirmed|cancelled|completed)$")
    dives: Optional[List[ParsedDiveCreate]] = None

class SystemHealthResponse(BaseModel):
    status: str
    database: dict
    resources: dict
    services: dict
    timestamp: str

class PlatformStatsResponse(BaseModel):
    users: dict
    content: dict
    media: dict
    trips: dict
    timestamp: str

# Notification Analytics Schemas
class InAppNotificationStats(BaseModel):
    total: int
    read: int
    unread: int
    read_rate: float
    by_category: Dict[str, Dict[str, int]]

class EmailDeliveryStats(BaseModel):
    total_sent: int
    sent_directly_to_ses: int
    queued_to_sqs: int
    delivery_rate: float
    avg_delivery_time_seconds: Optional[float] = None

class NotificationCategoryStats(BaseModel):
    category: str
    total_notifications: int
    in_app_sent: int
    email_sent: int
    email_delivery_rate: float

class NotificationTimeStats(BaseModel):
    last_24h: Dict[str, int]
    last_7d: Dict[str, int]
    last_30d: Dict[str, int]

class NotificationAnalyticsResponse(BaseModel):
    in_app: InAppNotificationStats
    email_delivery: EmailDeliveryStats
    by_category: List[NotificationCategoryStats]
    time_stats: NotificationTimeStats
    timestamp: str


class GrowthDataPoint(BaseModel):
    """Single data point in growth chart"""
    date: str
    count: int


class GrowthDataResponse(BaseModel):
    """Growth data for all entity types"""
    dive_sites: List[GrowthDataPoint]
    diving_centers: List[GrowthDataPoint]
    dives: List[GrowthDataPoint]
    dive_routes: List[GrowthDataPoint]
    dive_trips: List[GrowthDataPoint]


class GrowthRatesResponse(BaseModel):
    """Growth rates for all entity types"""
    dive_sites: float
    diving_centers: float
    dives: float
    dive_routes: float
    dive_trips: float


class GrowthResponse(BaseModel):
    """Response for growth data endpoint"""
    period: str
    growth_data: GrowthDataResponse
    growth_rates: GrowthRatesResponse
    start_date: str
    end_date: str


# Dive Route Schemas
class RouteType(str, enum.Enum):
    scuba = "scuba"
    walk = "walk"
    swim = "swim"


class DiveRouteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    route_data: dict = Field(..., description="Multi-segment GeoJSON FeatureCollection")
    route_type: RouteType

    @validator('route_data')
    def validate_route_data(cls, v):
        """Validate that route_data is valid multi-segment GeoJSON FeatureCollection"""
        if not isinstance(v, dict):
            raise ValueError('route_data must be a dictionary')
        
        # Check for required GeoJSON fields
        if 'type' not in v:
            raise ValueError('route_data must have a "type" field')
        
        if v['type'] != 'FeatureCollection':
            raise ValueError('route_data type must be "FeatureCollection" for multi-segment routes')
        
        if 'features' not in v:
            raise ValueError('FeatureCollection must have a "features" field')
        
        features = v['features']
        if not isinstance(features, list):
            raise ValueError('features must be a list')
        
        if len(features) == 0:
            raise ValueError('FeatureCollection must have at least one feature')
        
        # Validate each feature
        for i, feature in enumerate(features):
            if not isinstance(feature, dict):
                raise ValueError(f'Feature {i} must be a dictionary')
            
            if 'type' not in feature or feature['type'] != 'Feature':
                raise ValueError(f'Feature {i} must have type "Feature"')
            
            if 'geometry' not in feature:
                raise ValueError(f'Feature {i} must have a "geometry" field')
            
            geometry = feature['geometry']
            if not isinstance(geometry, dict):
                raise ValueError(f'Feature {i} geometry must be a dictionary')
            
            if 'type' not in geometry:
                raise ValueError(f'Feature {i} geometry must have a "type" field')
            
            if geometry['type'] not in ['LineString', 'Polygon', 'Point', 'MultiLineString', 'MultiPolygon']:
                raise ValueError(f'Feature {i} geometry type must be LineString, Polygon, Point, MultiLineString, or MultiPolygon')
            
            if 'coordinates' not in geometry:
                raise ValueError(f'Feature {i} geometry must have a "coordinates" field')
        
        # Validate coordinates are 2D (no depth data) - lenient for existing data
        def validate_coordinates_2d(coordinates):
            """Helper function to validate coordinates are 2D only"""
            if isinstance(coordinates, list) and len(coordinates) > 0:
                if isinstance(coordinates[0], list):
                    # Multi-dimensional coordinates
                    for coord in coordinates:
                        if isinstance(coord, list) and len(coord) > 0:
                            if isinstance(coord[0], (int, float)) and len(coord) > 2:
                                raise ValueError('coordinates must be 2D only (longitude, latitude) - no depth data allowed')
                            elif not isinstance(coord[0], (int, float)):
                                # Skip validation for existing data that might have different formats
                                pass
                        elif isinstance(coord, list) and len(coord) > 0 and isinstance(coord[0], list):
                            # Handle nested arrays (e.g., Polygon coordinates)
                            for nested_coord in coord:
                                if isinstance(nested_coord, list) and len(nested_coord) > 0:
                                    if isinstance(nested_coord[0], (int, float)) and len(nested_coord) > 2:
                                        raise ValueError('coordinates must be 2D only (longitude, latitude) - no depth data allowed')
                                    # Skip validation for existing data that might have different formats
                elif isinstance(coordinates[0], (int, float)) and len(coordinates) > 2:
                    # Single coordinate
                    raise ValueError('coordinates must be 2D only (longitude, latitude) - no depth data allowed')
                # Skip validation for existing data that might have different formats
            # Skip validation for existing data that might have different formats
        
        if v['type'] == 'Feature':
            validate_coordinates_2d(geometry['coordinates'])
        elif v['type'] == 'FeatureCollection':
            for feature in features:
                validate_coordinates_2d(feature['geometry']['coordinates'])
        
        return v


class DiveRouteCreate(DiveRouteBase):
    dive_site_id: int = Field(..., description="ID of the dive site this route belongs to")


class DiveRouteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    route_data: Optional[dict] = None
    route_type: Optional[RouteType] = None

    @validator('route_data')
    def validate_route_data(cls, v):
        """Validate that route_data is valid multi-segment GeoJSON FeatureCollection if provided"""
        if v is not None:
            # Reuse the same validation logic as DiveRouteBase
            return DiveRouteBase.validate_route_data(v)
        return v


class DiveRouteResponse(DiveRouteBase):
    id: int
    dive_site_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None

    class Config:
        from_attributes = True


class DiveRouteWithDetails(DiveRouteResponse):
    """Extended response with related data"""
    dive_site: Optional[dict] = None  # Basic dive site info
    creator: Optional[dict] = None    # Basic creator info


class DiveRouteWithCreator(DiveRouteResponse):
    """Response with creator information"""
    creator: Optional[dict] = None    # Creator information


class DiveRouteListResponse(BaseModel):
    """Response for paginated route lists"""
    routes: List[DiveRouteResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class RouteDeletionCheck(BaseModel):
    """Response for route deletion permission check"""
    can_delete: bool
    reason: str
    dives_using_route: int = 0
    requires_migration: bool = False


# Notification Schemas
class NotificationResponse(BaseModel):
    """Notification response model"""
    id: int
    user_id: int
    category: str
    title: str
    message: str
    link_url: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    email_sent: bool
    email_sent_at: Optional[datetime] = None
    created_at: datetime

    @validator('created_at', 'read_at', 'email_sent_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        """Normalize datetime fields to UTC timezone-aware datetimes."""
        if v is None:
            return v
        if isinstance(v, datetime):
            # If naive datetime, assume it's UTC (from database with timezone=True)
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            # If timezone-aware, convert to UTC
            elif v.tzinfo != timezone.utc:
                return v.astimezone(timezone.utc)
            return v
        return v

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if isinstance(v, datetime) else v
        }


class NotificationPreferenceResponse(BaseModel):
    """Notification preference response model"""
    id: int
    user_id: int
    category: str
    enable_website: bool
    enable_email: bool
    frequency: str
    area_filter: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    @validator('created_at', 'updated_at', pre=True)
    def normalize_datetime_to_utc(cls, v):
        return normalize_datetime_to_utc(cls, v)

    class Config:
        from_attributes = True


class NotificationPreferenceCreate(BaseModel):
    """Create notification preference"""
    category: str = Field(..., description="Category: new_dive_sites, new_dives, new_diving_centers, new_dive_trips, admin_alerts")
    enable_website: bool = True
    enable_email: bool = False
    frequency: str = Field("immediate", description="Frequency: immediate, daily_digest, weekly_digest")
    area_filter: Optional[dict] = None


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preference"""
    enable_website: Optional[bool] = None
    enable_email: Optional[bool] = None
    frequency: Optional[str] = None
    area_filter: Optional[dict] = None


class EmailConfigResponse(BaseModel):
    """Email configuration response model"""
    id: int
    smtp_host: str
    smtp_port: int
    use_starttls: bool
    from_email: str
    from_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmailConfigCreate(BaseModel):
    """Create email configuration"""
    smtp_host: str
    smtp_port: int = 587
    use_starttls: bool = True
    smtp_username: str
    smtp_password: str
    from_email: str
    from_name: str = "Divemap"


class EmailConfigUpdate(BaseModel):
    """Update email configuration"""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    use_starttls: Optional[bool] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    is_active: Optional[bool] = None


class RouteDeletionRequest(BaseModel):
    """Request to delete a route"""
    route_id: int
    migrate_dives_to_route_id: Optional[int] = None  # If dives need to be migrated

# Settings Schemas
class SettingResponse(BaseModel):
    """Response schema for a setting"""
    key: str
    value: Union[str, int, float, bool, dict, list]  # JSON value (parsed)
    description: Optional[str] = None

    class Config:
        from_attributes = True

class SettingUpdate(BaseModel):
    """Schema for updating a setting value"""
    value: Union[str, int, float, bool, dict, list]  # JSON-serializable value

# Global Search Schemas
class GlobalSearchResult(BaseModel):
    """Individual search result item"""
    entity_type: str = Field(..., description="Entity type: dive_site, diving_center, dive, dive_route, dive_trip")
    id: int
    name: str
    route_path: str = Field(..., description="Frontend route path for navigation")
    icon_name: str = Field(..., description="Icon name for frontend rendering")
    metadata: Optional[dict] = Field(None, description="Additional metadata (location, date, etc.)")

    class Config:
        from_attributes = True

class EntityTypeSearchResults(BaseModel):
    """Results for a specific entity type"""
    entity_type: str
    icon_name: str
    count: int
    results: List[GlobalSearchResult]

class GlobalSearchResponse(BaseModel):
    """Response for global search endpoint"""
    query: str
    results: List[EntityTypeSearchResults]
    total_count: int

    class Config:
        from_attributes = True


# API Key Schemas
class ApiKeyResponse(BaseModel):
    """API key response model (key value only shown on creation)"""
    id: int
    name: str
    description: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_by_username: Optional[str] = None
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApiKeyCreate(BaseModel):
    """Create API key request"""
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name for the API key")
    description: Optional[str] = Field(None, description="Optional description")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date (ISO format)")


class ApiKeyCreateResponse(BaseModel):
    """Response when creating a new API key (includes the actual key value)"""
    id: int
    name: str
    api_key: str = Field(..., description="The actual API key value (only shown once!)")
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    warning: str = Field(default="Store this API key securely. It will not be shown again.")


class ApiKeyUpdate(BaseModel):
    """Update API key request"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class DeleteR2PhotoRequest(BaseModel):
    r2_path: str