from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date, time
from decimal import Decimal
from app.models import DifficultyLevel, MediaType

# User schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_admin: bool
    is_moderator: bool

    class Config:
        from_attributes = True

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

# Tag schemas
class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None

class TagResponse(TagBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Dive site tag schemas
class DiveSiteTagBase(BaseModel):
    dive_site_id: int
    tag_id: int

class DiveSiteTagCreate(BaseModel):
    tag_id: int

class DiveSiteTagResponse(DiveSiteTagBase):
    id: int
    created_at: datetime
    tag: TagResponse

    class Config:
        from_attributes = True

# Dive site schemas
class DiveSiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    access_instructions: Optional[str] = None
    dive_plans: Optional[str] = None
    gas_tanks_necessary: Optional[str] = None
    difficulty_level: DifficultyLevel = DifficultyLevel.intermediate
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None

class DiveSiteCreate(DiveSiteBase):
    pass

class DiveSiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    access_instructions: Optional[str] = None
    dive_plans: Optional[str] = None
    gas_tanks_necessary: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    marine_life: Optional[str] = None
    safety_information: Optional[str] = None

class DiveSiteResponse(DiveSiteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    average_rating: Optional[float] = None
    total_ratings: int = 0
    tags: List[TagResponse] = []
    user_rating: Optional[int] = None

    class Config:
        from_attributes = True

# Site media schemas
class SiteMediaBase(BaseModel):
    media_type: MediaType
    url: str = Field(..., max_length=500)
    description: Optional[str] = None

class SiteMediaCreate(SiteMediaBase):
    dive_site_id: int

class SiteMediaResponse(SiteMediaBase):
    id: int
    dive_site_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Rating schemas
class RatingBase(BaseModel):
    score: int = Field(..., ge=1, le=10)

class SiteRatingCreate(RatingBase):
    pass

class SiteRatingResponse(RatingBase):
    id: int
    dive_site_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Comment schemas
class CommentBase(BaseModel):
    comment_text: str = Field(..., min_length=1)

class SiteCommentCreate(CommentBase):
    dive_site_id: int

class SiteCommentUpdate(BaseModel):
    comment_text: str = Field(..., min_length=1)

class SiteCommentResponse(CommentBase):
    id: int
    dive_site_id: int
    user_id: int
    username: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Diving center schemas
class DivingCenterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)

class DivingCenterCreate(DivingCenterBase):
    pass

class DivingCenterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)

class DivingCenterResponse(DivingCenterBase):
    id: int
    created_at: datetime
    updated_at: datetime
    average_rating: Optional[float] = None
    total_ratings: int = 0

    class Config:
        from_attributes = True

# Center rating schemas
class CenterRatingCreate(RatingBase):
    pass

class CenterRatingResponse(RatingBase):
    id: int
    diving_center_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Center comment schemas
class CenterCommentCreate(CommentBase):
    diving_center_id: int

class CenterCommentUpdate(BaseModel):
    comment_text: str = Field(..., min_length=1)

class CenterCommentResponse(CommentBase):
    id: int
    diving_center_id: int
    user_id: int
    username: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Center dive site relationship schemas
class CenterDiveSiteBase(BaseModel):
    dive_cost: Optional[Decimal] = Field(None, ge=0)

class CenterDiveSiteCreate(CenterDiveSiteBase):
    diving_center_id: int
    dive_site_id: int

class CenterDiveSiteResponse(CenterDiveSiteBase):
    id: int
    diving_center_id: int
    dive_site_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Gear rental cost schemas
class GearRentalCostBase(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=100)
    cost: Decimal = Field(..., ge=0)

class GearRentalCostCreate(GearRentalCostBase):
    diving_center_id: int

class GearRentalCostResponse(GearRentalCostBase):
    id: int
    diving_center_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Parsed dive trip schemas
class ParsedDiveTripBase(BaseModel):
    trip_date: date
    trip_time: Optional[time] = None

class ParsedDiveTripCreate(ParsedDiveTripBase):
    diving_center_id: Optional[int] = None
    dive_site_id: Optional[int] = None
    source_newsletter_id: Optional[int] = None

class ParsedDiveTripResponse(ParsedDiveTripBase):
    id: int
    diving_center_id: Optional[int] = None
    dive_site_id: Optional[int] = None
    source_newsletter_id: Optional[int] = None
    extracted_at: datetime

    class Config:
        from_attributes = True

# Newsletter schemas
class NewsletterBase(BaseModel):
    content: str = Field(..., min_length=1)

class NewsletterCreate(NewsletterBase):
    pass

class NewsletterResponse(NewsletterBase):
    id: int
    received_at: datetime

    class Config:
        from_attributes = True

# Search and filter schemas
class DiveSiteSearchParams(BaseModel):
    name: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    min_rating: Optional[float] = Field(None, ge=0, le=10)
    max_rating: Optional[float] = Field(None, ge=0, le=10)
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)

class DivingCenterSearchParams(BaseModel):
    name: Optional[str] = None
    min_rating: Optional[float] = Field(None, ge=0, le=10)
    max_rating: Optional[float] = Field(None, ge=0, le=10)
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0) 