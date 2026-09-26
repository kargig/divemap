"""Shared SEO geo-hub helpers: slugs, path builders, dive-log substance checks."""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import Dive, DiveMedia, DiveSite, DiveSiteList, DiveSiteListItem, User


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


def distinct_approved_regions_by_country(db: Session) -> dict[str, list[str]]:
    """All approved (country → regions) in one query (avoids N+1 in sitemap gen)."""
    rows = (
        db.query(DiveSite.country, DiveSite.region)
        .filter(
            DiveSite.status == "approved",
            DiveSite.deleted_at.is_(None),
            DiveSite.country.isnot(None),
            DiveSite.country != "",
            DiveSite.region.isnot(None),
            DiveSite.region != "",
        )
        .distinct()
        .all()
    )
    by_country: dict[str, set[str]] = {}
    for country, region in rows:
        if country and region:
            by_country.setdefault(country, set()).add(region)
    return {country: sorted(regions) for country, regions in sorted(by_country.items())}


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


def query_public_dives(db: Session) -> list[Dive]:
    """All public dives from enabled users (LLM markdown / non-sitemap consumers)."""
    return (
        db.query(Dive)
        .options(joinedload(Dive.user), joinedload(Dive.dive_site))
        .join(User, Dive.user_id == User.id)
        .filter(
            Dive.is_private == False,  # noqa: E712
            User.enabled == True,  # noqa: E712
        )
        .all()
    )


def query_substantial_public_dives(db: Session) -> list[Dive]:
    """Public dives from enabled users that meet substance criteria (for sitemap).

    Substance filters run in SQL so sitemap generation does not load every
    public dive (plus media) into memory.
    """
    has_media = (
        db.query(DiveMedia.id)
        .filter(DiveMedia.dive_id == Dive.id)
        .exists()
    )
    # Match is_substantial_public_dive: profile OR notes >= 100 chars OR media.
    # CHAR_LENGTH matches Python len() on Unicode text under MySQL.
    substantial = or_(
        Dive.profile_xml_path.isnot(None),
        Dive.profile_sample_count > 0,
        func.char_length(func.trim(Dive.dive_information)) >= 100,
        has_media,
    )
    return (
        db.query(Dive)
        .options(joinedload(Dive.user), joinedload(Dive.dive_site))
        .join(User, Dive.user_id == User.id)
        .filter(
            Dive.is_private == False,  # noqa: E712
            User.enabled == True,  # noqa: E712
            substantial,
        )
        .all()
    )


# Minimum dive sites for a public list to earn a sitemap entry (excludes empty
# default "My Favorites" and other thin collections).
MIN_SITEMAP_LIST_ITEMS = 3


def is_substantial_public_list(lst: DiveSiteList) -> bool:
    """
    High-quality public list for sitemap:
    public + shown on profile + at least MIN_SITEMAP_LIST_ITEMS sites.
    Caller must ensure the owner is enabled / not deleted when querying.
    """
    if not lst.is_public or not lst.show_on_profile:
        return False
    item_count = len(lst.items) if lst.items is not None else 0
    return item_count >= MIN_SITEMAP_LIST_ITEMS


def query_substantial_public_lists(db: Session) -> list[DiveSiteList]:
    """Public profile lists with enough sites for sitemap inclusion."""
    qualifying_ids = (
        db.query(DiveSiteListItem.list_id)
        .group_by(DiveSiteListItem.list_id)
        .having(func.count(DiveSiteListItem.id) >= MIN_SITEMAP_LIST_ITEMS)
        .subquery()
    )
    return (
        db.query(DiveSiteList)
        .join(User, DiveSiteList.user_id == User.id)
        .filter(
            DiveSiteList.is_public == True,  # noqa: E712
            DiveSiteList.show_on_profile == True,  # noqa: E712
            DiveSiteList.id.in_(qualifying_ids),
            User.enabled == True,  # noqa: E712
            User.deleted_at.is_(None),
        )
        .options(joinedload(DiveSiteList.user), joinedload(DiveSiteList.items))
        .all()
    )
