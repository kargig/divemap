import pytest

from app.models import Dive
from app.routers.dives.imports.subsurface import convert_to_divemap_format


def test_subsurface_gps_parsing_to_lat_lng():
    # Test space-separated GPS
    dive_sites = {
        "site1": {
            "name": "Custom Spot",
            "gps": "37.8812 23.7548",
        }
    }
    res = convert_to_divemap_format(
        dive_number=1,
        rating=None,
        visibility=None,
        sac=None,
        otu=None,
        cns=None,
        tags=None,
        divesiteid="site1",
        dive_date="2026-10-12",
        dive_time="10:00:00",
        duration="45 min",
        buddy=None,
        suit=None,
        cylinders=[],
        weights=None,
        computer_data={},
        dive_sites=dive_sites,
        db=None,
        events=[],
        site_match_cache={},
    )
    assert res["dive_site_id"] is None
    unmatched = res["unmatched_dive_site"]
    assert unmatched is not None
    assert unmatched["name"] == "Custom Spot"
    assert unmatched["gps"] == "37.8812 23.7548"
    assert unmatched["latitude"] == pytest.approx(37.8812)
    assert unmatched["longitude"] == pytest.approx(23.7548)

    # Test comma-separated GPS
    dive_sites_comma = {
        "site2": {
            "name": "Comma Spot",
            "gps": "37.8812, 23.7548",
        }
    }
    res_comma = convert_to_divemap_format(
        dive_number=2,
        rating=None,
        visibility=None,
        sac=None,
        otu=None,
        cns=None,
        tags=None,
        divesiteid="site2",
        dive_date="2026-10-12",
        dive_time="10:00:00",
        duration="45 min",
        buddy=None,
        suit=None,
        cylinders=[],
        weights=None,
        computer_data={},
        dive_sites=dive_sites_comma,
        db=None,
        events=[],
        site_match_cache={},
    )
    unmatched_comma = res_comma["unmatched_dive_site"]
    assert unmatched_comma["latitude"] == pytest.approx(37.8812)
    assert unmatched_comma["longitude"] == pytest.approx(23.7548)


def test_confirm_import_persists_unlinked_site_name(client, auth_headers, db_session):
    dives = [
        {
            "dive_site_id": None,
            "unlinked_site_name": "Shark Reef & Yolanda",
            "is_private": False,
            "dive_date": "2026-10-12",
            "duration": 45,
            "max_depth": 25.0,
        }
    ]

    resp = client.post("/api/v1/dives/import/confirm", json=dives, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data["imported_dives"]) == 1
    imported = data["imported_dives"][0]
    assert imported["dive_site_id"] is None
    assert imported["unlinked_site_name"] == "Shark Reef & Yolanda"
    assert "Shark Reef & Yolanda" in imported["name"]

    # Verify directly from DB
    dive = db_session.query(Dive).filter(Dive.id == imported["id"]).first()
    assert dive is not None
    assert dive.dive_site_id is None
    assert dive.unlinked_site_name == "Shark Reef & Yolanda"
