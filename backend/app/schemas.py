from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Union
from datetime import datetime
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
    diving_certification: Optional[str] = Field(None, max_length=100)
    number_of_dives: Optional[int] = Field(None, ge=0)

class UserResponse(UserBase):
    id: int
    enabled: bool
    is_admin: bool
    is_moderator: bool
    diving_certification: Optional[str] = None
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
    dive_plans: Optional[str] = None
    gas_tanks_necessary: Optional[str] = None
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None
    max_depth: Optional[float] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    alternative_names: Optional[str] = None  # Alternative names/aliases
    country: Optional[str] = Field(None, max_length=100)  # Country name
    region: Optional[str] = Field(None, max_length=100)  # Region/state/province name

class DiveSiteCreate(DiveSiteBase):
    pass

class DiveSiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    access_instructions: Optional[str] = None
    dive_plans: Optional[str] = None
    gas_tanks_necessary: Optional[str] = None
    difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None
    max_depth: Optional[Union[float, str]] = Field(None, ge=0, le=1000)  # Maximum depth in meters
    alternative_names: Optional[str] = None  # Alternative names/aliases
    country: Optional[str] = Field(None, max_length=100)  # Country name
    region: Optional[str] = Field(None, max_length=100)  # Region/state/province name

    @validator('max_depth', pre=True)
    def handle_empty_strings(cls, v):
        if isinstance(v, str) and v.strip() == '':
            return None
        return v

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

    class Config:
        from_attributes = True

# Rating Schemas
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