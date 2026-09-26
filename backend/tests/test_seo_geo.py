"""Unit tests for SEO geo-hub helpers and substantial-dive filtering."""
from datetime import date

import pytest

from app.models import Dive, DiveMedia, MediaType, User
from app.seo_geo import (
    dive_has_profile,
    geo_hub_path,
    geo_slug,
    is_substantial_public_dive,
    resolve_label_from_slug,
)


def test_geo_slug_basic():
    assert geo_slug("Greece") == "greece"
    assert geo_slug("East Attica") == "east-attica"
    assert geo_slug("") == ""
    assert geo_slug(None) == ""


def test_geo_hub_path():
    assert geo_hub_path("Greece") == "/dive-sites/greece"
    assert geo_hub_path("Greece", "East Attica") == "/dive-sites/greece/east-attica"
    assert geo_hub_path(None) is None


def test_resolve_label_from_slug():
    assert resolve_label_from_slug(["Greece", "Egypt"], "greece") == "Greece"
    assert resolve_label_from_slug(["Greece"], "egypt") is None


def test_substantial_dive_notes(db_session):
    user = User(
        id=9001,
        username="subtester",
        email="sub@test.com",
        password_hash="x",
        enabled=True,
    )
    db_session.add(user)
    db_session.commit()

    thin = Dive(
        user_id=user.id,
        name="Thin",
        is_private=False,
        dive_information="short",
        dive_date=date(2026, 1, 1),
    )
    rich = Dive(
        user_id=user.id,
        name="Rich",
        is_private=False,
        dive_information="x" * 100,
        dive_date=date(2026, 1, 2),
    )
    profiled = Dive(
        user_id=user.id,
        name="Profiled",
        is_private=False,
        dive_information="",
        profile_sample_count=10,
        dive_date=date(2026, 1, 3),
    )
    db_session.add_all([thin, rich, profiled])
    db_session.commit()

    assert not is_substantial_public_dive(thin)
    assert is_substantial_public_dive(rich)
    assert dive_has_profile(profiled)
    assert is_substantial_public_dive(profiled)


def test_substantial_dive_with_media(db_session):
    user = db_session.query(User).filter_by(username="subtester").first()
    if not user:
        user = User(
            id=9002,
            username="subtester2",
            email="sub2@test.com",
            password_hash="x",
            enabled=True,
        )
        db_session.add(user)
        db_session.commit()

    dive = Dive(
        user_id=user.id,
        name="With photo",
        is_private=False,
        dive_information="",
        dive_date=date(2026, 1, 4),
    )
    db_session.add(dive)
    db_session.commit()
    media = DiveMedia(
        dive_id=dive.id,
        media_type=MediaType.photo,
        url="https://example.com/p.jpg",
    )
    db_session.add(media)
    db_session.commit()
    db_session.refresh(dive)

    assert is_substantial_public_dive(dive)
