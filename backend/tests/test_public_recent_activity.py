import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_get_public_recent_activity(client: TestClient):
    response = client.get("/api/v1/public/recent-activity")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 4
    for item in data:
        # Assert strict PII compliance
        assert "email" not in item
        assert "first_name" not in item
        assert "last_name" not in item
        assert "coordinates" not in item
        assert "event_type" in item
        assert "username" in item
        assert "site_id" in item
        assert "site_name" in item

def test_get_public_recent_activity_with_dive_trip(client: TestClient, db_session):
    from app.models import ParsedDiveTrip
    from datetime import datetime
    
    # Ensure any pre-existing dive trips are cleaned up
    db_session.query(ParsedDiveTrip).delete()
    db_session.commit()
    
    # Create a parsed dive trip
    trip = ParsedDiveTrip(
        trip_date=datetime.utcnow().date(),
        trip_currency="EUR",
        trip_status="scheduled",
        created_at=datetime.utcnow()
    )
    db_session.add(trip)
    db_session.commit()
    
    response = client.get("/api/v1/public/recent-activity")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0, "Activity list should not be empty when a dive trip exists"
    assert data[0]["event_type"] == "trip_added"
