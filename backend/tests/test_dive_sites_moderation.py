from fastapi import status

def test_untrusted_user_put_returns_202(client, test_dive_site, auth_headers_other_user, db_session):
    payload = {"description": "Untrusted edit"}
    response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}", json=payload, headers=auth_headers_other_user)
    
    assert response.status_code == status.HTTP_202_ACCEPTED
    assert "submitted for moderation" in response.json()["message"]
    
def test_untrusted_media_addition_returns_202(client, test_dive_site, auth_headers_other_user, db_session):
    payload = {"media_type": "photo", "url": "http://example.com/img.jpg"}
    response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/media", json=payload, headers=auth_headers_other_user)
    assert response.status_code == status.HTTP_202_ACCEPTED


def test_trusted_user_put_returns_200(client, test_dive_site, admin_headers, db_session):
    payload = {"description": "Trusted admin edit", "difficulty_code": "ADVANCED_OPEN_WATER"}
    response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}", json=payload, headers=admin_headers)
    
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["description"] == "Trusted admin edit"
    
    # Verify DB was changed immediately
    db_session.refresh(test_dive_site)
    assert test_dive_site.description == "Trusted admin edit"

def test_trusted_media_addition_returns_200(client, test_dive_site, admin_headers, db_session):
    payload = {"media_type": "photo", "url": "http://example.com/img2.jpg"}
    response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/media", json=payload, headers=admin_headers)
    
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["url"] == "http://example.com/img2.jpg"
