import pytest
from fastapi import status

def test_add_social_link_success(client, test_user, auth_headers):
    payload = {
        "platform": "instagram",
        "url": "https://instagram.com/divemap_user"
    }
    response = client.post("/api/v1/users/me/social-links", json=payload, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["platform"] == "instagram"
    assert data["url"] == "https://instagram.com/divemap_user"

def test_add_social_link_invalid_platform(client, test_user, auth_headers):
    payload = {
        "platform": "myspace",
        "url": "https://myspace.com/user"
    }
    response = client.post("/api/v1/users/me/social-links", json=payload, headers=auth_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

def test_add_social_link_http_not_allowed(client, test_user, auth_headers):
    payload = {
        "platform": "facebook",
        "url": "http://facebook.com/user"
    }
    response = client.post("/api/v1/users/me/social-links", json=payload, headers=auth_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "must start with https://" in response.text

def test_add_social_link_phone_number_not_allowed(client, test_user, auth_headers):
    payload = {
        "platform": "whatsapp",
        "url": "https://wa.me/1234567890"
    }
    response = client.post("/api/v1/users/me/social-links", json=payload, headers=auth_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "cannot contain phone numbers" in response.text

def test_add_social_link_invalid_domain(client, test_user, auth_headers):
    payload = {
        "platform": "x",
        "url": "https://malicious.com/user"
    }
    response = client.post("/api/v1/users/me/social-links", json=payload, headers=auth_headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "Invalid domain for x" in response.text

def test_get_public_profile_with_social_links(client, test_user, auth_headers):
    # Add a link
    client.post("/api/v1/users/me/social-links", json={
        "platform": "instagram",
        "url": "https://instagram.com/divemap_user"
    }, headers=auth_headers)
    
    # Get public profile
    response = client.get(f"/api/v1/users/{test_user.username}/public")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "social_links" in data
    assert len(data["social_links"]) == 1
    assert data["social_links"][0]["platform"] == "instagram"

def test_remove_social_link(client, test_user, auth_headers):
    # Add a link
    client.post("/api/v1/users/me/social-links", json={
        "platform": "instagram",
        "url": "https://instagram.com/divemap_user"
    }, headers=auth_headers)
    
    # Remove it
    response = client.delete("/api/v1/users/me/social-links/instagram", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    
    # Verify it's gone from public profile
    response = client.get(f"/api/v1/users/{test_user.username}/public")
    data = response.json()
    assert len(data["social_links"]) == 0