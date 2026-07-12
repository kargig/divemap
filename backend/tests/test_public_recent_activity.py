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
