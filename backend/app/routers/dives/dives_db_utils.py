"""
Database utilities for dives modules.

This module contains common database operations and utilities
that are shared across multiple dives modules.
"""

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Dive, DiveSite


def get_dive_site_by_id(db: Session, dive_site_id: int) -> DiveSite | None:
    """Get dive site by ID with error handling."""
    return db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()


def get_dive_by_id(db: Session, dive_id: int) -> Dive | None:
    """Get dive by ID with error handling."""
    return db.query(Dive).filter(Dive.id == dive_id).first()


def get_dive_with_relations(db: Session, dive_id: int) -> Dive | None:
    """Get dive by ID with all relations loaded."""
    return (
        db.query(Dive)
        .options(
            joinedload(Dive.dive_site),
            selectinload(Dive.tags),
            selectinload(Dive.media),
        )
        .filter(Dive.id == dive_id)
        .first()
    )
