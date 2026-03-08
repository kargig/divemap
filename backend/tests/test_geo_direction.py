import pytest
from app.geo_utils import calculate_directional_bounds, get_empirical_region_bounds
from app.schemas.chat import SearchIntent, IntentType
from app.services.chat import ChatService
from app.services.chat.executors.dispatcher import execute_search_intent
from app.models import DiveSite

def test_calculate_directional_bounds():
    # Athens roughly: N=38.1, S=37.8, E=23.9, W=23.6
    n, s, e, w = 38.0, 37.0, 24.0, 23.0
    mid_lat = 37.5
    mid_lon = 23.5
    
    # South
    res_n, res_s, res_e, res_w = calculate_directional_bounds(n, s, e, w, "south")
    assert res_n == mid_lat
    assert res_s == s
    assert res_e == e
    assert res_w == w
    
    # North
    res_n, res_s, res_e, res_w = calculate_directional_bounds(n, s, e, w, "north")
    assert res_n == n
    assert res_s == mid_lat
    
    # East
    res_n, res_s, res_e, res_w = calculate_directional_bounds(n, s, e, w, "east")
    assert res_e == e
    assert res_w == mid_lon
    
    # West
    res_n, res_s, res_e, res_w = calculate_directional_bounds(n, s, e, w, "west")
    assert res_e == mid_lon
    assert res_w == w

    # SouthEast
    res_n, res_s, res_e, res_w = calculate_directional_bounds(n, s, e, w, "southeast")
    assert res_n == mid_lat
    assert res_s == s
    assert res_e == e
    assert res_w == mid_lon

def test_get_empirical_region_bounds(db_session):
    # Add dummy sites for a specific region
    site1 = DiveSite(name="North Site", region="TestRegion", latitude=38.0, longitude=23.5)
    site2 = DiveSite(name="South Site", region="TestRegion", latitude=37.0, longitude=23.5)
    site3 = DiveSite(name="East Site", region="TestRegion", latitude=37.5, longitude=24.0)
    site4 = DiveSite(name="West Site", region="TestRegion", latitude=37.5, longitude=23.0)
    db_session.add_all([site1, site2, site3, site4])
    db_session.commit()
    
    bounds = get_empirical_region_bounds(db_session, "TestRegion")
    assert bounds is not None
    n, s, e, w = bounds
    # Buffer is 0.05
    assert n == pytest.approx(38.05)
    assert s == pytest.approx(36.95)
    assert e == pytest.approx(24.05)
    assert w == pytest.approx(22.95)

def test_execute_search_with_direction(db_session, monkeypatch):
    from app.services.chat.executors import discovery as discovery_mod
    
    # Mock external bounds to avoid hitting Nominatim and getting USA results
    # Attica roughly: N=38.4, S=37.5, E=24.2, W=22.8
    def mock_get_bounds(region_name):
        return ((38.4, 37.5, 24.2, 22.8), "Attica, Greece")
    
    monkeypatch.setattr(discovery_mod, "get_external_region_bounds", mock_get_bounds)
    
    chat_service = ChatService(db_session)
    
    # Create sites in North and South of Attica
    # Midpoint of Attica mock bounds is 37.95
    site_north = DiveSite(name="Northern Site", region="Attica", latitude=38.2, longitude=23.8)
    site_south = DiveSite(name="Southern Site", region="Attica", latitude=37.7, longitude=23.8)
    db_session.add_all([site_north, site_south])
    db_session.commit()
    
    # Search South of Attica
    intent = SearchIntent(
        intent_type=IntentType.DISCOVERY,
        location="Attica",
        direction="south"
    )
    
    results = execute_search_intent(db_session, intent)
    
    # Should only find the Southern Site
    site_names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    assert "Southern Site" in site_names
    assert "Northern Site" not in site_names

    # Search North of Attica
    intent.direction = "north"
    results = execute_search_intent(db_session, intent)
    site_names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    assert "Northern Site" in site_names
    assert "Southern Site" not in site_names
