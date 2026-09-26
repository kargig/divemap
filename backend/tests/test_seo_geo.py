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


def test_geo_slug_diacritics_nfkd():
    """Must match frontend geoHubs.geoSlug (NFKD→ASCII) for hub round-trips."""
    assert geo_slug("São Tomé and Príncipe") == "sao-tome-and-principe"
    assert geo_slug("Côte d'Ivoire") == "cote-d-ivoire"
    assert geo_slug("Réunion") == "reunion"
    assert geo_hub_path("São Tomé and Príncipe") == "/dive-sites/sao-tome-and-principe"
    assert (
        resolve_label_from_slug(["São Tomé and Príncipe"], "sao-tome-and-principe")
        == "São Tomé and Príncipe"
    )


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


def test_query_substantial_public_dives_filters_in_sql(db_session):
    """Thin public dives must not be loaded just to discard them in Python."""
    from app.seo_geo import query_substantial_public_dives

    user = User(
        username="sitemapdives",
        email="sitemapdives@test.com",
        password_hash="x",
        enabled=True,
    )
    db_session.add(user)
    db_session.commit()

    thin = Dive(
        user_id=user.id,
        name="Thin sitemap",
        is_private=False,
        dive_information="short",
        dive_date=date(2026, 2, 1),
    )
    rich = Dive(
        user_id=user.id,
        name="Rich sitemap",
        is_private=False,
        dive_information="y" * 100,
        dive_date=date(2026, 2, 2),
    )
    private_rich = Dive(
        user_id=user.id,
        name="Private rich",
        is_private=True,
        dive_information="z" * 100,
        dive_date=date(2026, 2, 3),
    )
    db_session.add_all([thin, rich, private_rich])
    db_session.commit()

    names = {d.name for d in query_substantial_public_dives(db_session)}
    assert "Rich sitemap" in names
    assert "Thin sitemap" not in names
    assert "Private rich" not in names


def test_distinct_approved_regions_by_country(db_session):
    from app.models import DiveSite
    from app.seo_geo import distinct_approved_regions_by_country

    db_session.add_all(
        [
            DiveSite(
                name="Attica Site",
                latitude=37.9,
                longitude=23.7,
                country="Greece",
                region="East Attica",
                status="approved",
                location="POINT(23.7 37.9)",
            ),
            DiveSite(
                name="Crete Site",
                latitude=35.3,
                longitude=25.1,
                country="Greece",
                region="Crete",
                status="approved",
                location="POINT(25.1 35.3)",
            ),
            DiveSite(
                name="Egypt Site",
                latitude=27.2,
                longitude=33.8,
                country="Egypt",
                region="Red Sea",
                status="approved",
                location="POINT(33.8 27.2)",
            ),
            DiveSite(
                name="Pending Greece",
                latitude=37.0,
                longitude=23.0,
                country="Greece",
                region="Ignored",
                status="pending",
                location="POINT(23.0 37.0)",
            ),
        ]
    )
    db_session.commit()

    by_country = distinct_approved_regions_by_country(db_session)
    assert by_country["Greece"] == ["Crete", "East Attica"]
    assert by_country["Egypt"] == ["Red Sea"]
    assert "Ignored" not in by_country.get("Greece", [])


def test_substantial_public_list_quality(db_session):
    from app.models import DiveSite, DiveSiteList, DiveSiteListItem
    from app.seo_geo import (
        MIN_SITEMAP_LIST_ITEMS,
        is_substantial_public_list,
        query_substantial_public_lists,
    )

    user = User(
        username="listseo",
        email="listseo@test.com",
        password_hash="x",
        enabled=True,
    )
    db_session.add(user)
    db_session.commit()

    sites = []
    for i in range(MIN_SITEMAP_LIST_ITEMS + 1):
        site = DiveSite(
            name=f"List SEO Site {i}",
            latitude=37.0 + i * 0.01,
            longitude=23.0 + i * 0.01,
            country="Greece",
            status="approved",
            location=f"POINT({23.0 + i * 0.01} {37.0 + i * 0.01})",
        )
        sites.append(site)
    db_session.add_all(sites)
    db_session.commit()

    empty_fav = DiveSiteList(
        user_id=user.id,
        title="My Favorites",
        slug="my-favorites",
        is_public=True,
        show_on_profile=True,
        system_type="favorites",
    )
    thin = DiveSiteList(
        user_id=user.id,
        title="Thin List",
        slug="thin-list",
        is_public=True,
        show_on_profile=True,
    )
    rich = DiveSiteList(
        user_id=user.id,
        title="Rich List",
        slug="rich-list",
        is_public=True,
        show_on_profile=True,
    )
    private_rich = DiveSiteList(
        user_id=user.id,
        title="Private Rich",
        slug="private-rich",
        is_public=False,
        show_on_profile=False,
    )
    db_session.add_all([empty_fav, thin, rich, private_rich])
    db_session.commit()

    # One site only → thin
    db_session.add(
        DiveSiteListItem(list_id=thin.id, dive_site_id=sites[0].id, display_order=0)
    )
    # Enough sites → rich
    for i in range(MIN_SITEMAP_LIST_ITEMS):
        db_session.add(
            DiveSiteListItem(list_id=rich.id, dive_site_id=sites[i].id, display_order=i)
        )
    for i in range(MIN_SITEMAP_LIST_ITEMS):
        db_session.add(
            DiveSiteListItem(
                list_id=private_rich.id, dive_site_id=sites[i].id, display_order=i
            )
        )
    db_session.commit()

    db_session.refresh(empty_fav)
    db_session.refresh(thin)
    db_session.refresh(rich)
    db_session.refresh(private_rich)

    assert not is_substantial_public_list(empty_fav)
    assert not is_substantial_public_list(thin)
    assert is_substantial_public_list(rich)
    assert not is_substantial_public_list(private_rich)

    qualifying = {lst.id for lst in query_substantial_public_lists(db_session)}
    assert rich.id in qualifying
    assert empty_fav.id not in qualifying
    assert thin.id not in qualifying
    assert private_rich.id not in qualifying
