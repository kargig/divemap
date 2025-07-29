from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, DECIMAL, Enum, Date, Time, func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class DifficultyLevel(enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"

class MediaType(enum.Enum):
    photo = "photo"
    video = "video"

class DivingOrganization(Base):
    __tablename__ = "diving_organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    acronym = Column(String(20), unique=True, nullable=False, index=True)
    website = Column(String(255))
    logo_url = Column(String(500))
    description = Column(Text)
    country = Column(String(100))
    founded_year = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_center_organizations = relationship("DivingCenterOrganization", back_populates="diving_organization", cascade="all, delete-orphan")
    user_certifications = relationship("UserCertification", back_populates="diving_organization", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    google_id = Column(String(255), unique=True, index=True, nullable=True)  # Google OAuth ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_admin = Column(Boolean, default=False)
    is_moderator = Column(Boolean, default=False)
    enabled = Column(Boolean, default=True)  # New field for user activation
    number_of_dives = Column(Integer, default=0, nullable=False)  # Number of dives completed

    # Relationships
    site_ratings = relationship("SiteRating", back_populates="user", cascade="all, delete-orphan")
    site_comments = relationship("SiteComment", back_populates="user", cascade="all, delete-orphan")
    center_ratings = relationship("CenterRating", back_populates="user", cascade="all, delete-orphan")
    center_comments = relationship("CenterComment", back_populates="user", cascade="all, delete-orphan")
    certifications = relationship("UserCertification", back_populates="user", cascade="all, delete-orphan")

class DiveSite(Base):
    __tablename__ = "dive_sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    address = Column(Text)  # Added address field
    access_instructions = Column(Text)
    dive_plans = Column(Text)
    gas_tanks_necessary = Column(Text)
    difficulty_level = Column(Enum(DifficultyLevel), default=DifficultyLevel.intermediate, index=True)
    marine_life = Column(Text)  # Added marine life field
    safety_information = Column(Text)  # Added safety information field
    max_depth = Column(DECIMAL(5, 2))  # Maximum depth in meters
    alternative_names = Column(Text)  # Alternative names/aliases for the dive site
    country = Column(String(100), index=True)  # Country name
    region = Column(String(100), index=True)  # Region/state/province name
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    media = relationship("SiteMedia", back_populates="dive_site", cascade="all, delete-orphan")
    ratings = relationship("SiteRating", back_populates="dive_site", cascade="all, delete-orphan")
    comments = relationship("SiteComment", back_populates="dive_site", cascade="all, delete-orphan")
    center_relationships = relationship("CenterDiveSite", back_populates="dive_site", cascade="all, delete-orphan")
    dive_trips = relationship("ParsedDiveTrip", back_populates="dive_site")
    tags = relationship("DiveSiteTag", back_populates="dive_site", cascade="all, delete-orphan")

class SiteMedia(Base):
    __tablename__ = "site_media"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="media")

class SiteRating(Base):
    __tablename__ = "site_ratings"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 1-10
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="ratings")
    user = relationship("User", back_populates="site_ratings")

class SiteComment(Base):
    __tablename__ = "site_comments"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="comments")
    user = relationship("User", back_populates="site_comments")

class DivingCenter(Base):
    __tablename__ = "diving_centers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    email = Column(String(255))
    phone = Column(String(50))
    website = Column(String(255))
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    ratings = relationship("CenterRating", back_populates="diving_center", cascade="all, delete-orphan")
    comments = relationship("CenterComment", back_populates="diving_center", cascade="all, delete-orphan")
    dive_site_relationships = relationship("CenterDiveSite", back_populates="diving_center", cascade="all, delete-orphan")
    gear_rental_costs = relationship("GearRentalCost", back_populates="diving_center", cascade="all, delete-orphan")
    dive_trips = relationship("ParsedDiveTrip", back_populates="diving_center")
    organization_relationships = relationship("DivingCenterOrganization", back_populates="diving_center", cascade="all, delete-orphan")

class CenterRating(Base):
    __tablename__ = "center_ratings"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 1-10
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="ratings")
    user = relationship("User", back_populates="center_ratings")

class CenterComment(Base):
    __tablename__ = "center_comments"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="comments")
    user = relationship("User", back_populates="center_comments")

class CenterDiveSite(Base):
    __tablename__ = "center_dive_sites"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    dive_cost = Column(DECIMAL(10, 2))
    currency = Column(String(3), default="EUR", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="dive_site_relationships")
    dive_site = relationship("DiveSite", back_populates="center_relationships")

class GearRentalCost(Base):
    __tablename__ = "gear_rental_costs"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    cost = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="EUR", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="gear_rental_costs")

class ParsedDiveTrip(Base):
    __tablename__ = "parsed_dive_trips"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), index=True)
    trip_date = Column(Date, nullable=False, index=True)
    trip_time = Column(Time)
    source_newsletter_id = Column(Integer, ForeignKey("newsletters.id"))
    extracted_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="dive_trips")
    dive_site = relationship("DiveSite", back_populates="dive_trips")

class Newsletter(Base):
    __tablename__ = "newsletters"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class AvailableTag(Base):
    __tablename__ = "available_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site_tags = relationship("DiveSiteTag", back_populates="tag", cascade="all, delete-orphan")

class DiveSiteTag(Base):
    __tablename__ = "dive_site_tags"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("available_tags.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="tags")
    tag = relationship("AvailableTag", back_populates="dive_site_tags")

class DivingCenterOrganization(Base):
    __tablename__ = "diving_center_organizations"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
    diving_organization_id = Column(Integer, ForeignKey("diving_organizations.id"), nullable=False, index=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="organization_relationships")
    diving_organization = relationship("DivingOrganization", back_populates="diving_center_organizations")

class UserCertification(Base):
    __tablename__ = "user_certifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    diving_organization_id = Column(Integer, ForeignKey("diving_organizations.id"), nullable=False, index=True)
    certification_level = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="certifications")
    diving_organization = relationship("DivingOrganization", back_populates="user_certifications") 