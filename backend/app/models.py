from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, DECIMAL, Enum, Date, Time, func
from sqlalchemy.orm import relationship
from app.database import Base
import enum
import sqlalchemy as sa

# Difficulty levels are now stored as integers in the database:
# 1 = beginner, 2 = intermediate, 3 = advanced, 4 = expert
# This allows for efficient sorting and better performance
DIFFICULTY_LEVELS = {
    1: "beginner",
    2: "intermediate", 
    3: "advanced",
    4: "expert"
}

def get_difficulty_label(level: int) -> str:
    """Convert integer difficulty level to human-readable label."""
    return DIFFICULTY_LEVELS.get(level, "unknown")

def get_difficulty_value(label: str) -> int:
    """Convert human-readable difficulty label to integer value."""
    for value, difficulty_label in DIFFICULTY_LEVELS.items():
        if difficulty_label == label:
            return value
    return 2  # Default to intermediate if label not found

class MediaType(enum.Enum):
    photo = "photo"
    video = "video"
    dive_plan = "dive_plan"
    external_link = "external_link"

class SuitType(enum.Enum):
    wet_suit = "wet_suit"
    dry_suit = "dry_suit"
    shortie = "shortie"

class OwnershipStatus(enum.Enum):
    unclaimed = "unclaimed"
    claimed = "claimed"
    approved = "approved"
    denied = "denied"

class TripStatus(enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"

class RouteType(enum.Enum):
    scuba = "scuba"
    walk = "walk"
    swim = "swim"

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
    name = Column(String(255), nullable=True)  # User's full name (can contain multiple words)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    google_id = Column(String(255), unique=True, index=True, nullable=True)  # Google OAuth ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_admin = Column(Boolean, default=False)
    is_moderator = Column(Boolean, default=False)
    enabled = Column(Boolean, default=True)  # New field for user activation
    number_of_dives = Column(Integer, default=0, nullable=False)  # Number of dives completed
    avatar_url = Column(String(500), nullable=True)  # User avatar URL
    turnstile_verified_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when Turnstile was verified

    # Relationships
    site_ratings = relationship("SiteRating", back_populates="user", cascade="all, delete-orphan")
    site_comments = relationship("SiteComment", back_populates="user", cascade="all,delete-orphan")
    center_ratings = relationship("CenterRating", back_populates="user", cascade="all, delete-orphan")
    center_comments = relationship("CenterComment", back_populates="user", cascade="all, delete-orphan")
    certifications = relationship("UserCertification", back_populates="user", cascade="all, delete-orphan")
    dives = relationship("Dive", back_populates="user", cascade="all, delete-orphan")
    created_routes = relationship("DiveRoute", back_populates="creator", primaryjoin="User.id == DiveRoute.created_by", cascade="all, delete-orphan")
    diving_centers = relationship("DivingCenter", back_populates="owner")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    auth_audit_logs = relationship("AuthAuditLog", back_populates="user", cascade="all, delete-orphan")

class DiveSite(Base):
    __tablename__ = "dive_sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    address = Column(Text)  # Added address field
    access_instructions = Column(Text)
    difficulty_level = Column(Integer, default=2, nullable=False, index=True)  # 1=beginner, 2=intermediate, 3=advanced, 4=expert
    marine_life = Column(Text)  # Added marine life field
    safety_information = Column(Text)  # Added safety information field
    max_depth = Column(DECIMAL(6, 3))  # Maximum depth in meters
    country = Column(String(100), index=True)  # Country name
    region = Column(String(100), index=True)  # Region/state/province name
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created the dive site
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    media = relationship("SiteMedia", back_populates="dive_site", cascade="all, delete-orphan")
    ratings = relationship("SiteRating", back_populates="dive_site", cascade="all, delete-orphan")
    comments = relationship("SiteComment", back_populates="dive_site", cascade="all, delete-orphan")
    center_relationships = relationship("CenterDiveSite", back_populates="dive_site", cascade="all, delete-orphan")
    parsed_dives = relationship("ParsedDive", back_populates="dive_site", cascade="all, delete-orphan")
    tags = relationship("DiveSiteTag", back_populates="dive_site", cascade="all, delete-orphan")
    dives = relationship("Dive", back_populates="dive_site", cascade="all, delete-orphan")
    routes = relationship("DiveRoute", back_populates="dive_site", cascade="all, delete-orphan")
    aliases = relationship("DiveSiteAlias", back_populates="dive_site", cascade="all, delete-orphan")

class DiveSiteAlias(Base):
    __tablename__ = "dive_site_aliases"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    alias = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="aliases")

    # Unique constraint to prevent duplicate aliases for the same dive site
    __table_args__ = (
        sa.UniqueConstraint('dive_site_id', 'alias', name='_dive_site_alias_uc'),
    )

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
    country = Column(String(100), nullable=True, index=True)  # New field for country
    region = Column(String(100), nullable=True, index=True)   # New field for region
    city = Column(String(100), nullable=True, index=True)     # New field for city
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True) # New field for owner
    ownership_status = Column(Enum(OwnershipStatus), default=OwnershipStatus.unclaimed, nullable=False) # New field for ownership status

    # Relationships
    ratings = relationship("CenterRating", back_populates="diving_center", cascade="all, delete-orphan")
    comments = relationship("CenterComment", back_populates="diving_center", cascade="all, delete-orphan")
    dive_site_relationships = relationship("CenterDiveSite", back_populates="diving_center", cascade="all, delete-orphan")
    gear_rental_costs = relationship("GearRentalCost", back_populates="diving_center", cascade="all, delete-orphan")
    dive_trips = relationship("ParsedDiveTrip", back_populates="diving_center")
    organization_relationships = relationship("DivingCenterOrganization", back_populates="diving_center", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="diving_centers") # New relationship for owner
    dives = relationship("Dive", back_populates="diving_center", cascade="all, delete-orphan")  # New relationship for dives

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
    trip_date = Column(Date, nullable=False, index=True)
    trip_time = Column(Time)
    trip_duration = Column(Integer)  # Total duration in minutes
    trip_difficulty_level = Column(Integer, nullable=True, index=True)  # 1=beginner, 2=intermediate, 3=advanced, 4=expert
    trip_price = Column(DECIMAL(10, 2), nullable=True)
    trip_currency = Column(String(3), default="EUR", nullable=False, index=True)
    group_size_limit = Column(Integer, nullable=True)
    current_bookings = Column(Integer, default=0, nullable=False)
    trip_description = Column(Text, nullable=True)
    special_requirements = Column(Text, nullable=True)
    trip_status = Column(Enum(TripStatus), default=TripStatus.scheduled, nullable=False, index=True)
    source_newsletter_id = Column(Integer, ForeignKey("newsletters.id"))
    extracted_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="dive_trips")
    dives = relationship("ParsedDive", back_populates="trip", cascade="all, delete-orphan")

class ParsedDive(Base):
    __tablename__ = "parsed_dives"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("parsed_dive_trips.id"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), index=True)
    dive_number = Column(Integer, nullable=False)  # 1 for first dive, 2 for second dive, etc.
    dive_time = Column(Time, nullable=True)  # Time for this specific dive
    dive_duration = Column(Integer, nullable=True)  # Duration for this specific dive in minutes
    dive_description = Column(Text, nullable=True)  # Description for this specific dive
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    trip = relationship("ParsedDiveTrip", back_populates="dives")
    dive_site = relationship("DiveSite", back_populates="parsed_dives")

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
    dive_tags = relationship("DiveTag", back_populates="tag", cascade="all, delete-orphan")

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

class OwnershipRequest(Base):
    __tablename__ = "ownership_requests"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request_status = Column(Enum(OwnershipStatus), nullable=False)  # claimed, approved, denied, revoked
    request_date = Column(DateTime(timezone=True), server_default=func.now())
    processed_date = Column(DateTime(timezone=True), nullable=True)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # admin who processed the request
    reason = Column(Text, nullable=True)  # reason for approval/denial/revocation
    notes = Column(Text, nullable=True)  # additional admin notes

    # Relationships
    diving_center = relationship("DivingCenter")
    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[processed_by])

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

class Dive(Base):
    __tablename__ = "dives"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id"), nullable=True)  # Link to diving center
    name = Column(String(255), nullable=True)  # Custom name/alias provided by user
    is_private = Column(Boolean, default=False)  # Privacy control - default public
    dive_information = Column(Text)
    max_depth = Column(DECIMAL(6, 3))  # Maximum depth in meters
    average_depth = Column(DECIMAL(6, 3))  # Average depth in meters
    gas_bottles_used = Column(Text)
    suit_type = Column(Enum(SuitType), nullable=True)
    difficulty_level = Column(Integer, default=2, nullable=False)  # 1=beginner, 2=intermediate, 3=advanced, 4=expert
    visibility_rating = Column(Integer)  # 1-10 rating
    user_rating = Column(Integer)  # 1-10 rating
    dive_date = Column(Date, nullable=False)
    dive_time = Column(Time, nullable=True)
    duration = Column(Integer)  # Duration in minutes
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    # Dive profile metadata
    profile_xml_path = Column(String(500), nullable=True)  # Path to XML profile file
    profile_sample_count = Column(Integer, nullable=True)  # Number of sample points
    profile_max_depth = Column(DECIMAL(6, 3), nullable=True)  # Max depth from profile
    profile_duration_minutes = Column(Integer, nullable=True)  # Duration from profile
    selected_route_id = Column(Integer, ForeignKey("dive_routes.id"), nullable=True, index=True)  # Selected dive route
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="dives")
    dive_site = relationship("DiveSite", back_populates="dives")
    diving_center = relationship("DivingCenter", back_populates="dives")  # New relationship
    selected_route = relationship("DiveRoute", foreign_keys=[selected_route_id])
    media = relationship("DiveMedia", back_populates="dive", cascade="all, delete-orphan")
    tags = relationship("DiveTag", back_populates="dive", cascade="all, delete-orphan")

class DiveMedia(Base):
    __tablename__ = "dive_media"

    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id"), nullable=False)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    title = Column(String(255))  # For external links
    thumbnail_url = Column(String(500))  # For external links
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive = relationship("Dive", back_populates="media")

class DiveTag(Base):
    __tablename__ = "dive_tags"

    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("available_tags.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive = relationship("Dive", back_populates="tags")
    tag = relationship("AvailableTag", back_populates="dive_tags")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id = Column(String(255), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    last_used_at = Column(DateTime, server_default=func.now())
    is_revoked = Column(Boolean, default=False)
    device_info = Column(Text)
    ip_address = Column(String(45))
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


class AuthAuditLog(Base):
    __tablename__ = "auth_audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # login, logout, token_refresh, etc.
    ip_address = Column(String(45))
    user_agent = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())
    success = Column(Boolean, default=True)
    details = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="auth_audit_logs")


class DiveRoute(Base):
    __tablename__ = "dive_routes"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    route_data = Column(sa.JSON, nullable=False)  # Multi-segment GeoJSON FeatureCollection
    route_type = Column(Enum(RouteType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # Soft delete fields
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dive_site = relationship("DiveSite", back_populates="routes")
    creator = relationship("User", back_populates="created_routes", foreign_keys=[created_by])
    deleter = relationship("User", foreign_keys=[deleted_by])
    
    @property
    def is_deleted(self) -> bool:
        """Check if route is soft deleted"""
        return self.deleted_at is not None
    
    def soft_delete(self, deleted_by_user_id: int) -> None:
        """Soft delete the route"""
        self.deleted_at = func.now()
        self.deleted_by = deleted_by_user_id
    
    def restore(self) -> None:
        """Restore a soft deleted route"""
        self.deleted_at = None
        self.deleted_by = None