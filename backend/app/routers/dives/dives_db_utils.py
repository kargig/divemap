"""
Database utilities for dives modules.

This module contains common database operations and utilities
that are shared across multiple dives modules.
"""

from sqlalchemy.orm import Session
from app.models import Dive, DiveSite, AvailableTag
from .dives_shared import logger


def get_or_create_deco_tag(db: Session) -> AvailableTag:
    """Get or create the 'deco' tag for decompression dives."""
    deco_tag = db.query(AvailableTag).filter(AvailableTag.name == "deco").first()
    if not deco_tag:
        deco_tag = AvailableTag(
            name="deco",
            description="Decompression dive - requires decompression stops"
        )
        db.add(deco_tag)
        db.commit()
        db.refresh(deco_tag)
    return deco_tag


def get_dive_site_by_id(db: Session, dive_site_id: int) -> Optional[DiveSite]:
    """Get dive site by ID with error handling."""
    return db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()


def get_dive_by_id(db: Session, dive_id: int) -> Optional[Dive]:
    """Get dive by ID with error handling."""
    return db.query(Dive).filter(Dive.id == dive_id).first()


def get_dive_with_relations(db: Session, dive_id: int) -> Optional[Dive]:
    """Get dive by ID with all relations loaded."""
    return db.query(Dive).options(
        joinedload(Dive.dive_site),
        joinedload(Dive.tags),
        joinedload(Dive.media)
    ).filter(Dive.id == dive_id).first()
