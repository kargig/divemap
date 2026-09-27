from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, DECIMAL, Enum, Date, Time, func, LargeBinary, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import enum
import sqlalchemy as sa
from sqlalchemy import event, text
from sqlalchemy.dialects.mysql import LONGTEXT
WKTElement = None  # Avoid geoalchemy2 dependency in tests/CI

# Helper functions for difficulty code conversion
def get_difficulty_id_by_code(db, code: str):
    """Get difficulty_levels.id by code. Returns None if code is None or not found."""
    if code is None:
        return None
    difficulty = db.query(DifficultyLevel).filter(DifficultyLevel.code == code).first()
    return difficulty.id if difficulty else None

def get_difficulty_code_by_id(db, difficulty_id: int):
    """Get difficulty_levels.code by id. Returns None if id is None or not found."""
    if difficulty_id is None:
        return None
    difficulty = db.query(DifficultyLevel).filter(DifficultyLevel.id == difficulty_id).first()
    return difficulty.code if difficulty else None

import enum

class BusinessChatStatus(str, enum.Enum):
    UNREAD = "UNREAD"
    READ = "READ"
    RESOLVED = "RESOLVED"

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

class DifficultyLevel(Base):
    __tablename__ = "difficulty_levels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    label = Column(String(100), unique=True, nullable=False)
    order_index = Column(Integer, nullable=False, index=True)

    # Relationships
    dive_sites = relationship("DiveSite", back_populates="difficulty")
    dives = relationship("Dive", back_populates="difficulty")
    parsed_dive_trips = relationship("ParsedDiveTrip", back_populates="difficulty")

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
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_center_organizations = relationship("DivingCenterOrganization", back_populates="diving_organization", cascade="all, delete-orphan")
    user_certifications = relationship("UserCertification", back_populates="diving_organization", cascade="all, delete-orphan")
    certification_levels = relationship("CertificationLevel", back_populates="diving_organization", cascade="all, delete-orphan")

class CertificationLevel(Base):
    __tablename__ = "certification_levels"

    id = Column(Integer, primary_key=True, index=True)
    diving_organization_id = Column(Integer, ForeignKey("diving_organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False) # e.g., "Open Water Diver"
    category = Column(String(100)) # e.g., "Recreational", "Technical"
    max_depth = Column(String(50)) # e.g., "18m (60ft)"
    gases = Column(String(255)) # e.g., "Air", "Nitrox"
    tanks = Column(String(255)) # e.g., "Single", "Double + Stage"
    deco_time_limit = Column(String(100)) # e.g., "No decompression", "15 minutes", "Unlimited"
    prerequisites = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_organization = relationship("DivingOrganization", back_populates="certification_levels")
    user_certifications = relationship("UserCertification", back_populates="certification_level_link")

class ShortLink(Base):
    __tablename__ = "short_links"

    id = Column(String(10), primary_key=True, index=True)
    original_url = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

class EditRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class EditRequestType(str, enum.Enum):
    site_data = "site_data"
    media_addition = "media_addition"
    media_update = "media_update"
    media_deletion = "media_deletion"
    tag_addition = "tag_addition"
    tag_removal = "tag_removal"
    center_association = "center_association"
    center_removal = "center_removal"

class DiveSiteEditRequest(Base):
    __tablename__ = "dive_site_edit_requests"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(Enum(EditRequestStatus), default=EditRequestStatus.pending, nullable=False, index=True)
    edit_type = Column(Enum(EditRequestType), default=EditRequestType.site_data, nullable=False)
    # Use JSON type, SQLAlchemy will map to JSON/JSONB depending on dialect
    proposed_data = Column(JSON, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dive_site = relationship("DiveSite", backref="edit_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)  # User's full name (can contain multiple words)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    google_id = Column(String(255), unique=True, index=True, nullable=True)  # Google OAuth ID
    facebook_id = Column(String(255), unique=True, index=True, nullable=True)  # Facebook OAuth ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_admin = Column(Boolean, default=False, nullable=False)
    is_moderator = Column(Boolean, default=False, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)  # New field for user activation
    number_of_dives = Column(Integer, default=0, nullable=False)  # Number of dives completed
    avatar_url = Column(String(500), nullable=True)  # User avatar URL
    avatar_type = Column(String(20), default='google', nullable=True)  # 'google', 'custom', 'library'
    google_avatar_url = Column(String(500), nullable=True)  # Original Google avatar URL
    facebook_avatar_url = Column(String(500), nullable=True)  # Original Facebook avatar URL
    turnstile_verified_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when Turnstile was verified
    buddy_visibility = Column(String(20), default='public', nullable=False)  # Control whether user can be added as buddy ('public' or 'private')
    last_notification_check = Column(DateTime(timezone=True), nullable=True)  # Track when user last checked notifications
    email_verified = Column(Boolean, default=False, nullable=False)  # Email verification status
    email_verified_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when email was verified
    email_notifications_opted_out = Column(Boolean, default=False, nullable=False)  # Global email opt-out flag
    email_opt_out_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when user opted out of all emails
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when user last accessed the application
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Timestamp when user archived their account

    # Relationships
    site_ratings = relationship("SiteRating", back_populates="user", cascade="all, delete-orphan")
    site_comments = relationship("SiteComment", back_populates="user", cascade="all,delete-orphan")
    center_ratings = relationship("CenterRating", back_populates="user", cascade="all, delete-orphan")
    center_comments = relationship("CenterComment", back_populates="user", cascade="save-update, merge")
    certifications = relationship("UserCertification", back_populates="user", cascade="all, delete-orphan")
    dives = relationship("Dive", back_populates="user", cascade="all, delete-orphan")
    created_routes = relationship("DiveRoute", back_populates="creator", primaryjoin="User.id == DiveRoute.created_by", cascade="all, delete-orphan")
    diving_centers = relationship("DivingCenter", back_populates="owner")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    auth_audit_logs = relationship("AuthAuditLog", back_populates="user", cascade="all, delete-orphan")
    buddy_dives = relationship("Dive", secondary="dive_buddies", back_populates="buddies")
    notification_preferences = relationship("NotificationPreference", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="user", cascade="all, delete-orphan")
    unsubscribe_token = relationship("UnsubscribeToken", back_populates="user", uselist=False, cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    social_links = relationship("UserSocialLink", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
    dive_site_lists = relationship("DiveSiteList", back_populates="user", cascade="all, delete-orphan")
    collaborating_lists = relationship("DiveSiteListCollaborator", back_populates="user", cascade="all, delete-orphan")

class UserSocialLink(Base):
    __tablename__ = "user_social_links"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String(50), nullable=False) # e.g., "instagram", "facebook"
    url = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="social_links")

    # Unique constraint to prevent duplicate platforms for the same user
    __table_args__ = (
        sa.UniqueConstraint('user_id', 'platform', name='_user_platform_uc'),
   )

class DiveSiteList(Base):
    __tablename__ = "dive_site_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    slug = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    show_on_profile = Column(Boolean, default=True, nullable=False)
    system_type = Column(String(50), nullable=True, default=None)  # "favorites", "wishlist", or None
    view_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="dive_site_lists")
    items = relationship(
        "DiveSiteListItem",
        back_populates="list",
        cascade="all, delete-orphan",
        order_by="DiveSiteListItem.display_order"
    )
    collaborators = relationship("DiveSiteListCollaborator", back_populates="list", cascade="all, delete-orphan")

class DiveSiteListItem(Base):
    __tablename__ = "dive_site_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("dive_site_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    list = relationship("DiveSiteList", back_populates="items")
    dive_site = relationship("DiveSite")

    # Unique constraint to prevent duplicate dive sites in the same list
    __table_args__ = (
        sa.UniqueConstraint('list_id', 'dive_site_id', name='uq_list_dive_site'),
    )

class DiveSiteListCollaborator(Base):
    __tablename__ = "dive_site_list_collaborators"
    __table_args__ = (
        sa.UniqueConstraint('list_id', 'user_id', name='uq_list_collaborator'),
    )

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("dive_site_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="editor", nullable=False)
    show_on_profile = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    list = relationship("DiveSiteList", back_populates="collaborators")
    user = relationship("User", back_populates="collaborating_lists")

    @property
    def username(self) -> str:
        if hasattr(self, "_username_val") and self._username_val:
            return self._username_val
        return self.user.username if self.user else "unknown"

    @username.setter
    def username(self, value: str):
        self._username_val = value

class DiveSite(Base):
    __tablename__ = "dive_sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    access_instructions = Column(Text)
    difficulty_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True, index=True)
    marine_life = Column(Text)  # Added marine life field
    safety_information = Column(Text)  # Added safety information field
    max_depth = Column(DECIMAL(6, 3))  # Maximum depth in meters
    country = Column(String(100), index=True)  # Country name
    region = Column(String(100), index=True)  # Region/state/province name
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created the dive site
    shore_direction = Column(DECIMAL(5, 2), nullable=True)  # Compass bearing (0-360 degrees) indicating which direction the shore/beach faces
    shore_direction_confidence = Column(Enum('high', 'medium', 'low', name='shore_direction_confidence'), nullable=True)  # Confidence level of automatic detection
    shore_direction_method = Column(String(50), nullable=True, default='osm_coastline')  # Method used to determine shore direction (e.g., 'osm_coastline', 'manual', 'ai')
    shore_direction_distance_m = Column(DECIMAL(8, 2), nullable=True)  # Distance to coastline in meters (for reference/debugging)
    media_order = Column(sa.JSON, nullable=True)  # JSON array for custom media ordering ['site_1', 'dive_5']
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(Enum('approved', 'pending', 'rejected', name='dive_site_status'), default='approved', nullable=False, index=True)
    # Geometry column exists in DB via migration; declare minimally for ORM usage
    location = Column(sa.Text, nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    difficulty = relationship("DifficultyLevel", back_populates="dive_sites")
    media = relationship("SiteMedia", back_populates="dive_site", cascade="all, delete-orphan")
    ratings = relationship("SiteRating", back_populates="dive_site", cascade="all, delete-orphan")
    comments = relationship("SiteComment", back_populates="dive_site", cascade="all, delete-orphan")
    center_relationships = relationship("CenterDiveSite", back_populates="dive_site", cascade="all, delete-orphan")
    parsed_dives = relationship("ParsedDive", back_populates="dive_site", passive_deletes=True)
    tags = relationship("DiveSiteTag", back_populates="dive_site", cascade="all, delete-orphan")
    dives = relationship("Dive", back_populates="dive_site", passive_deletes=True)
    routes = relationship("DiveRoute", back_populates="dive_site", cascade="all, delete-orphan")
    aliases = relationship("DiveSiteAlias", back_populates="dive_site", cascade="all, delete-orphan")

class DiveSiteAlias(Base):
    __tablename__ = "dive_site_aliases"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    alias = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="aliases")

    # Unique constraint to prevent duplicate aliases for the same dive site
    __table_args__ = (
        sa.UniqueConstraint('dive_site_id', 'alias', name='_dive_site_alias_uc'),
    )

# ORM-level hooks to keep POINT(location) in sync with lat/lng (avoids DB triggers)
@event.listens_for(DiveSite, "before_insert")
def _dive_site_set_location_before_insert(mapper, connection, target):
    lat = target.latitude if target.latitude is not None else 0
    lng = target.longitude if target.longitude is not None else 0
    # Use MySQL spatial function directly in VALUES to satisfy NOT NULL
    target.location = text(f"ST_SRID(POINT({float(lng)}, {float(lat)}), 4326)")


@event.listens_for(DiveSite, "before_update")
def _dive_site_set_location_before_update(mapper, connection, target):
    lat = target.latitude if target.latitude is not None else 0
    lng = target.longitude if target.longitude is not None else 0
    target.location = text(f"ST_SRID(POINT({float(lng)}, {float(lat)}), 4326)")


class SiteMedia(Base):
    __tablename__ = "site_media"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    thumbnail_url = Column(String(500))
    medium_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="media")
    user = relationship("User")

class SiteRating(Base):
    __tablename__ = "site_ratings"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 1-10
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="ratings")
    user = relationship("User", back_populates="site_ratings")

class SiteComment(Base):
    __tablename__ = "site_comments"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
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
    address = Column(Text)
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
    logo_url = Column(String(500), nullable=True) # New field for diving center logo
    # Geometry column exists in DB via migration 0038; declare minimally for ORM usage
    location = Column(sa.Text, nullable=False)

    # Relationships
    ratings = relationship("CenterRating", back_populates="diving_center", cascade="all, delete-orphan")
    comments = relationship("CenterComment", back_populates="diving_center", cascade="all, delete-orphan")
    dive_site_relationships = relationship("CenterDiveSite", back_populates="diving_center", cascade="all, delete-orphan")
    gear_rental_costs = relationship("GearRentalCost", back_populates="diving_center", cascade="all, delete-orphan")
    dive_trips = relationship("ParsedDiveTrip", back_populates="diving_center")
    organization_relationships = relationship("DivingCenterOrganization", back_populates="diving_center", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="diving_centers") # New relationship for owner
    dives = relationship("Dive", back_populates="diving_center", cascade="all, delete-orphan")

    media = relationship("CenterMedia", back_populates="diving_center", cascade="all, delete-orphan")

class DivingCenterManager(Base):
    """
    Managers allowed to access the business inbox for a diving center.
    """
    __tablename__ = "diving_center_managers"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Composite unique constraint to prevent duplicate managers
    __table_args__ = (
        sa.UniqueConstraint('diving_center_id', 'user_id', name='uix_center_manager'),
    )

    diving_center = relationship("DivingCenter", backref=sa.orm.backref("managers", cascade="all, delete-orphan"))
    user = relationship("User")  # New relationship for dives


# ORM-level hooks to keep POINT(location) in sync with lat/lng (avoids DB triggers)
@event.listens_for(DivingCenter, "before_insert")
def _dc_set_location_before_insert(mapper, connection, target):
    lat = target.latitude if target.latitude is not None else 0
    lng = target.longitude if target.longitude is not None else 0
    # Use MySQL spatial function directly in VALUES to satisfy NOT NULL
    target.location = text(f"ST_SRID(POINT({float(lng)}, {float(lat)}), 4326)")


@event.listens_for(DivingCenter, "before_update")
def _dc_set_location_before_update(mapper, connection, target):
    lat = target.latitude if target.latitude is not None else 0
    lng = target.longitude if target.longitude is not None else 0
    target.location = text(f"ST_SRID(POINT({float(lng)}, {float(lat)}), 4326)")

class CenterRating(Base):
    __tablename__ = "center_ratings"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 1-10
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="ratings")
    user = relationship("User", back_populates="center_ratings")

class CenterComment(Base):
    __tablename__ = "center_comments"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="comments")
    user = relationship("User", back_populates="center_comments")

class CenterMedia(Base):
    __tablename__ = "center_media"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    thumbnail_url = Column(String(500))
    medium_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="media")
    user = relationship("User")

class CenterDiveSite(Base):
    __tablename__ = "center_dive_sites"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    dive_cost = Column(DECIMAL(10, 2))
    currency = Column(String(3), default="EUR", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="dive_site_relationships")
    dive_site = relationship("DiveSite", back_populates="center_relationships")

class GearRentalCost(Base):
    __tablename__ = "gear_rental_costs"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    cost = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="EUR", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="gear_rental_costs")

class ParsedDiveTrip(Base):
    __tablename__ = "parsed_dive_trips"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), index=True)
    trip_date = Column(Date, nullable=False, index=True)
    trip_time = Column(Time)
    trip_duration = Column(Integer)  # Total duration in minutes
    trip_difficulty_id = Column(Integer, ForeignKey("difficulty_levels.id"), nullable=True, index=True)
    trip_price = Column(DECIMAL(10, 2), nullable=True)
    trip_currency = Column(String(3), default="EUR", nullable=False, index=True)
    group_size_limit = Column(Integer, nullable=True)
    current_bookings = Column(Integer, default=0, nullable=False)
    trip_description = Column(Text, nullable=True)
    special_requirements = Column(Text, nullable=True)
    trip_status = Column(Enum(TripStatus), default=TripStatus.scheduled, nullable=False, index=True)
    source_newsletter_id = Column(Integer, ForeignKey("newsletters.id", ondelete="SET NULL"))
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    extracted_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    difficulty = relationship("DifficultyLevel", back_populates="parsed_dive_trips")
    diving_center = relationship("DivingCenter", back_populates="dive_trips")
    dives = relationship("ParsedDive", back_populates="trip", cascade="all, delete-orphan")
    
    @property
    def max_depth(self):
        depths = [dive.dive_site.max_depth for dive in self.dives if dive.dive_site and dive.dive_site.max_depth]
        if depths:
            return max(depths)
        return None


class ParsedDive(Base):
    __tablename__ = "parsed_dives"

    id = Column(Integer, primary_key=True)
    trip_id = Column(Integer, ForeignKey("parsed_dive_trips.id", ondelete="CASCADE"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="SET NULL"), index=True)
    dive_number = Column(Integer, nullable=False)  # 1 for first dive, 2 for second dive, etc.
    dive_time = Column(Time, nullable=True)  # Time for this specific dive
    dive_duration = Column(Integer, nullable=True)  # Duration for this specific dive in minutes
    dive_description = Column(Text, nullable=True)  # Description for this specific dive
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    trip = relationship("ParsedDiveTrip", back_populates="dives")
    dive_site = relationship("DiveSite", back_populates="parsed_dives")
    
    @property
    def max_depth(self):
        if self.dive_site:
            return self.dive_site.max_depth
        return None

class Newsletter(Base):
    __tablename__ = "newsletters"

    id = Column(Integer, primary_key=True)
    content = Column(LONGTEXT, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class AvailableTag(Base):
    __tablename__ = "available_tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site_tags = relationship("DiveSiteTag", back_populates="tag", cascade="all, delete-orphan")
    dive_tags = relationship("DiveTag", back_populates="tag", cascade="all, delete-orphan")

class DiveSiteTag(Base):
    __tablename__ = "dive_site_tags"

    id = Column(Integer, primary_key=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("available_tags.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive_site = relationship("DiveSite", back_populates="tags")
    tag = relationship("AvailableTag", back_populates="dive_site_tags")

class DivingCenterOrganization(Base):
    __tablename__ = "diving_center_organizations"

    id = Column(Integer, primary_key=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    diving_organization_id = Column(Integer, ForeignKey("diving_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    diving_center = relationship("DivingCenter", back_populates="organization_relationships")
    diving_organization = relationship("DivingOrganization", back_populates="diving_center_organizations")

class OwnershipRequest(Base):
    __tablename__ = "ownership_requests"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    request_status = Column(Enum(OwnershipStatus), nullable=False, index=True)  # claimed, approved, denied, revoked
    request_date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
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
    certification_level_id = Column(Integer, ForeignKey("certification_levels.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="certifications")
    diving_organization = relationship("DivingOrganization", back_populates="user_certifications")
    certification_level_link = relationship("CertificationLevel", back_populates="user_certifications")

class Dive(Base):
    __tablename__ = "dives"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="SET NULL"), nullable=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="SET NULL"), nullable=True)  # Link to diving center
    name = Column(String(255), nullable=True)  # Custom name/alias provided by user
    is_private = Column(Boolean, default=False)  # Privacy control - default public
    dive_information = Column(Text)
    max_depth = Column(DECIMAL(6, 3))  # Maximum depth in meters
    average_depth = Column(DECIMAL(6, 3))  # Average depth in meters
    gas_bottles_used = Column(Text)
    suit_type = Column(Enum(SuitType), nullable=True)
    difficulty_id = Column(Integer, ForeignKey("difficulty_levels.id", ondelete="SET NULL"), nullable=True, index=True)
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
    selected_route_id = Column(Integer, ForeignKey("dive_routes.id", ondelete="SET NULL"), nullable=True, index=True)  # Selected dive route
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    difficulty = relationship("DifficultyLevel", back_populates="dives")
    user = relationship("User", back_populates="dives")
    dive_site = relationship("DiveSite", back_populates="dives")
    diving_center = relationship("DivingCenter", back_populates="dives")  # New relationship
    selected_route = relationship("DiveRoute", foreign_keys=[selected_route_id])
    media = relationship("DiveMedia", back_populates="dive", cascade="all, delete-orphan")
    tags = relationship("DiveTag", back_populates="dive", cascade="all, delete-orphan")
    buddies = relationship("User", secondary="dive_buddies", back_populates="buddy_dives")

class DiveMedia(Base):
    __tablename__ = "dive_media"

    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id", ondelete="CASCADE"), nullable=False)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(500), nullable=False)
    description = Column(Text)
    title = Column(String(255))  # For external links
    thumbnail_url = Column(String(500))  # For external links
    medium_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive = relationship("Dive", back_populates="media")

class DiveTag(Base):
    __tablename__ = "dive_tags"

    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("available_tags.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive = relationship("Dive", back_populates="tags")
    tag = relationship("AvailableTag", back_populates="dive_tags")


class DiveBuddy(Base):
    __tablename__ = "dive_buddies"

    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dive = relationship("Dive", overlaps="buddies,buddy_dives")
    user = relationship("User", overlaps="buddies,buddy_dives")

    # Unique constraint to prevent duplicate buddies for the same dive
    __table_args__ = (
        sa.UniqueConstraint('dive_id', 'user_id', name='_dive_buddy_uc'),
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(255), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
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
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    route_data = Column(sa.JSON, nullable=False)  # Multi-segment GeoJSON FeatureCollection
    route_type = Column(Enum(RouteType), nullable=False)
    view_count = Column(Integer, default=0, nullable=False)  # Number of views
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # Soft delete fields
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dive_site = relationship("DiveSite", back_populates="routes")
    creator = relationship("User", back_populates="created_routes", foreign_keys=[created_by])
    deleter = relationship("User", foreign_keys=[deleted_by])
    analytics = relationship("RouteAnalytics", back_populates="route", cascade="all, delete-orphan")

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


class RouteAnalytics(Base):
    """Track user interactions with dive routes for analytics"""
    __tablename__ = "route_analytics"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("dive_routes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Nullable for anonymous users
    interaction_type = Column(String(50), nullable=False, index=True)  # view, copy, share, download, export
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    referrer = Column(String(500), nullable=True)
    session_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Additional metadata
    extra_data = Column(sa.JSON, nullable=True)  # Store additional context like export format, etc.

    # Relationships
    route = relationship("DiveRoute")
    user = relationship("User")

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)  # JSON string value
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WindDataCache(Base):
    """
    Database cache for Open-Meteo wind data.

    Provides persistent caching across server restarts and enables shared cache
    across multiple backend instances. Cache entries automatically expire after TTL.
    """
    __tablename__ = "wind_data_cache"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(255), unique=True, nullable=False, index=True)  # Generated cache key (e.g., "wind-37.7-24.0-2025-12-08T09:00:00")
    latitude = Column(DECIMAL(10, 8), nullable=False, index=True)  # Rounded to 0.1° for cache efficiency
    longitude = Column(DECIMAL(11, 8), nullable=False, index=True)  # Rounded to 0.1° for cache efficiency
    target_datetime = Column(DateTime(timezone=True), nullable=True, index=True)  # Target datetime (rounded to hour) or NULL for current time
    wind_data = Column(sa.JSON, nullable=False)  # Cached wind data (wind_speed_10m, wind_direction_10m, wind_gusts_10m, timestamp)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)  # TTL expiration time (created_at + 15 minutes)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Last time this cache entry was accessed

    # Composite index for efficient lookups by location and datetime
    __table_args__ = (
        sa.Index('idx_wind_cache_lat_lon_datetime', 'latitude', 'longitude', 'target_datetime'),
        sa.Index('idx_wind_cache_expires_at', 'expires_at'),
        sa.Index('idx_wind_cache_last_accessed_at', 'last_accessed_at'),
    )


class NotificationPreference(Base):
    """User notification preferences for different categories."""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    enable_website = Column(Boolean, default=True, nullable=False)
    enable_push = Column(Boolean, default=True, nullable=False)
    enable_email = Column(Boolean, default=False, nullable=False)
    frequency = Column(String(20), default="immediate", nullable=False)  # 'immediate', 'daily_digest', 'weekly_digest'
    area_filter = Column(sa.JSON, nullable=True)  # {country, region, radius_km, center_lat, center_lng}
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notification_preferences")

    __table_args__ = (
        sa.UniqueConstraint('user_id', 'category', name='unique_user_category'),
    )


class Notification(Base):
    """Individual notification records for users."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link_url = Column(String(500), nullable=True)
    entity_type = Column(String(50), nullable=True)  # 'dive_site', 'dive', 'diving_center', 'dive_trip'
    entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    email_sent = Column(Boolean, default=False, nullable=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        sa.Index('idx_user_unread', 'user_id', 'is_read', 'created_at'),
        sa.Index('idx_entity', 'entity_type', 'entity_id'),
    )


class EmailConfig(Base):
    """SMTP configuration for email notifications (admin-managed)."""
    __tablename__ = "email_config"

    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String(255), nullable=False)
    smtp_port = Column(Integer, default=587, nullable=False)
    use_starttls = Column(Boolean, default=True, nullable=False)
    smtp_username = Column(String(255), nullable=False)
    smtp_password = Column(String(500), nullable=False)  # Encrypted password
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), default="Divemap", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ApiKey(Base):
    """Long-lived API keys for service authentication (e.g., Lambda functions)."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # Human-readable name (e.g., "Lambda Email Processor")
    key_hash = Column(String(255), nullable=False, unique=True, index=True)  # Hashed API key
    description = Column(Text, nullable=True)  # Optional description
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Admin who created it
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Optional expiration date
    last_used_at = Column(DateTime(timezone=True), nullable=True)  # Track last usage
    is_active = Column(Boolean, nullable=False, server_default='1')  # Can be revoked without deletion
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    __table_args__ = (
        sa.Index('idx_api_key_hash', 'key_hash'),
        sa.Index('idx_api_key_active', 'is_active'),
        sa.Index('idx_api_key_expires', 'expires_at'),
    )


class PersonalAccessToken(Base):
    """Personal Access Tokens for user programmatic authentication."""
    __tablename__ = "personal_access_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # e.g., "Python CLI", "Dev Machine"
    token_prefix = Column(String(16), nullable=False, index=True)  # First 12-16 chars for lookup
    token_hash = Column(String(255), nullable=False, unique=True, index=True)  # Bcrypt hash
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default='1')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        sa.Index('idx_pat_user_id', 'user_id'),
        sa.Index('idx_pat_token_hash', 'token_hash'),
        sa.Index('idx_pat_prefix', 'token_prefix'),
        sa.Index('idx_pat_active', 'is_active'),
        sa.Index('idx_pat_expires', 'expires_at'),
    )


class EmailVerificationToken(Base):
    """Email verification tokens for user email validation."""
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="email_verification_tokens")

    __table_args__ = (
        sa.Index('idx_email_verification_token', 'token'),
        sa.Index('idx_email_verification_user', 'user_id'),
        sa.Index('idx_email_verification_expires', 'expires_at'),
    )


class UnsubscribeToken(Base):
    """Unsubscribe tokens for email notification opt-out (one token per user, reusable)."""
    __tablename__ = "unsubscribe_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)  # Track last usage (token is reusable)
    previous_preferences = Column(sa.JSON, nullable=True)  # Store previous preference state before unsubscribe (for restoration)

    # Relationships
    user = relationship("User", back_populates="unsubscribe_token")

    __table_args__ = (
        sa.Index('idx_unsubscribe_token', 'token'),
        sa.Index('idx_unsubscribe_user', 'user_id'),
        sa.Index('idx_unsubscribe_expires', 'expires_at'),
    )


class PasswordResetToken(Base):
    """Tokens for password reset functionality."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(45), nullable=True)  # For audit and rate limiting

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

    __table_args__ = (
        sa.Index('idx_password_reset_token_hash', 'token_hash'),
        sa.Index('idx_password_reset_user', 'user_id'),
        sa.Index('idx_password_reset_expires', 'expires_at'),
    )


class ChatFeedback(Base):
    """
    User feedback for chatbot responses.
    Used for tuning prompts and identifying data gaps.
    """
    __tablename__ = "chat_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    message_id = Column(String(50), nullable=True, index=True) # UUID from frontend
    query = Column(Text, nullable=True) # The user's question
    response = Column(Text, nullable=True) # The bot's answer
    debug_data = Column(sa.JSON, nullable=True) # Intent, sources, weather etc.
    rating = Column(Boolean, nullable=False) # True=Up, False=Down
    category = Column(String(50), nullable=True) # "accuracy", "tone", "safety"
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User")

class ChatSession(Base):
    """
    Groups chat messages into a single session.
    """
    __tablename__ = "chat_sessions"

    id = Column(String(50), primary_key=True, index=True) # UUID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    """
    Individual chat messages within a session.
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum('user', 'assistant', 'system', name='chat_role'), nullable=False)
    content = Column(Text, nullable=False)
    debug_data = Column(sa.JSON, nullable=True) # Intent, search results, etc.
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    tokens_cached = Column(Integer, nullable=True)
    tokens_total = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

# -----------------------------------------------------------------------------
# User-to-User Chat Subsystem Models
# -----------------------------------------------------------------------------

class UserFriendship(Base):
    """
    Represents a friendship/buddy relationship between two users.
    Used to control who can initiate chats.
    """
    __tablename__ = "user_friendships"

    id = Column(Integer, primary_key=True, index=True)
    # To prevent duplicates, we enforce user_id < friend_id in logic
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="PENDING", nullable=False) # 'PENDING', 'ACCEPTED', 'REJECTED'
    initiator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False) # Who sent the request
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Unique constraint
    __table_args__ = (
        sa.UniqueConstraint('user_id', 'friend_id', name='_user_friendship_uc'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])
    initiator = relationship("User", foreign_keys=[initiator_id])

import uuid

def generate_uuid():
    return str(uuid.uuid4())

class UserChatRoom(Base):
    """
    Represents a 1-on-1 or Group chat room between users.
    """
    __tablename__ = "user_chat_rooms"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    is_group = Column(Boolean, default=False, nullable=False)
    name = Column(String(100), nullable=True) # Optional name for group chats
    encrypted_dek = Column(Text, nullable=False) # Envelope-encrypted Room Key
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # B2C Additions
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=True)
    is_broadcast = Column(Boolean, default=False, nullable=False)
    business_status = Column(Enum(BusinessChatStatus), default=BusinessChatStatus.UNREAD, nullable=False)
    last_responded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    members = relationship("UserChatRoomMember", back_populates="room", cascade="all, delete-orphan")
    messages = relationship("UserChatMessage", back_populates="room", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])
    diving_center = relationship("DivingCenter", backref="chat_rooms")
    last_responded_by = relationship("User", foreign_keys=[last_responded_by_id])

class UserChatRoomMember(Base):
    """
    Mapping of Users to UserChatRooms, including access control and read receipts.
    """
    __tablename__ = "user_chat_room_members"

    room_id = Column(String(36), ForeignKey("user_chat_rooms.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(20), default="MEMBER", nullable=False) # 'ADMIN' or 'MEMBER'
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    left_at = Column(DateTime(timezone=True), nullable=True) # If set, user has left/been removed
    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    room = relationship("UserChatRoom", back_populates="members")
    user = relationship("User")

class UserChatMessage(Base):
    """
    Encrypted messages within a UserChatRoom.
    """
    __tablename__ = "user_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String(36), ForeignKey("user_chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(LargeBinary, nullable=False) # The Fernet-encrypted ciphertext
    message_type = Column(String(50), default="TEXT", nullable=False) # TEXT, TRIP_AD, etc.
    is_edited = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Indexes
    # Composite index for optimized cursor-based polling: (room_id, updated_at)
    __table_args__ = (
        sa.Index("idx_chat_messages_room_updated", "room_id", "updated_at"),
    )

    # Relationships
    room = relationship("UserChatRoom", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(String(2048), nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    fail_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="push_subscriptions")

class DivingCenterChatSettings(Base):
    __tablename__ = "diving_center_chat_settings"

    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), primary_key=True)
    auto_greeting = Column(Text, nullable=True)
    quick_replies = Column(sa.JSON, nullable=True) # Array of strings
    
    diving_center = relationship("DivingCenter", backref=sa.orm.backref("chat_settings", uselist=False, cascade="all, delete-orphan"))

class DivingCenterFollower(Base):
    __tablename__ = "diving_center_followers"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserGearProfile(Base):
    __tablename__ = "user_gear_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, default="Default") # e.g. "Default", "Tropical 3mm", "Cold Water 7mm"
    is_default = Column(Boolean, default=False, nullable=False)

    preferred_unit_system = Column(String(10), default="METRIC", nullable=False) # METRIC vs IMPERIAL
    preferred_shoe_system = Column(String(10), default="EU", nullable=False)     # EU, US_MEN, US_WOMEN, UK

    height_cm = Column(Integer, nullable=True) # Stored canonically in cm
    weight_kg = Column(Integer, nullable=True) # Stored canonically in kg
    shoe_size_eu = Column(DECIMAL(3, 1), nullable=True) # Stored canonically in EU

    wetsuit_gender = Column(String(10), nullable=True)   # MEN, WOMEN, UNISEX
    wetsuit_size = Column(String(10), nullable=True)     # XS, S, M, ML, L, XL, XXL
    wetsuit_thickness = Column(String(10), default="5mm", nullable=True) # 3mm, 5mm, 7mm
    bcd_size = Column(String(10), nullable=True)         # XS, S, M, L, XL
    fin_type = Column(String(20), default="OPEN_HEEL", nullable=True)   # FULL_FOOT, OPEN_HEEL
    regulator_fitting = Column(String(10), default="DIN", nullable=True) # DIN, YOKE

    preferred_tank_id = Column(String(20), default="12", nullable=True) # Re-uses TANK_SIZES ID
    preferred_gas_mix_id = Column(String(20), default="air", nullable=True) # Re-uses GAS_MIXES ID
    estimated_lead_kg = Column(DECIMAL(4, 1), nullable=True)

    has_own_dive_computer = Column(Boolean, default=False, nullable=False)
    has_own_smb = Column(Boolean, default=False, nullable=False)

    insurance_provider = Column(String(100), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    insurance_expiry_date = Column(Date, nullable=True)

    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_relation = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        sa.UniqueConstraint("user_id", "name", name="uq_user_gear_profiles_user_name"),
    )

    user = relationship("User", backref=sa.orm.backref("gear_profiles", cascade="all, delete-orphan"))


class DivingCenterBookingSettings(Base):
    __tablename__ = "diving_center_booking_settings"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    is_booking_enabled = Column(Boolean, default=True, nullable=False)
    default_currency = Column(String(3), default="EUR", nullable=False)
    payment_mode = Column(String(30), default="PAY_ON_ARRIVAL", nullable=False) # PAY_ON_ARRIVAL, DEPOSIT_ONLY, FULL_ONLINE
    deposit_percentage = Column(DECIMAL(5, 2), default=0.00, nullable=False)
    default_agency_bundle = Column(String(50), default="UNIVERSAL_DMSC", nullable=False) # PADI, SSI, GUE, UNIVERSAL_DMSC
    preferred_unit_system = Column(String(10), default="METRIC", nullable=False) # METRIC vs IMPERIAL
    preferred_shoe_system = Column(String(10), default="EU", nullable=False)     # EU, US, UK
    hold_duration_minutes = Column(Integer, default=20, nullable=False)
    briefing_lead_hours = Column(Integer, default=24, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    center = relationship("DivingCenter", backref=sa.orm.backref("booking_settings", uselist=False, cascade="all, delete-orphan"))


class DivingCenterVessel(Base):
    __tablename__ = "diving_center_vessels"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    registration_number = Column(String(100), nullable=True)
    port_of_registry = Column(String(100), nullable=True)
    call_sign = Column(String(50), nullable=True)
    licensed_capacity = Column(Integer, default=12, nullable=False)

    has_emergency_oxygen = Column(Boolean, default=True, nullable=False)
    has_first_aid_kit = Column(Boolean, default=True, nullable=False)
    has_vhf_radio = Column(Boolean, default=True, nullable=False)
    has_lifejackets = Column(Boolean, default=True, nullable=False)
    has_liferaft = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    center = relationship("DivingCenter", backref=sa.orm.backref("vessels", cascade="all, delete-orphan"))


class OctoProduct(Base):
    __tablename__ = "octo_products"

    id = Column(String(36), primary_key=True) # UUID
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    product_type = Column(String(50), default="GUIDED_BOAT_TRIP", nullable=False) # GUIDED_BOAT_TRIP, GUIDED_SHORE_TRIP, COURSE, TRY_DIVE_DSD
    agency_code = Column(String(50), nullable=True) # PADI, SSI, GUE, CMAS (optional override)
    waiver_bundle_id = Column(String(50), default="dmsc_recreational", nullable=False)
    min_certification_level_id = Column(Integer, ForeignKey("certification_levels.id", ondelete="SET NULL"), nullable=True)
    min_logged_dives = Column(Integer, default=0, nullable=False)
    max_depth_meters = Column(DECIMAL(5, 2), nullable=True)
    min_participants = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    center = relationship("DivingCenter", backref=sa.orm.backref("octo_products", cascade="all, delete-orphan"))
    dive_site = relationship("DiveSite", backref=sa.orm.backref("octo_products", cascade="all, delete-orphan"))
    min_certification = relationship("CertificationLevel")


class OctoOption(Base):
    __tablename__ = "octo_options"

    id = Column(String(36), primary_key=True) # UUID
    product_id = Column(String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False) # e.g. "08:30 Departure"
    meeting_time = Column(Time, nullable=False)
    departure_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, default=240, nullable=False)
    max_capacity = Column(Integer, default=12, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    product = relationship("OctoProduct", backref=sa.orm.backref("options", cascade="all, delete-orphan"))


class OctoUnit(Base):
    __tablename__ = "octo_units"

    id = Column(String(36), primary_key=True) # UUID
    product_id = Column(String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_type = Column(String(50), nullable=False) # DIVER_OWN_GEAR, DIVER_RENTAL_GEAR, PASSENGER_SNORKELER
    title = Column(String(255), nullable=False)
    retail_price = Column(DECIMAL(10, 2), nullable=False)
    net_price = Column(DECIMAL(10, 2), nullable=True)
    currency = Column(String(3), default="EUR", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    product = relationship("OctoProduct", backref=sa.orm.backref("units", cascade="all, delete-orphan"))


class OctoAvailabilitySlot(Base):
    __tablename__ = "octo_availability_slots"

    id = Column(String(36), primary_key=True) # UUID
    product_id = Column(String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
    option_id = Column(String(36), ForeignKey("octo_options.id", ondelete="CASCADE"), nullable=False, index=True)
    vessel_id = Column(Integer, ForeignKey("diving_center_vessels.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_guide_user_ids = Column(sa.JSON, nullable=True) # List of user IDs
    start_datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    seats_total = Column(Integer, nullable=False)
    seats_available = Column(Integer, nullable=False)
    is_closed = Column(Boolean, default=False, nullable=False)

    product = relationship("OctoProduct", backref=sa.orm.backref("availability_slots", cascade="all, delete-orphan"))
    option = relationship("OctoOption", backref=sa.orm.backref("availability_slots", cascade="all, delete-orphan"))
    vessel = relationship("DivingCenterVessel", backref=sa.orm.backref("availability_slots"))


class OctoBooking(Base):
    __tablename__ = "octo_bookings"

    uuid = Column(String(36), primary_key=True) # OCTO UUID
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
    option_id = Column(String(36), ForeignKey("octo_options.id", ondelete="CASCADE"), nullable=False, index=True)
    availability_id = Column(String(36), ForeignKey("octo_availability_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True) # Lead booker (nullable for guest/walk-in)

    contact_full_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)

    status = Column(String(30), default="ON_HOLD", nullable=False, index=True) # ON_HOLD, CONFIRMED, CANCELLED, COMPLETED
    utc_hold_expiration = Column(DateTime(timezone=True), nullable=True)
    payment_mode = Column(String(30), default="PAY_ON_ARRIVAL", nullable=False)
    payment_status = Column(String(30), default="PENDING_AT_CHECKIN", nullable=False) # PENDING_AT_CHECKIN, PAID_IN_FULL, REFUNDED
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    currency = Column(String(3), default="EUR", nullable=False)
    booking_notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    center = relationship("DivingCenter", backref=sa.orm.backref("octo_bookings", cascade="all, delete-orphan"))
    product = relationship("OctoProduct", backref=sa.orm.backref("bookings", cascade="all, delete-orphan"))
    option = relationship("OctoOption", backref=sa.orm.backref("bookings", cascade="all, delete-orphan"))
    slot = relationship("OctoAvailabilitySlot", backref=sa.orm.backref("bookings", cascade="all, delete-orphan"))
    user = relationship("User", backref=sa.orm.backref("octo_bookings"))


class OctoBookingUnitItem(Base):
    __tablename__ = "octo_booking_unit_items"

    id = Column(String(36), primary_key=True) # UUID
    booking_uuid = Column(String(36), ForeignKey("octo_bookings.uuid", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("octo_units.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    diver_full_name = Column(String(255), nullable=False)
    diver_email = Column(String(255), nullable=True)
    diver_phone = Column(String(50), nullable=True)
    diver_nationality = Column(String(100), nullable=True)
    passport_number = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=True)

    certification_agency = Column(String(50), nullable=True)
    certification_level = Column(String(100), nullable=True)
    certification_number = Column(String(100), nullable=True)
    total_logged_dives = Column(Integer, default=0, nullable=False)
    date_of_last_dive = Column(Date, nullable=True)

    selected_tank_id = Column(String(20), default="12", nullable=True)
    selected_gas_mix_id = Column(String(20), default="air", nullable=True)
    equipment_sizing = Column(sa.JSON, nullable=True)

    waiver_id = Column(String(100), nullable=True)
    waivers_complete = Column(Boolean, default=False, nullable=False)
    signed_waiver_path = Column(String(500), nullable=True)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    onboard_checkin_status = Column(Boolean, default=False, nullable=False)

    booking = relationship("OctoBooking", backref=sa.orm.backref("unit_items", cascade="all, delete-orphan"))
    unit = relationship("OctoUnit", backref=sa.orm.backref("booking_items"))
    user = relationship("User", backref=sa.orm.backref("booking_items"))


class DiverMedicalRecord(Base):
    __tablename__ = "diver_medical_records"

    id = Column(Integer, primary_key=True, index=True)
    booking_unit_item_id = Column(String(36), ForeignKey("octo_booking_unit_items.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    status = Column(String(30), default="PENDING", nullable=False) # CLEARED, FLAGGED_CONTACT_CENTER, PHYSICIAN_APPROVED
    encrypted_dek = Column(Text, nullable=False)
    encrypted_answers = Column(LargeBinary, nullable=False)
    physician_clearance_file_path = Column(String(500), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    audit_signature_hash = Column(String(64), nullable=True)

    cleared_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    cleared_at = Column(DateTime(timezone=True), nullable=True)
    cleared_reason = Column(Text, nullable=True)
    cleared_physician_name = Column(String(255), nullable=True)
    cleared_physician_clinic = Column(String(255), nullable=True)

    modified_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    modified_at = Column(DateTime(timezone=True), nullable=True)
    modification_reason = Column(Text, nullable=True)
    modification_history = Column(sa.JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    unit_item = relationship("OctoBookingUnitItem", backref=sa.orm.backref("medical_record", uselist=False, cascade="all, delete-orphan"))
    user = relationship("User", foreign_keys=[user_id], backref=sa.orm.backref("medical_records"))
    cleared_by_user = relationship("User", foreign_keys=[cleared_by_user_id])
    modified_by_user = relationship("User", foreign_keys=[modified_by_user_id])

