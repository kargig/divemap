import pytest
from fastapi import status
from app.models import User, DiveSite

def test_detect_shore_direction_permissions(client, db_session, test_user, test_user_other, test_dive_site, auth_headers_other_user):
    """Test that a non-owner can use the shore detection tool."""
    # Ensure user is not the owner
    test_dive_site.created_by = test_user.id
    db_session.commit()
    
    # Coordinates for the Athens area
    test_dive_site.latitude = 37.98
    test_dive_site.longitude = 23.72
    db_session.commit()
    
    # auth_headers_other_user is for test_user_other
    response = client.post(
        f"/api/v1/dive-sites/{test_dive_site.id}/detect-shore-direction",
        headers=auth_headers_other_user
    )
    
    # Should be allowed now (was 403)
    # It might return 404 if no coastline is nearby, but status should not be 403
    assert response.status_code != status.HTTP_403_FORBIDDEN

def test_detect_shore_direction_with_params(client, test_user, test_dive_site, admin_headers):
    """Test using coordinates from query params."""
    # Site has these coordinates
    test_dive_site.latitude = 0.0
    test_dive_site.longitude = 0.0
    
    # We provide these coordinates (Athens area)
    lat, lng = 37.98, 23.72
    
    response = client.post(
        f"/api/v1/dive-sites/{test_dive_site.id}/detect-shore-direction?latitude={lat}&longitude={lng}",
        headers=admin_headers
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "shore_direction" in data
