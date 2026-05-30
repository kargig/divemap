import pytest
from fastapi import status

def test_dive_sites_pagination_validation(client):
    """Test that dive sites API accepts smaller page sizes."""
    # Test valid small page sizes
    for size in [1, 3, 5, 10]:
        response = client.get(f"/api/v1/dive-sites/?page_size={size}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["items"]) <= size

    # Test invalid page size
    response = client.get("/api/v1/dive-sites/?page_size=7")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "page_size must be one of" in response.json()["detail"]

def test_diving_centers_pagination_validation(client):
    """Test that diving centers API accepts smaller page sizes."""
    for size in [1, 3, 5, 10]:
        response = client.get(f"/api/v1/diving-centers/?page_size={size}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["items"]) <= size

    response = client.get("/api/v1/diving-centers/?page_size=7")
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_dives_pagination_validation(client, auth_headers):
    """Test that dives API accepts smaller page sizes."""
    for size in [1, 3, 5, 10]:
        response = client.get(
            f"/api/v1/dives/?page_size={size}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()["items"]) <= size

    response = client.get(
        "/api/v1/dives/?page_size=7",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_users_pagination_validation(client, admin_headers):
    """Test that users admin API accepts smaller page sizes."""
    for size in [1, 3, 5, 10]:
        response = client.get(
            f"/api/v1/users/admin/users?page_size={size}",
            headers=admin_headers
        )
        assert response.status_code == status.HTTP_200_OK
        # Might have fewer users in test DB
        assert len(response.json()) <= size

    response = client.get(
        "/api/v1/users/admin/users?page_size=7",
        headers=admin_headers
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
