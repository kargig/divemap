"""Shared SEO geo-hub helpers: slugs, path builders, dive-log substance checks."""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional

from sqlalchemy.orm import Session, joinedload

from app.models import Dive, DiveSite, User


def geo_slug(text: Optional[str]) -> str:
    """URL slug for a country or region name (ASCII, hyphenated)."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("utf-8")
    text = text.lower().strip()
    text = re.sub(r"[\s\W-]+", "-", text)
    return text.strip("-")


def resolve_label_from_slug(candidates: Iterable[str], slug: str) -> Optional[str]:
    """Return the first candidate whose geo_slug matches slug (case-insensitive path)."""
    if not slug:
        return None
    target = slug.lower().strip()
    for value in candidates:
        if value and geo_slug(value) == target:
            return value
    return None


def geo_hub_path(country: Optional[str], region: Optional[str] = None) -> Optional[str]:
    """Build /dive-sites/{country}[/{region}] path, or None if country missing."""
    c = geo_slug(country)
    if not c:
        return None
    r = geo_slug(region) if region else ""
    if r:
        return f"/dive-sites/{c}/{r}"
    return f"/dive-sites/{c}"


def distinct_approved_countries(db: Session) -> list[str]:
    rows = (
        db.query(DiveSite.country)
        .filter(
            DiveSite.status == "approved",
            DiveSite.deleted_at.is_(None),
            DiveSite.country.isnot(None),
            DiveSite.country != "",
        )
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


def distinct_approved_regions(db: Session, country: str) -> list[str]:
    rows = (
        db.query(DiveSite.region)
        .filter(
            DiveSite.status == "approved",
            DiveSite.deleted_at.is_(None),
            DiveSite.country == country,
            DiveSite.region.isnot(None),
            DiveSite.region != "",
        )
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


def dive_has_profile(dive: Dive) -> bool:
    if dive.profile_xml_path:
        return True
    if dive.profile_sample_count and dive.profile_sample_count > 0:
        return True
    return False


def dive_notes_len(dive: Dive) -> int:
    if not dive.dive_information:
        return 0
    return len(dive.dive_information.strip())


def is_substantial_public_dive(dive: Dive) -> bool:
    """
    Substantial = dive profile OR notes >= 100 chars OR >= 1 media item.
    Caller must ensure dive is public and user is eligible.
    """
    if dive_has_profile(dive):
        return True
    if dive_notes_len(dive) >= 100:
        return True
    if dive.media and len(dive.media) > 0:
        return True
    return False


def query_substantial_public_dives(db: Session) -> list[Dive]:
    """Public dives from enabled users that meet substance criteria (for sitemap)."""
    dives = (
        db.query(Dive)
        .options(joinedload(Dive.media), joinedload(Dive.user), joinedload(Dive.dive_site))
        .join(User, Dive.user_id == User.id)
        .filter(
            Dive.is_private == False,  # noqa: E712
            User.enabled == True,  # noqa: E712
        )
        .all()
    )
    return [d for d in dives if is_substantial_public_dive(d)]
