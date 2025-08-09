from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Union
from datetime import datetime, date, time
import re

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    number_of_dives: Optional[int] = Field(None, ge=0)

class UserResponse(UserBase):
    id: int
    enabled: bool
    is_admin: bool
    is_moderator: bool
    number_of_dives: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str

class RegistrationResponse(BaseModel):
    access_token: str
    token_type: str
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
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
    min_rating: Optional[float] = Field(None, ge=0, le=10)
    max_rating: Optional[float] = Field(None, ge=0, le=10)
    tag_ids: Optional[List[int]] = None
    country: Optional[str] = None
    region: Optional[str] = None
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

# Diving Center Schemas
class DivingCenterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class DivingCenterCreate(DivingCenterBase):
    pass

class DivingCenterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

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
    min_rating: Optional[float] = Field(None, ge=0, le=10)
    max_rating: Optional[float] = Field(None, ge=0, le=10)
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
    name: Optional[str] = Field(None, max_length=255)  # Custom name/alias
    is_private: bool = False  # Privacy control - default public
    dive_information: Optional[str] = None
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    average_depth: Optional[float] = Field(None, ge=0, le=1000)  # Average depth in meters
    gas_bottles_used: Optional[str] = None
    suit_type: Optional[str] = Field(None, pattern=r"^(wet_suit|dry_suit|shortie)$")
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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
    name: Optional[str] = Field(None, max_length=255)
    is_private: Optional[bool] = None
    dive_information: Optional[str] = None
    max_depth: Optional[float] = Field(None, ge=0, le=1000)
    average_depth: Optional[float] = Field(None, ge=0, le=1000)
    gas_bottles_used: Optional[str] = None
    suit_type: Optional[str] = Field(None, pattern=r"^(wet_suit|dry_suit|shortie)$")
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
    visibility_rating: Optional[int] = Field(None, ge=1, le=10)
    user_rating: Optional[int] = Field(None, ge=1, le=10)
    dive_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    dive_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")
    duration: Optional[int] = Field(None, ge=1, le=1440)

class DiveResponse(DiveBase):
    id: int
    user_id: int
    dive_site_id: Optional[int] = None
    diving_center_id: Optional[int] = None  # Link to diving center
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
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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
    trip_difficulty_level: Optional[str] = None
    trip_price: Optional[float] = None
    trip_currency: str = "EUR"
    group_size_limit: Optional[int] = None
    current_bookings: int = 0
    trip_description: Optional[str] = None
    special_requirements: Optional[str] = None
    trip_status: str = "scheduled"
    diving_center_name: Optional[str] = None
    dives: List[ParsedDiveResponse] = []  # List of dives in this trip
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
    trip_difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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
    trip_difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
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