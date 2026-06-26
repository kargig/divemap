import pytest
from fastapi import status
from app.models import Dive, AvailableTag, DiveTag, DiveSite

def test_user_advanced_analytics_extensions(client, db_session, test_user, user_token):
    # Setup test tags
    reef_tag = db_session.query(AvailableTag).filter(AvailableTag.name == "Reef").first()
    if not reef_tag:
        reef_tag = AvailableTag(name="Reef")
        db_session.add(reef_tag)
    
    wreck_tag = db_session.query(AvailableTag).filter(AvailableTag.name == "Wreck").first()
    if not wreck_tag:
        wreck_tag = AvailableTag(name="Wreck")
        db_session.add(wreck_tag)
        
    db_session.commit()

    # Create dummy dive site with country
    site = DiveSite(
        name="Test Greek Reef",
        latitude=37.98,
        longitude=23.72,
        country="Greece",
        location="POINT(23.72 37.98)"
    )
    db_session.add(site)
    db_session.flush()

    # Create dummy dives
    dive1 = Dive(
        user_id=test_user.id,
        dive_site_id=site.id,
        max_depth=15.0,
        average_depth=10.0,
        duration=45,
        dive_date="2026-06-01",
        is_private=False,
        gas_bottles_used='{"mode": "structured", "back_gas": {"tank": "12", "start_pressure": 200, "end_pressure": 50, "gas": {"o2": 32, "he": 0}}}'
    )
    db_session.add(dive1)
    db_session.flush()

    # Assign tags
    db_session.add(DiveTag(dive_id=dive1.id, tag_id=reef_tag.id))
    db_session.add(DiveTag(dive_id=dive1.id, tag_id=wreck_tag.id))
    db_session.commit()

    # Test Advanced Analytics Endpoint
    response = client.get(
        f"/api/v1/users/{test_user.username}/analytics",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Assert radar style contains expected subjects
    assert "dive_style_radar" in data
    subjects = [item["subject"] for item in data["dive_style_radar"]]
    assert "Reef & Eco" in subjects
    assert "Wreck & History" in subjects
    
    # Assert gas mix heatmap has mapped nitrox bin
    assert "gas_mix_heatmap" in data
    assert len(data["gas_mix_heatmap"]) > 0

    # Assert country distribution aggregation
    assert "country_distribution" in data
    countries = [item["country"] for item in data["country_distribution"]]
    assert "Greece" in countries

    # Test Public Profile Stats Endpoint
    profile_response = client.get(
        f"/api/v1/users/{test_user.username}/public",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert profile_response.status_code == status.HTTP_200_OK
    profile_data = profile_response.json()
    assert "stats" in profile_data
    assert "countries_visited_count" in profile_data["stats"]
    assert profile_data["stats"]["countries_visited_count"] == 1
