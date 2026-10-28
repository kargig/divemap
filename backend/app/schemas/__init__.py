import enum
import re
from datetime import UTC, date, datetime, time, timezone
from typing import Any, Literal

import nh3
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationInfo,
    field_validator,
)

# Import auth schemas
from .auth import (
    AuthConfigResponse,
    FacebookProviderConfig,
    GoogleProviderConfig,
    PasswordResetConfirm,
    PasswordResetRequest,
)
from .diving_centers import CenterMediaResponse
from .pats import PATCreate, PATCreateResponse, PATResponse

# Valid difficulty codes
DifficultyCode = (
    Literal["OPEN_WATER", "ADVANCED_OPEN_WATER", "DEEP_NITROX", "TECHNICAL_DIVING"]
    | None
)


def strip_html(v: str | None) -> str | None:
    """
    Strips ALL HTML tags from a string using nh3.
    Since we only support Markdown on the frontend, we don't want any raw HTML
    stored in our database to prevent XSS.
    """
    if v is None:
        return v
    # nh3.clean with tags=set() removes all HTML tags but keeps the text inside
    return nh3.clean(v, tags=set())


def normalize_datetime_to_utc(cls, v, info: ValidationInfo = None):
    """
    Pydantic validator to normalize datetime fields to UTC timezone-aware datetimes.
    Can be used as a validator for any datetime field in any schema.
    """
    if v is None:
        return v
    if isinstance(v, datetime):
        # If naive datetime, assume it's UTC (from database with timezone=True)
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        # If timezone-aware, convert to UTC
        elif v.tzinfo != UTC:
            return v.astimezone(UTC)
        return v
    return v


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr | str


class UserCreate(UserBase):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    turnstile_token: str | None = Field(None, description="Cloudflare Turnstile token")


class UserUpdate(BaseModel):
    username: str | None = Field(
        None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$"
    )
    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = Field(
        None,
        description="Real email (allowed when upgrading from a synthetic social email)",
    )
    password: str | None = Field(None, min_length=8, max_length=128)
    number_of_dives: int | None = Field(None, ge=0)
    buddy_visibility: str | None = Field(
        None,
        pattern=r"^(public|private)$",
        description="Control whether user can be added as buddy: 'public' or 'private'",
    )


class AvatarType(str, enum.Enum):
    google = "google"
    facebook = "facebook"
    custom = "custom"
    library = "library"


class AvatarUpdate(BaseModel):
    avatar_url: str
    avatar_type: AvatarType


class UserSocialLinkBase(BaseModel):
    platform: str
    url: str


ALLOWED_SOCIAL_PLATFORMS = [
    "instagram",
    "tiktok",
    "facebook",
    "x",
    "linkedin",
    "youtube",
    "whatsapp",
    "telegram",
    "bluesky",
    "mastodon",
    "discord",
    "threads",
    "signal",
]

SOCIAL_PLATFORM_DOMAINS = {
    "instagram": ["instagram.com"],
    "tiktok": ["tiktok.com"],
    "facebook": ["facebook.com", "fb.com"],
    "x": ["twitter.com", "x.com"],
    "linkedin": ["linkedin.com"],
    "youtube": ["youtube.com", "youtu.be"],
    "whatsapp": ["wa.me", "whatsapp.com"],
    "telegram": ["t.me", "telegram.me"],
    "bluesky": ["bsky.app"],
    "mastodon": [],  # Decentralized
    "discord": ["discord.com", "discord.gg"],
    "threads": ["threads.net"],
    "signal": ["signal.me", "signal.group"],
}


class UserSocialLinkCreate(UserSocialLinkBase):
    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str, info: ValidationInfo):
        if v.lower() not in ALLOWED_SOCIAL_PLATFORMS:
            raise ValueError(
                f"Platform must be one of: {', '.join(ALLOWED_SOCIAL_PLATFORMS)}"
            )
        return v.lower()

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str, info: ValidationInfo):
        platform = info.data.get("platform")
        if not platform:
            return v

        v = v.strip()
        if not v.startswith("https://"):
            raise ValueError("URL must start with https://")

        # No phone numbers allowed check
        # Search for any sequence of 7 or more digits, or digits with common phone separators
        # that could represent a phone number.
        if re.search(r"\d{7,}", v) or re.search(r"(?:\d[\s\-\(\)]*){8,}", v):
            raise ValueError(
                "URL cannot contain phone numbers or long sequences of digits"
            )

        allowed_domains = SOCIAL_PLATFORM_DOMAINS.get(platform, [])
        if allowed_domains:
            # Check if URL host matches allowed domains
            # Simple check: domain must be present in the URL
            if not any(d in v for d in allowed_domains):
                raise ValueError(
                    f"Invalid domain for {platform}. Expected one of: {', '.join(allowed_domains)}"
                )

        return v


class UserSocialLinkResponse(UserSocialLinkBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class UserResponse(UserBase):
    id: int
    name: str | None = None
    enabled: bool
    email_verified: bool = False
    is_admin: bool
    is_moderator: bool
    number_of_dives: int = 0
    avatar_url: str | None = None
    avatar_type: AvatarType | None = AvatarType.google
    avatar_full_url: str | None = None
    google_avatar_url: str | None = None
    facebook_avatar_url: str | None = None
    google_id: str | None = None
    facebook_id: str | None = None
    buddy_visibility: str = "public"
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    social_links: list[UserSocialLinkResponse] = []

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str = Field(
        ..., min_length=1, max_length=255, description="Username or email address"
    )
    password: str = Field(..., min_length=1, max_length=128)
    turnstile_token: str | None = Field(None, description="Cloudflare Turnstile token")


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse | None = None


class RegistrationResponse(BaseModel):
    access_token: str | None
    token_type: str
    expires_in: int
    message: str


class ResendVerificationRequest(BaseModel):
    """Request to resend email verification."""

    email: EmailStr = Field(..., description="Email address to resend verification")


class TokenData(BaseModel):
    username: str | None = None


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
    email_verified: bool = True


class UserUpdateAdmin(BaseModel):
    username: str | None = Field(
        None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$"
    )
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=8, max_length=128)
    is_admin: bool | None = None
    is_moderator: bool | None = None
    enabled: bool | None = None
    email_verified: bool | None = None


class UserListResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_moderator: bool
    enabled: bool
    email_verified: bool
    email_verified_at: datetime | None = None
    created_at: datetime
    last_accessed_at: datetime | None = None
    deleted_at: datetime | None = None

    @field_validator(
        "created_at", "email_verified_at", "last_accessed_at", mode="before"
    )
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


# Dive Site Schemas
class DiveSiteBase(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    access_instructions: str | None = None
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    marine_life: str | None = None
    safety_information: str | None = None  # Safety information
    max_depth: float | None = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: str | None = None  # Country name
    region: str | None = None  # Region/state/province name
    shore_direction: float | None = Field(
        None,
        ge=0,
        le=360,
        description="Compass bearing (0-360 degrees) indicating which direction the shore/beach faces",
    )

    @field_validator(
        "description",
        "access_instructions",
        "marine_life",
        "safety_information",
        mode="before",
    )
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class DiveSiteCreate(DiveSiteBase):
    moderation_needed: bool = Field(
        False, description="Bypass proximity check and submit for moderation"
    )


class DiveSiteUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    access_instructions: str | None = None
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    marine_life: str | None = None
    safety_information: str | None = None  # Safety information
    max_depth: float | None = Field(None, ge=0, le=1000)  # Maximum depth in meters
    country: str | None = None  # Country name
    region: str | None = None  # Region/state/province name
    shore_direction: float | None = Field(
        None,
        ge=0,
        le=360,
        description="Compass bearing (0-360 degrees) indicating which direction the shore/beach faces",
    )
    shore_direction_confidence: str | None = Field(
        None, description="Confidence level: 'high', 'medium', 'low'"
    )
    shore_direction_method: str | None = Field(
        None, description="Method used: 'osm_coastline', 'manual', 'ai', etc."
    )
    shore_direction_distance_m: float | None = Field(
        None, ge=0, description="Distance to coastline in meters"
    )

    @field_validator(
        "description",
        "access_instructions",
        "marine_life",
        "safety_information",
        mode="before",
    )
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


# Dive Site Alias Schemas
class DiveSiteAliasBase(BaseModel):
    alias: str = Field(..., min_length=1, max_length=255)


class DiveSiteAliasCreate(DiveSiteAliasBase):
    pass


class DiveSiteAliasUpdate(BaseModel):
    alias: str | None = Field(None, min_length=1, max_length=255)


class DiveSiteAliasResponse(DiveSiteAliasBase):
    id: int
    dive_site_id: int
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class DiveSiteResponse(DiveSiteBase):
    id: int
    created_at: datetime | None = None
    deleted_at: datetime | None = None
    created_by: int | None = None
    created_by_username: str | None = None
    status: str = "approved"
    updated_at: datetime | None = None
    average_rating: float | None = None
    total_ratings: int = 0
    comment_count: int = 0
    route_count: int = 0
    view_count: int | None = None  # Only included for admin users
    tags: list[dict] = []
    user_rating: float | None = None
    distance_km: float | None = None
    aliases: list[DiveSiteAliasResponse] = []  # List of aliases for this dive site
    difficulty_label: str | None = None  # Human-readable difficulty label
    shore_direction: float | None = (
        None  # Compass bearing (0-360 degrees) indicating which direction the shore/beach faces
    )
    shore_direction_confidence: str | None = (
        None  # Confidence level: 'high', 'medium', 'low'
    )
    shore_direction_method: str | None = (
        None  # Method used: 'osm_coastline', 'manual', 'ai', etc.
    )
    shore_direction_distance_m: float | None = None  # Distance to coastline in meters
    thumbnail: str | None = None  # Thumbnail URL for the dive site
    thumbnail_type: str | None = None  # 'video' or 'photo'
    thumbnail_source: str | None = None  # 'site_media' or 'dive_media'
    thumbnail_id: int | None = None  # ID of the media item

    @field_validator("tags", mode="before")
    @classmethod
    def format_tags(cls, v):
        if isinstance(v, list):
            formatted = []
            for item in v:
                if isinstance(item, dict):
                    formatted.append(item)
                elif hasattr(item, "tag") and item.tag:
                    formatted.append(
                        {
                            "id": item.tag.id,
                            "name": item.tag.name,
                            "category": getattr(item.tag, "category", None),
                            "created_at": getattr(item.tag, "created_at", None),
                        }
                    )
                elif hasattr(item, "id") and hasattr(item, "name"):
                    formatted.append(
                        {
                            "id": item.id,
                            "name": item.name,
                            "category": getattr(item, "category", None),
                            "created_at": getattr(item, "created_at", None),
                        }
                    )
            return formatted
        return v

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class DiveSiteListResponse(BaseModel):
    items: list[DiveSiteResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool


class DiveSiteRegionOption(BaseModel):
    """Unique region with its country (for geo-hub URL resolution)."""

    region: str
    country: str | None = None


# Site Rating Schemas
class SiteRatingCreate(BaseModel):
    score: float = Field(..., ge=1, le=5)


class SiteRatingResponse(BaseModel):
    id: int
    dive_site_id: int
    user_id: int
    score: float
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


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
    user_diving_certification: str | None = None
    user_number_of_dives: int | None = None

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


# Media Schemas
class SiteMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    thumbnail_url: str | None = Field(None, max_length=500)
    medium_url: str | None = Field(None, max_length=500)


class SiteMediaUpdate(BaseModel):
    description: str | None = None


class SiteMediaResponse(BaseModel):
    id: int
    dive_site_id: int
    media_type: str
    url: str
    description: str | None = None
    created_at: datetime
    # Optional fields for dive media (when media comes from a dive)
    dive_id: int | None = None
    user_id: int | None = None
    user_username: str | None = None
    thumbnail_url: str | None = None
    medium_url: str | None = None
    download_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DiveSiteMediaOrderRequest(BaseModel):
    order: list[str] = Field(
        ...,
        description="Ordered list of media identifiers (e.g., ['site_1', 'dive_5'])",
    )


# Search Parameters
class DiveSiteSearchParams(BaseModel):
    name: str | None = None
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING; omit for no filter",
    )
    exclude_unspecified_difficulty: bool = False
    min_rating: float | None = Field(
        None, ge=0, le=10, description="Minimum average rating (0-10)"
    )
    tag_ids: list[int] | None = None
    country: str | None = None
    region: str | None = None
    sort_by: str | None = Field(
        None,
        description="Sort field (name, country, region, difficulty_level, view_count, comment_count, created_at, updated_at)",
    )
    sort_order: str | None = Field("asc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)


# Diving Center Schemas
class DivingCenterBase(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    # Make description optional at the base level so responses don't fail when empty
    description: str | None = None
    address: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None
    logo_url: str | None = None
    # Allow None in responses for legacy rows; enforce on create
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    country: str | None = Field(None, max_length=100)
    region: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)

    @field_validator("description", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class DivingCenterCreate(DivingCenterBase):
    # Enforce description requirement on create to maintain data quality
    description: str = Field(..., min_length=1)
    # Enforce coordinates on create
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class DivingCenterUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    address: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    country: str | None = Field(None, max_length=100)
    region: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)

    @field_validator("description", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class DivingCenterResponse(DivingCenterBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    average_rating: float | None = None
    total_ratings: int = 0
    comment_count: int = 0
    view_count: int | None = None  # Only included for admin users
    user_rating: float | None = None
    ownership_status: str | None = None
    owner_username: str | None = None
    is_manager: bool = False
    follower_count: int = 0
    media: list[CenterMediaResponse] = []
    logo_full_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DivingCenterListResponse(BaseModel):
    items: list[DivingCenterResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool
    match_types: dict[str, Any] | None = None


# Center Rating Schemas
class CenterRatingCreate(BaseModel):
    score: float = Field(..., ge=1, le=5)


class CenterRatingResponse(BaseModel):
    id: int
    diving_center_id: int
    user_id: int
    score: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    user_diving_certification: str | None = None
    user_number_of_dives: int | None = None

    model_config = ConfigDict(from_attributes=True)


# Center Search Parameters
class DivingCenterSearchParams(BaseModel):
    name: str | None = None
    search: str | None = (
        None  # Unified search across name, description, country, region, city
    )
    country: str | None = None  # Filter by country
    region: str | None = None  # Filter by region
    city: str | None = None  # Filter by city
    min_rating: float | None = Field(None, ge=0, le=10)
    max_rating: float | None = Field(None, ge=0, le=10)
    sort_by: str | None = Field(
        None,
        description="Sort field (name, view_count, comment_count, created_at, updated_at, country, region, city)",
    )
    sort_order: str | None = Field("asc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)


# Tag Schemas
class AvailableTagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    category: str | None = None


class AvailableTagCreate(AvailableTagBase):
    pass


class AvailableTagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = None
    category: str | None = None


class AvailableTagResponse(AvailableTagBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Tag schemas with expected names for router compatibility
class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = None


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TagWithCountResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_by: int | None = None
    created_at: datetime
    dive_site_count: int
    dive_count: int

    model_config = ConfigDict(from_attributes=True)


class DiveSiteTagCreate(BaseModel):
    tag_id: int


class DiveSiteTagResponse(BaseModel):
    id: int
    dive_site_id: int
    tag_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Center-Dive Site Association
class CenterDiveSiteCreate(BaseModel):
    diving_center_id: int
    dive_cost: float | None = Field(None, ge=0)
    currency: str = Field("EUR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")


class CenterDiveSiteResponse(BaseModel):
    id: int
    dive_site_id: int
    diving_center_id: int
    dive_cost: float | None = None
    currency: str = "EUR"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Certification Level Schemas
class CertificationLevelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str | None = None
    max_depth: str | None = None
    gases: str | None = None
    tanks: str | None = None
    deco_time_limit: str | None = None
    prerequisites: str | None = None


class CertificationLevelCreate(CertificationLevelBase):
    diving_organization_id: int


class CertificationLevelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = None
    max_depth: str | None = None
    gases: str | None = None
    tanks: str | None = None
    deco_time_limit: str | None = None
    prerequisites: str | None = None


class CertificationLevelResponse(CertificationLevelBase):
    id: int
    diving_organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


# Diving Organization Schemas
class DivingOrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    acronym: str = Field(..., min_length=1, max_length=20)
    website: str | None = None
    logo_url: str | None = None
    description: str | None = None
    country: str | None = Field(None, max_length=100)
    founded_year: int | None = Field(None, ge=1800, le=2100)


class DivingOrganizationCreate(DivingOrganizationBase):
    pass


class DivingOrganizationUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    acronym: str | None = Field(None, min_length=1, max_length=20)
    website: str | None = None
    logo_url: str | None = None
    description: str | None = None
    country: str | None = Field(None, max_length=100)
    founded_year: int | None = Field(None, ge=1800, le=2100)


class DivingOrganizationSummaryResponse(DivingOrganizationBase):
    id: int
    view_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DivingOrganizationResponse(DivingOrganizationBase):
    id: int
    view_count: int = 0
    created_at: datetime
    updated_at: datetime
    certification_levels: list[CertificationLevelResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Diving Center Organization Schemas
class DivingCenterOrganizationBase(BaseModel):
    diving_organization_id: int
    is_primary: bool = False


class DivingCenterOrganizationCreate(DivingCenterOrganizationBase):
    pass


class DivingCenterOrganizationUpdate(BaseModel):
    is_primary: bool | None = None


class DivingCenterOrganizationResponse(DivingCenterOrganizationBase):
    id: int
    diving_center_id: int
    diving_organization: DivingOrganizationSummaryResponse
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# User Certification Schemas
class UserCertificationBase(BaseModel):
    diving_organization_id: int
    certification_level: str | None = Field(
        None, max_length=100
    )  # Optional now, prefer ID
    certification_level_id: int | None = None
    is_active: bool = True


class UserCertificationCreate(UserCertificationBase):
    card_id: str | None = Field(
        None, max_length=100, description="Diver card ID or certification number"
    )
    certification_date: date | None = Field(
        None, description="Date the certification was issued"
    )

    @field_validator("card_id", "certification_date", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if v == "":
            return None
        return v


class UserCertificationUpdate(BaseModel):
    diving_organization_id: int | None = None
    certification_level: str | None = Field(None, max_length=100)
    certification_level_id: int | None = None
    card_id: str | None = Field(
        None, max_length=100, description="Diver card ID or certification number"
    )
    certification_date: date | None = Field(
        None, description="Date the certification was issued"
    )
    is_active: bool | None = None

    @field_validator("card_id", "certification_date", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if v == "":
            return None
        return v


class UserCertificationPublicResponse(UserCertificationBase):
    """Public certification view — omits card_id and issue date."""

    id: int
    user_id: int
    diving_organization: DivingOrganizationSummaryResponse
    certification_level_link: CertificationLevelResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCertificationResponse(UserCertificationPublicResponse):
    """Owner/private certification view — includes card_id and issue date."""

    card_id: str | None = None
    certification_date: date | None = None


# Updated User Response to include certifications
class UserResponseWithCertifications(UserResponse):
    certifications: list[UserCertificationResponse] = []

    model_config = ConfigDict(from_attributes=True)


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
    unique_dive_sites_logged: int = 0
    countries_visited_count: int = 0
    total_points: int | None = 0
    leaderboard_rank: int | None = None

    model_config = ConfigDict(from_attributes=True)


class CertificationStats(BaseModel):
    max_depth: float | None = None  # Converted to meters
    max_depth_str: str | None = None  # Original string (e.g. "100m")
    best_gases: list[str] = []
    largest_tanks: list[str] = []
    max_deco_time: str | None = None
    max_nitrox_pct: int | None = None
    max_trimix_pct: str | None = None  # e.g. "10/50" or just "Hypoxic"
    max_stages: int | None = None


class FavoriteDiveSite(BaseModel):
    id: int
    name: str
    visit_count: int


class DivingStatsResponse(BaseModel):
    max_depth: float | None = None
    longest_dive_minutes: int | None = None
    total_bottom_time_minutes: int | None = None
    most_active_month: str | None = None  # e.g. "August 2024 (15 dives)"
    favorite_sites: list[FavoriteDiveSite] = []
    activity_heatmap: dict[str, int] = {}  # Date (YYYY-MM-DD) -> Dive Count
    suit_preferences: dict[str, int] = {}  # SuitType -> Count
    gear_preferences: dict[str, int] = {}


class AdvancedAnalyticsResponse(BaseModel):
    depth_density_heatmap: list[dict[str, Any]] = []
    sac_vs_depth: list[dict[str, Any]] = []
    duration_vs_depth: list[dict[str, Any]] = []
    temp_vs_suit: list[dict[str, Any]] = []
    dives_per_year: list[dict[str, Any]] = []
    sac_over_time: list[dict[str, Any]] = []
    depth_over_time: list[dict[str, Any]] = []
    dives_per_gas_config: list[
        dict[str, Any]
    ] = []  # [{"config": "Single 12L", "count": 10}]
    weight_vs_gear: list[
        dict[str, Any]
    ] = []  # [{"gear": "Wetsuit + Single 12L", "weight": 4.5}]
    weight_over_time: list[
        dict[str, Any]
    ] = []  # [{"date": "2024-05", "weight": 5.0, "gear": "Wetsuit + Single 12L"}]
    dive_style_radar: list[
        dict[str, Any]
    ] = []  # [{"subject": "Reef & Eco", "value": 15, "fullMark": 100}]
    boat_dive_pct: float | None = 0.0
    shore_dive_pct: float | None = 0.0
    gas_mix_heatmap: list[
        dict[str, Any]
    ] = []  # [{"mix": "Nitrox 32", "depth_bin": "18-30m", "count": 14}]
    country_distribution: list[
        dict[str, Any]
    ] = []  # [{"country": "Greece", "count": 42}]


class UserPublicProfileResponse(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    avatar_type: AvatarType | None = AvatarType.google
    avatar_full_url: str | None = None
    google_avatar_url: str | None = None
    is_admin: bool = False
    is_moderator: bool = False
    number_of_dives: int
    member_since: datetime
    deleted_at: datetime | None = None
    certifications: list[UserCertificationPublicResponse] = []
    social_links: list[UserSocialLinkResponse] = []
    stats: UserProfileStats
    certification_stats: CertificationStats | None = None
    diving_stats: DivingStatsResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class VisitedDiveSiteResponse(BaseModel):
    dive_site: DiveSiteResponse
    visit_count: int

    model_config = ConfigDict(from_attributes=True)


# User Curated Lists Schemas
class DiveSiteListItemResponse(BaseModel):
    id: int
    list_id: int
    dive_site_id: int
    notes: str | None = None
    display_order: int
    dive_site: DiveSiteResponse
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CollaboratorResponse(BaseModel):
    id: int
    user_id: int
    username: str
    role: str
    show_on_profile: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AddCollaboratorRequest(BaseModel):
    username: str = Field(..., description="Username of the buddy to add")


class UpdateCollaboratorPreference(BaseModel):
    show_on_profile: bool


class UserDiveSiteListResponse(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    slug: str
    description: str | None = None
    is_public: bool
    show_on_profile: bool
    system_type: str | None = None
    view_count: int
    created_at: datetime
    updated_at: datetime
    items: list[DiveSiteListItemResponse] = []
    collaborators: list[CollaboratorResponse] = []
    is_collaborator: bool = False
    role: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserDiveSiteListCreate(BaseModel):
    title: str = Field(..., max_length=100)
    description: str | None = None
    is_public: bool = True
    show_on_profile: bool = True


class UserDiveSiteListUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_public: bool | None = None
    show_on_profile: bool | None = None


class DiveSiteListItemCreate(BaseModel):
    dive_site_id: int
    notes: str | None = None


class DiveSiteListItemUpdate(BaseModel):
    notes: str | None = None
    display_order: int | None = None


class UserDiveSiteListReorder(BaseModel):
    item_ids: list[int]


class UserDiveSiteListMembershipResponse(BaseModel):
    list_id: int
    title: str
    system_type: str | None = None
    is_in_list: bool
    item_id: int | None = None


# User Public Info for buddy lists
class UserPublicInfo(BaseModel):
    id: int
    username: str
    name: str | None = None
    avatar_url: str | None = None
    avatar_type: AvatarType | None = AvatarType.google
    avatar_full_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


# User Search Response
class UserSearchResponse(BaseModel):
    id: int
    username: str
    name: str | None = None
    avatar_url: str | None = None
    avatar_type: AvatarType | None = AvatarType.google
    avatar_full_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


# Updated Diving Center Response to include organizations
class DivingCenterResponseWithOrganizations(DivingCenterResponse):
    organizations: list[DivingCenterOrganizationResponse] = []

    model_config = ConfigDict(from_attributes=True)


# Dive Schemas
class DiveBase(BaseModel):
    dive_site_id: int | None = None
    unlinked_site_name: str | None = Field(None, max_length=255)
    diving_center_id: int | None = None  # Link to diving center
    selected_route_id: int | None = None  # Selected dive route
    name: str | None = Field(None, max_length=255)  # Custom name/alias
    is_private: bool = False  # Privacy control - default public
    dive_information: str | None = None

    @field_validator("name", "dive_information", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)

    max_depth: float | None = Field(None, ge=0, le=1000)  # Maximum depth in meters
    average_depth: float | None = Field(None, ge=0, le=1000)  # Average depth in meters
    gas_bottles_used: str | None = None
    suit_type: str | None = Field(None, pattern=r"^(wet_suit|dry_suit|shortie|)$")
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    visibility_rating: int | None = Field(None, ge=1, le=5)
    user_rating: int | None = Field(None, ge=1, le=5)
    dive_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD format
    dive_time: str | None = Field(
        None, pattern=r"^\d{2}:\d{2}:\d{2}$"
    )  # HH:MM:SS format
    duration: int | None = Field(None, ge=1, le=1440)  # Duration in minutes

    @field_validator("suit_type", mode="before")
    @classmethod
    def normalize_suit_type(cls, v: Any) -> str | None:
        if v == "":
            return None
        return v


class DiveCreate(DiveBase):
    buddies: list[int] | None = None  # List of user IDs to add as buddies


class DiveUpdate(BaseModel):
    dive_site_id: int | None = None
    unlinked_site_name: str | None = Field(None, max_length=255)
    diving_center_id: int | None = None  # Link to diving center
    selected_route_id: int | None = None  # Selected dive route
    name: str | None = Field(None, max_length=255)
    is_private: bool | None = None
    dive_information: str | None = None

    @field_validator("name", "dive_information", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)

    max_depth: float | None = Field(None, ge=0, le=1000)
    average_depth: float | None = Field(None, ge=0, le=1000)
    gas_bottles_used: str | None = None
    suit_type: str | None = Field(None, pattern=r"^(wet_suit|dry_suit|shortie|)$")
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null for unspecified",
    )
    visibility_rating: int | None = Field(None, ge=1, le=5)
    user_rating: int | None = Field(None, ge=1, le=5)
    dive_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    dive_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}$")
    duration: int | None = Field(None, ge=1, le=1440)
    tags: list[int] | None = None  # List of tag IDs
    buddies: list[int] | None = None  # List of user IDs to add as buddies

    @field_validator("suit_type", mode="before")
    @classmethod
    def normalize_suit_type(cls, v: Any) -> str | None:
        if v == "":
            return None
        return v


class DiveResponse(DiveBase):
    id: int
    user_id: int
    dive_site_id: int | None = None
    unlinked_site_name: str | None = None
    diving_center_id: int | None = None  # Link to diving center
    selected_route_id: int | None = None  # Selected dive route
    name: str | None = None
    is_private: bool = False
    dive_information: str | None = None
    max_depth: float | None = None
    average_depth: float | None = None
    gas_bottles_used: str | None = None
    suit_type: str | None = None
    difficulty_level: str | None = None
    difficulty_code: str | None = None
    difficulty_label: str | None = None
    visibility_rating: int | None = None
    user_rating: int | None = None
    dive_date: str | None = None
    dive_time: str | None = None
    duration: int | None = None
    view_count: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    dive_site: dict | None = None
    diving_center: dict | None = None  # Diving center information
    selected_route: dict | None = None  # Selected route information
    media: list[dict] = []
    tags: list[dict] = []
    buddies: list[UserPublicInfo] = []  # List of buddy users
    user_username: str | None = None  # For public dives

    # Parsed from dive_information
    buddy: str | None = None
    sac: str | None = None
    otu: str | None = None
    cns: str | None = None
    water_temperature: str | None = None
    deco_model: str | None = None
    weights: str | None = None

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class DiveListResponse(BaseModel):
    items: list[DiveResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool
    match_types: dict[str, Any] | None = None


class DiveMediaCreate(BaseModel):
    media_type: str = Field(..., pattern=r"^(photo|video|dive_plan|external_link)$")
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    title: str | None = Field(None, max_length=255)  # For external links
    thumbnail_url: str | None = Field(
        None, max_length=500
    )  # For external links or photo thumbnails
    medium_url: str | None = Field(None, max_length=500)  # For medium sized photos


class DiveMediaUpdate(BaseModel):
    description: str | None = None


class DiveMediaResponse(BaseModel):
    id: int
    dive_id: int
    media_type: str
    url: str
    description: str | None = None
    title: str | None = None
    thumbnail_url: str | None = None
    medium_url: str | None = None
    download_url: str | None = None
    created_at: datetime


# Buddy Management Schemas
class AddBuddiesRequest(BaseModel):
    buddy_ids: list[int] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of user IDs to add as buddies (max 20)",
    )


class ReplaceBuddiesRequest(BaseModel):
    buddy_ids: list[int] = Field(
        ...,
        max_length=20,
        description="List of user IDs to set as buddies (max 20, can be empty to remove all)",
    )

    model_config = ConfigDict(from_attributes=True)


class DiveTagCreate(BaseModel):
    tag_id: int


class DiveTagResponse(BaseModel):
    id: int
    dive_id: int
    tag_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiveSearchParams(BaseModel):
    dive_site_id: int | None = None
    search: str | None = (
        None  # Unified search across dive site name, description, notes
    )
    difficulty_code: DifficultyCode = Field(
        None,
        description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING; omit for no filter",
    )
    exclude_unspecified_difficulty: bool = False
    suit_type: str | None = Field(None, pattern=r"^(wet_suit|dry_suit|shortie|)$")
    min_depth: float | None = Field(None, ge=0, le=1000)
    max_depth: float | None = Field(None, ge=0, le=1000)
    min_visibility: int | None = Field(None, ge=1, le=10)
    max_visibility: int | None = Field(None, ge=1, le=10)
    min_rating: int | None = Field(None, ge=1, le=10)
    max_rating: int | None = Field(None, ge=1, le=10)
    start_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class GarminFITResponse(BaseModel):
    message: str
    dives: list[dict]
    available_dive_sites: list[dict]
    available_diving_centers: list[dict]
    tag_ids: list[int] | None = None
    sort_by: str | None = Field(
        None,
        description="Sort field (dive_date, max_depth, duration, difficulty_level, visibility_rating, user_rating, view_count, created_at, updated_at)",
    )
    sort_order: str | None = Field("desc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)


class CSVHeaderResponse(BaseModel):
    headers: list[str]
    sample_data: list[dict[str, str]]
    total_rows: int


# Diving Center Ownership Schemas
class BroadcastTripRequest(BaseModel):
    trip_id: int
    is_update: bool | None = False


class DivingCenterOwnershipClaim(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)


class DivingCenterOwnershipResponse(BaseModel):
    id: int
    name: str
    owner_id: int | None = None
    ownership_status: str
    owner_username: str | None = None
    location: str | None = None
    claim_reason: str | None = None
    request_date: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DivingCenterOwnershipRevocation(BaseModel):
    """Schema for revoking diving center ownership."""

    reason: str | None = Field(None, max_length=1000)


class DivingCenterOwnershipApproval(BaseModel):
    approved: bool
    reason: str | None = Field(None, max_length=1000)


class OwnershipRequestHistoryResponse(BaseModel):
    id: int
    diving_center_id: int
    diving_center_name: str
    user_id: int
    username: str
    request_status: str
    request_date: datetime
    processed_date: datetime | None = None
    processed_by: int | None = None
    admin_username: str | None = None
    reason: str | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ParsedDiveResponse schemas
class ParsedDiveResponse(BaseModel):
    id: int
    trip_id: int
    dive_site_id: int | None = None
    dive_number: int
    dive_time: time | None = None
    dive_duration: int | None = None
    dive_description: str | None = None
    dive_site_name: str | None = None
    dive_site_country: str | None = None
    dive_site_region: str | None = None
    dive_site_average_rating: float | None = None
    dive_site_tags: list[dict] | None = None
    max_depth: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    user_dive_id: int | None = None  # ID of the matching dive in user's logbook
    user_dive_name: str | None = None  # Name of the matching dive
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParsedDiveCreate(BaseModel):
    trip_id: int | None = (
        None  # Optional when creating dives as part of a trip (backend sets it)
    )
    dive_site_id: int | None = None
    dive_number: int = Field(..., ge=1)
    dive_time: time | None = None
    dive_duration: int | None = Field(None, ge=1, le=1440)
    dive_description: str | None = None

    @field_validator("dive_description", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class ParsedDiveUpdate(BaseModel):
    dive_site_id: int | None = None
    dive_number: int | None = Field(None, ge=1)
    dive_time: time | None = None
    dive_duration: int | None = Field(None, ge=1, le=1440)
    dive_description: str | None = None

    @field_validator("dive_description", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class ParsedDiveTripResponse(BaseModel):
    id: int
    diving_center_id: int | None = None
    trip_date: date
    trip_time: time | None = None
    trip_duration: int | None = None  # Total duration in minutes
    trip_difficulty_code: DifficultyCode = None
    trip_difficulty_label: str | None = None
    trip_price: float | None = None
    trip_currency: str = "EUR"
    group_size_limit: int | None = None
    current_bookings: int = 0
    trip_description: str | None = None
    special_requirements: str | None = None
    trip_status: str = "scheduled"
    view_count: int = 0
    diving_center_name: str | None = None
    diving_center_country: str | None = None
    diving_center_region: str | None = None
    diving_center_phone: str | None = None
    diving_center_email: str | None = None
    max_depth: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    dives: list[ParsedDiveResponse] = []  # List of dives in this trip
    source_newsletter_id: int | None = None  # ID of the source newsletter
    newsletter_content: str | None = None  # Content of the source newsletter
    is_bookable: bool = False
    different_rental_price: bool = True
    custom_rental_price: float | None = None
    rental_price: float | None = None
    octo_slot_id: str | None = None
    seats_available: int | None = None
    base_price: float | None = None
    extracted_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParsedDiveTripListResponse(BaseModel):
    """Response for paginated trip lists"""

    items: list[ParsedDiveTripResponse]
    total: int
    page: int
    size: int
    pages: int


# Newsletter and Parsed Dive Trip Schemas
class NewsletterUploadResponse(BaseModel):
    newsletter_id: int
    trips_created: int
    message: str


# Newsletter Text Parse Request Schema
class NewsletterParseTextRequest(BaseModel):
    content: str
    diving_center_id: int | None = None
    use_openai: bool = True


# Newsletter Management Schemas
class NewsletterResponse(BaseModel):
    id: int
    content: str | None = None
    received_at: datetime
    trips_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class NewsletterUpdateRequest(BaseModel):
    content: str | None = None


class NewsletterDeleteRequest(BaseModel):
    newsletter_ids: list[int] = Field(..., min_length=1, max_length=100)


class NewsletterDeleteResponse(BaseModel):
    deleted_count: int
    message: str


# ParsedDiveTrip CRUD schemas
class ParsedDiveTripCreate(BaseModel):
    diving_center_id: int | None = None
    trip_date: date
    trip_time: time | None = None
    trip_duration: int | None = Field(None, ge=1, le=1440)  # Duration in minutes
    trip_difficulty_code: DifficultyCode = Field(
        None, description="Difficulty code or null"
    )
    trip_price: float | None = Field(None, ge=0)
    trip_currency: str = Field("EUR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    group_size_limit: int | None = Field(None, ge=1)
    current_bookings: int = Field(0, ge=0)
    trip_description: str | None = None
    special_requirements: str | None = None
    trip_status: str = Field(
        "scheduled", pattern=r"^(scheduled|confirmed|cancelled|completed)$"
    )
    enable_online_booking: bool | None = False
    different_rental_price: bool | None = True
    custom_rental_price: float | None = Field(None, ge=0)
    dives: list[ParsedDiveCreate] = []

    @field_validator("trip_description", "special_requirements", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


class ParsedDiveTripUpdate(BaseModel):
    diving_center_id: int | None = None
    trip_date: date | None = None
    trip_time: time | None = None
    trip_duration: int | None = Field(None, ge=1, le=1440)  # Duration in minutes
    trip_difficulty_code: DifficultyCode = Field(
        None, description="Difficulty code or null"
    )
    trip_price: float | None = Field(None, ge=0)
    trip_currency: str | None = Field(
        None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"
    )
    group_size_limit: int | None = Field(None, ge=1)
    current_bookings: int | None = Field(None, ge=0)
    trip_description: str | None = None
    special_requirements: str | None = None
    trip_status: str | None = Field(
        None, pattern=r"^(scheduled|confirmed|cancelled|completed)$"
    )
    enable_online_booking: bool | None = None
    different_rental_price: bool | None = None
    custom_rental_price: float | None = Field(None, ge=0)
    dives: list[ParsedDiveCreate] | None = None

    @field_validator("trip_description", "special_requirements", mode="before")
    @classmethod
    def clean_html_fields(cls, v):
        return strip_html(v)


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


class BroadcastTextRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    is_update: bool | None = False


# Notification Analytics Schemas
class InAppNotificationStats(BaseModel):
    total: int
    read: int
    unread: int
    read_rate: float
    by_category: dict[str, dict[str, int]]


class EmailDeliveryStats(BaseModel):
    total_sent: int
    sent_directly_to_ses: int
    queued_to_sqs: int
    delivery_rate: float
    avg_delivery_time_seconds: float | None = None


class NotificationCategoryStats(BaseModel):
    category: str
    total_notifications: int
    in_app_sent: int
    email_sent: int
    email_delivery_rate: float


class NotificationTimeStats(BaseModel):
    last_24h: dict[str, int]
    last_7d: dict[str, int]
    last_30d: dict[str, int]


class NotificationAnalyticsResponse(BaseModel):
    in_app: InAppNotificationStats
    email_delivery: EmailDeliveryStats
    by_category: list[NotificationCategoryStats]
    time_stats: NotificationTimeStats
    timestamp: str


class GrowthDataPoint(BaseModel):
    """Single data point in growth chart"""

    date: str
    count: int


class GrowthDataResponse(BaseModel):
    """Growth data for all entity types"""

    dive_sites: list[GrowthDataPoint]
    diving_centers: list[GrowthDataPoint]
    dives: list[GrowthDataPoint]
    dive_routes: list[GrowthDataPoint]
    dive_trips: list[GrowthDataPoint]
    users: list[GrowthDataPoint] | None = None


class GrowthRatesResponse(BaseModel):
    """Growth rates for all entity types"""

    dive_sites: float
    diving_centers: float
    dives: float
    dive_routes: float
    dive_trips: float
    users: float | None = 0.0


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
    description: str | None = None
    route_data: dict = Field(..., description="Multi-segment GeoJSON FeatureCollection")
    route_type: RouteType = Field(
        default=RouteType.scuba, description="Type of route: scuba, walk, swim"
    )

    @field_validator("route_data")
    @classmethod
    def validate_route_data(cls, v: dict, info: ValidationInfo = None):
        """Validate that route_data is valid multi-segment GeoJSON FeatureCollection"""
        if not isinstance(v, dict):
            raise ValueError("route_data must be a dictionary")

        # Check for required GeoJSON fields
        if "type" not in v:
            raise ValueError('route_data must have a "type" field')

        if v["type"] != "FeatureCollection":
            raise ValueError(
                'route_data type must be "FeatureCollection" for multi-segment routes'
            )

        if "features" not in v:
            raise ValueError('FeatureCollection must have a "features" field')

        features = v["features"]
        if not isinstance(features, list):
            raise ValueError("features must be a list")

        if len(features) == 0:
            raise ValueError("FeatureCollection must have at least one feature")

        # Validate each feature
        for i, feature in enumerate(features):
            if not isinstance(feature, dict):
                raise ValueError(f"Feature {i} must be a dictionary")

            if "type" not in feature or feature["type"] != "Feature":
                raise ValueError(f'Feature {i} must have type "Feature"')

            if "geometry" not in feature:
                raise ValueError(f'Feature {i} must have a "geometry" field')

            geometry = feature["geometry"]
            if not isinstance(geometry, dict):
                raise ValueError(f"Feature {i} geometry must be a dictionary")

            if "type" not in geometry:
                raise ValueError(f'Feature {i} geometry must have a "type" field')

            if geometry["type"] not in [
                "LineString",
                "Polygon",
                "Point",
                "MultiLineString",
                "MultiPolygon",
            ]:
                raise ValueError(
                    f"Feature {i} geometry type must be LineString, Polygon, Point, MultiLineString, or MultiPolygon"
                )

            if "coordinates" not in geometry:
                raise ValueError(
                    f'Feature {i} geometry must have a "coordinates" field'
                )

        # Validate coordinates are 2D (no depth data) - lenient for existing data
        def validate_coordinates_2d(coordinates):
            """Helper function to validate coordinates are 2D only"""
            if isinstance(coordinates, list) and len(coordinates) > 0:
                if isinstance(coordinates[0], list):
                    # Multi-dimensional coordinates
                    for coord in coordinates:
                        if isinstance(coord, list) and len(coord) > 0:
                            if isinstance(coord[0], (int, float)) and len(coord) > 2:
                                raise ValueError(
                                    "coordinates must be 2D only (longitude, latitude) - no depth data allowed"
                                )
                            elif not isinstance(coord[0], (int, float)):
                                # Skip validation for existing data that might have different formats
                                pass
                        elif (
                            isinstance(coord, list)
                            and len(coord) > 0
                            and isinstance(coord[0], list)
                        ):
                            # Handle nested arrays (e.g., Polygon coordinates)
                            for nested_coord in coord:
                                if (
                                    isinstance(nested_coord, list)
                                    and len(nested_coord) > 0
                                ):
                                    if (
                                        isinstance(nested_coord[0], (int, float))
                                        and len(nested_coord) > 2
                                    ):
                                        raise ValueError(
                                            "coordinates must be 2D only (longitude, latitude) - no depth data allowed"
                                        )
                                    # Skip validation for existing data that might have different formats
                elif isinstance(coordinates[0], (int, float)) and len(coordinates) > 2:
                    # Single coordinate
                    raise ValueError(
                        "coordinates must be 2D only (longitude, latitude) - no depth data allowed"
                    )
                # Skip validation for existing data that might have different formats
            # Skip validation for existing data that might have different formats

        if v["type"] == "Feature":
            validate_coordinates_2d(geometry["coordinates"])
        elif v["type"] == "FeatureCollection":
            for feature in features:
                validate_coordinates_2d(feature["geometry"]["coordinates"])

        return v


class DiveRouteCreate(DiveRouteBase):
    dive_site_id: int = Field(
        ..., description="ID of the dive site this route belongs to"
    )


class DiveRouteUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    route_data: dict | None = None
    route_type: RouteType | None = None

    @field_validator("route_data")
    @classmethod
    def validate_route_data(cls, v: dict | None, info: ValidationInfo = None):
        """Validate that route_data is valid multi-segment GeoJSON FeatureCollection if provided"""
        if v is not None:
            # Reuse the same validation logic as DiveRouteBase
            return DiveRouteBase.validate_route_data(v, info)
        return v


class DiveRouteResponse(DiveRouteBase):
    id: int
    dive_site_id: int
    created_by: int
    view_count: int = 0
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    deleted_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class DiveSiteBasic(BaseModel):
    id: int
    name: str
    country: str | None = None
    region: str | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DiveRouteWithDetails(DiveRouteResponse):
    """Extended response with related data"""

    dive_site: DiveSiteBasic | None = None  # Basic dive site info
    creator: UserPublicInfo | None = None  # Basic creator info


class DiveRouteWithCreator(DiveRouteResponse):
    """Response with creator information"""

    creator: dict | None = None  # Creator information


class DiveRouteListResponse(BaseModel):
    """Response for paginated route lists"""

    routes: list[DiveRouteWithDetails]
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


# User Profile Comments/Ratings History
class MyCommentItem(BaseModel):
    id: int
    comment_text: str
    created_at: datetime
    updated_at: datetime
    dive_site: DiveSiteBasic | None = None

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo = None):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class MyCommentsListResponse(BaseModel):
    items: list[MyCommentItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool


class MyRatingItem(BaseModel):
    id: int
    score: float
    created_at: datetime
    dive_site: DiveSiteBasic | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo = None):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class MyRatingsListResponse(BaseModel):
    items: list[MyRatingItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool


# Notification Schemas
class NotificationResponse(BaseModel):
    """Notification response model"""

    id: int
    user_id: int
    category: str
    title: str
    message: str
    link_url: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    is_read: bool
    read_at: datetime | None = None
    email_sent: bool
    email_sent_at: datetime | None = None
    created_at: datetime

    @field_validator("created_at", "read_at", "email_sent_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        """Normalize datetime fields to UTC timezone-aware datetimes."""
        if v is None:
            return v
        if isinstance(v, datetime):
            # If naive datetime, assume it's UTC (from database with timezone=True)
            if v.tzinfo is None:
                return v.replace(tzinfo=UTC)
            # If timezone-aware, convert to UTC
            elif v.tzinfo != UTC:
                return v.astimezone(UTC)
            return v
        return v

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceResponse(BaseModel):
    """Notification preference response model"""

    id: int
    user_id: int
    category: str
    enable_website: bool
    enable_push: bool
    enable_email: bool
    frequency: str
    area_filter: dict | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceCreate(BaseModel):
    """Create notification preference"""

    category: str = Field(
        ...,
        description="Category: new_dive_sites, new_dives, new_diving_centers, new_dive_trips, admin_alerts, system",
    )
    enable_website: bool = True
    enable_push: bool = True
    enable_email: bool = False
    frequency: str = Field(
        "immediate", description="Frequency: immediate, daily_digest, weekly_digest"
    )
    area_filter: dict | None = None


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preference"""

    enable_website: bool | None = None
    enable_push: bool | None = None
    enable_email: bool | None = None
    frequency: str | None = None
    area_filter: dict | None = None


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

    model_config = ConfigDict(from_attributes=True)


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

    smtp_host: str | None = None
    smtp_port: int | None = None
    use_starttls: bool | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None
    from_email: str | None = None
    from_name: str | None = None
    is_active: bool | None = None


class RouteDeletionRequest(BaseModel):
    """Request to delete a route"""

    route_id: int
    migrate_dives_to_route_id: int | None = None  # If dives need to be migrated


# Settings Schemas
class SettingResponse(BaseModel):
    """Response schema for a setting"""

    key: str
    value: str | int | float | bool | dict | list  # JSON value (parsed)
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SettingUpdate(BaseModel):
    """Schema for updating a setting value"""

    value: str | int | float | bool | dict | list  # JSON-serializable value


# Global Search Schemas
class GlobalSearchResult(BaseModel):
    """Individual search result item"""

    entity_type: str = Field(
        ...,
        description="Entity type: dive_site, diving_center, dive, dive_route, dive_trip",
    )
    id: int
    name: str
    route_path: str = Field(..., description="Frontend route path for navigation")
    icon_name: str = Field(..., description="Icon name for frontend rendering")
    metadata: dict | None = Field(
        None, description="Additional metadata (location, date, etc.)"
    )

    model_config = ConfigDict(from_attributes=True)


class EntityTypeSearchResults(BaseModel):
    """Results for a specific entity type"""

    entity_type: str
    icon_name: str
    count: int
    results: list[GlobalSearchResult]


class GlobalSearchResponse(BaseModel):
    """Response for global search endpoint"""

    query: str
    results: list[EntityTypeSearchResults]
    total_count: int

    model_config = ConfigDict(from_attributes=True)


# API Key Schemas
class ApiKeyResponse(BaseModel):
    """API key response model (key value only shown on creation)"""

    id: int
    name: str
    description: str | None = None
    created_by_user_id: int | None = None
    created_by_username: str | None = None
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreate(BaseModel):
    """Create API key request"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the API key",
    )
    description: str | None = Field(None, description="Optional description")
    expires_at: datetime | None = Field(
        None, description="Optional expiration date (ISO format)"
    )


class ApiKeyCreateResponse(BaseModel):
    """Response when creating a new API key (includes the actual key value)"""

    id: int
    name: str
    api_key: str = Field(..., description="The actual API key value (only shown once!)")
    description: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    warning: str = Field(
        default="Store this API key securely. It will not be shown again."
    )


class ApiKeyUpdate(BaseModel):
    """Update API key request"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class AuthAuditLogResponse(BaseModel):
    """Response schema for auth audit logs"""

    id: int
    user_id: int
    action: str
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime
    success: bool
    details: str | None = None
    username: str | None = None  # Enriched field

    @field_validator("timestamp", mode="before")
    @classmethod
    def normalize_datetime_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class EntityAuditLogResponse(BaseModel):
    """Response schema for entity lifecycle audit logs"""

    id: int
    entity_type: str
    entity_id: str | int
    action: str
    user_id: int | None = None
    user_role: str | None = None
    username: str | None = None
    auth_method: str
    pat_id: int | None = None
    pat_name: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    client_type: str
    changes: dict[str, Any] | None = None
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_created_at_to_utc(cls, v, info: ValidationInfo):
        return normalize_datetime_to_utc(cls, v)

    model_config = ConfigDict(from_attributes=True)


class DeleteR2PhotoRequest(BaseModel):
    r2_path: str


class PushSubscriptionBase(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionCreate(PushSubscriptionBase):
    pass


class PushSubscriptionResponse(PushSubscriptionBase):
    id: int
    user_id: int
    fail_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaderboardUserEntry(BaseModel):
    user_id: int
    username: str
    avatar_url: str | None = None
    avatar_type: AvatarType | None = AvatarType.google
    avatar_full_url: str | None = None
    count: int
    points: int | None = None
    rank: int


class LeaderboardCenterEntry(BaseModel):
    center_id: int
    name: str
    logo_url: str | None = None
    count: int
    rank: int


class LeaderboardUserResponse(BaseModel):
    metric: str
    entries: list[LeaderboardUserEntry]
    updated_at: datetime


class LeaderboardCenterResponse(BaseModel):
    metric: str
    entries: list[LeaderboardCenterEntry]
    updated_at: datetime


class DivingCenterManagerResponse(BaseModel):
    user_id: int
    username: str
    name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


class DivingCenterManagerCreate(BaseModel):
    username: str
