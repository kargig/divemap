from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Union
from datetime import datetime, date, time
import re
import enum

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    number_of_dives: Optional[int] = Field(None, ge=0)

class UserResponse(UserBase):
    id: int
    name: Optional[str] = None
    enabled: bool
    is_admin: bool
    is_moderator: bool
    number_of_dives: int = 0
    created_at: datetime
    updated_at: datetime

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
    access_token: str
    token_type: str
    expires_in: int
    message: str

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
    created_at: datetime

    class Config:
        from_attributes = True

# Dive Site Schemas
class DiveSiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    access_instructions: Optional[str] = None
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None  # Safety information
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: Optional[str] = None  # Country name
    region: Optional[str] = None  # Region/state/province name

class DiveSiteCreate(DiveSiteBase):
    pass

class DiveSiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    access_instructions: Optional[str] = None
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None  # Safety information
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: Optional[str] = None  # Country name
    region: Optional[str] = None  # Region/state/province name

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

    class Config:
        from_attributes = True

class DiveSiteResponse(DiveSiteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    average_rating: Optional[float] = None
    total_ratings: int = 0
    view_count: Optional[int] = None  # Only included for admin users
    tags: List[dict] = []
    user_rating: Optional[float] = None
    distance_km: Optional[float] = None
    aliases: List[DiveSiteAliasResponse] = []  # List of aliases for this dive site

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

    class Config:
        from_attributes = True

# Media Schemas
class SiteMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None

class SiteMediaResponse(BaseModel):
    id: int
    dive_site_id: int
    media_type: str
    url: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Search Parameters
class DiveSiteSearchParams(BaseModel):
    name: Optional[str] = None
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
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
    certification_level: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True

class UserCertificationCreate(UserCertificationBase):
    pass

class UserCertificationUpdate(BaseModel):
    diving_organization_id: Optional[int] = None
    certification_level: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None

class UserCertificationResponse(UserCertificationBase):
    id: int
    user_id: int
    diving_organization: DivingOrganizationResponse
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
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
    visibility_rating: Optional[int] = Field(None, ge=1, le=10)
    user_rating: Optional[int] = Field(None, ge=1, le=10)
    dive_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD format
    dive_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")  # HH:MM:SS format
    duration: Optional[int] = Field(None, ge=1, le=1440)  # Duration in minutes

class DiveCreate(DiveBase):
    pass

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
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
    visibility_rating: Optional[int] = Field(None, ge=1, le=10)
    user_rating: Optional[int] = Field(None, ge=1, le=10)
    dive_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    dive_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")
    duration: Optional[int] = Field(None, ge=1, le=1440)
    tags: Optional[List[int]] = None  # List of tag IDs

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
    user_username: Optional[str] = None  # For public dives

    class Config:
        from_attributes = True

class DiveMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video|dive_plan|external_link)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    title: Optional[str] = Field(None, max_length=255)  # For external links
    thumbnail_url: Optional[str] = Field(None, max_length=500)  # For external links

class DiveMediaResponse(BaseModel):
    id: int
    dive_id: int
    media_type: str
    url: str
    description: Optional[str] = None
    title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime

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
    difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
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

    class Config:
        from_attributes = True

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
    trip_id: int
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
    trip_difficulty_level: Optional[str] = None  # Human-readable difficulty level (beginner, intermediate, advanced, expert)
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
    trip_difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
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
    trip_difficulty_level: Optional[int] = Field(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert")
    trip_price: Optional[float] = Field(None, ge=0)
    trip_currency: Optional[str] = Field(None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    group_size_limit: Optional[int] = Field(None, ge=1)
    current_bookings: Optional[int] = Field(None, ge=0)
    trip_description: Optional[str] = None
    special_requirements: Optional[str] = None
    trip_status: Optional[str] = Field(None, pattern=r"^(scheduled|confirmed|cancelled|completed)$")
    dives: Optional[List[ParsedDiveCreate]] = None

# System Overview Schemas
class UserStats(BaseModel):
    total: int
    active_30d: int
    new_7d: int
    new_30d: int
    growth_rate: float

class ContentStats(BaseModel):
    dive_sites: int
    diving_centers: int
    dives: int
    comments: int
    ratings: int
    media_uploads: int

class EngagementStats(BaseModel):
    avg_site_rating: float
    avg_center_rating: float
    recent_comments_24h: int
    recent_ratings_24h: int
    recent_dives_24h: int

class GeographicStats(BaseModel):
    dive_sites_by_country: List[dict]

class SystemUsageStats(BaseModel):
    api_calls_today: int
    peak_usage_time: str
    most_accessed_endpoint: str

class PlatformStats(BaseModel):
    users: UserStats
    content: ContentStats
    engagement: EngagementStats
    geographic: GeographicStats
    system_usage: SystemUsageStats

class DatabaseHealth(BaseModel):
    status: str
    response_time: str

class ApplicationHealth(BaseModel):
    status: str
    uptime: str
    response_time: str

class ResourceHealth(BaseModel):
    cpu_usage: float
    memory_usage: float
    disk_usage: float

class ExternalServicesHealth(BaseModel):
    google_oauth: str
    geocoding_service: str

class SecurityHealth(BaseModel):
    failed_logins_24h: int
    suspicious_activity: str

class SystemHealth(BaseModel):
    database: DatabaseHealth
    application: ApplicationHealth
    resources: ResourceHealth
    external_services: ExternalServicesHealth
    security: SecurityHealth

class Alerts(BaseModel):
    critical: List[str]
    warnings: List[str]
    info: List[str]

class SystemOverviewResponse(BaseModel):
    platform_stats: PlatformStats
    system_health: SystemHealth
    alerts: Alerts
    last_updated: str

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


class RouteDeletionRequest(BaseModel):
    """Request to delete a route"""
    route_id: int
    migrate_dives_to_route_id: Optional[int] = None  # If dives need to be migrated