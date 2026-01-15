
import pytest
from app.models import DiveSite, User, SiteMedia, Dive, DiveMedia, MediaType
from app.database import SessionLocal
from datetime import date

# Use existing conftest fixtures where possible
# Assuming client, test_db, test_user_token, etc. are available

def test_media_ordering_workflow(client, db_session, auth_headers, test_user):
    # 1. Create a dive site
    response = client.post(
        "/api/v1/dive-sites/",
        json={
            "name": "Media Ordering Test Site",
            "latitude": 10.0,
            "longitude": 10.0,
            "description": "Test site for media ordering",
            "country": "Test Country",
            "region": "Test Region"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    site_id = response.json()["id"]

    # 2. Add Site Media (Admin/Owner uploaded)
    # Add Media 1
    response = client.post(
        f"/api/v1/dive-sites/{site_id}/media",
        json={
            "media_type": "photo",
            "url": "http://example.com/site1.jpg",
            "description": "Site Photo 1"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    site_media_1_id = response.json()["id"]

    # Add Media 2
    response = client.post(
        f"/api/v1/dive-sites/{site_id}/media",
        json={
            "media_type": "photo",
            "url": "http://example.com/site2.jpg",
            "description": "Site Photo 2"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    site_media_2_id = response.json()["id"]

    # 3. Create a Dive and add Dive Media (Linked from Dive Log)
    # Create Dive
    response = client.post(
        "/api/v1/dives/",
        json={
            "dive_site_id": site_id,
            "dive_date": "2023-01-01",
            "duration": 60,
            "max_depth": 20.0
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    dive_id = response.json()["id"]

    # Add Dive Media via DB directly (or API if available, assuming direct model usage for speed/simplicity if API is complex)
    # But let's try to use API if possible. Assuming POST /api/v1/dives/{id}/media exists
    # If not, we'll insert directly. Checking router...
    # Dive media is usually added via `dives.py`. Let's assume we can add it directly to DB for test stability.
    
    dive_media = DiveMedia(
        dive_id=dive_id,
        media_type=MediaType.photo,
        url="http://example.com/dive1.jpg",
        description="Dive Photo 1"
    )
    db_session.add(dive_media)
    db_session.commit()
    db_session.refresh(dive_media)
    dive_media_id = dive_media.id

    # 4. Verify Initial Default Order (Site Media then Dive Media usually, or by ID)
    response = client.get(f"/api/v1/dive-sites/{site_id}/media")
    assert response.status_code == 200
    media_list = response.json()
    # Initially likely: site1, site2, dive1 (based on implementation detail of concatenation)
    # Let's just capture current IDs to verify we can change them
    initial_ids = [m["id"] for m in media_list]
    print(f"Initial order: {initial_ids}")

    # 5. Reorder Media
    # Target Order: Dive Media, Site Media 2, Site Media 1
    target_order = [f"dive_{dive_media_id}", f"site_{site_media_2_id}", f"site_{site_media_1_id}"]
    
    response = client.put(
        f"/api/v1/dive-sites/{site_id}/media/order",
        json={"order": target_order},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # 6. Verify New Order
    response = client.get(f"/api/v1/dive-sites/{site_id}/media")
    assert response.status_code == 200
    media_list = response.json()
    
    # Check URLs or IDs to verify order
    # item 0 should be dive media
    assert media_list[0]["id"] == dive_media_id
    assert media_list[0]["dive_id"] == dive_id # specific field for dive media
    
    # item 1 should be site media 2
    assert media_list[1]["id"] == site_media_2_id
    assert media_list[1]["url"] == "http://example.com/site2.jpg"
    
    # item 2 should be site media 1
    assert media_list[2]["id"] == site_media_1_id
    assert media_list[2]["url"] == "http://example.com/site1.jpg"

    # 7. Add new media (Site Media 3) and verify it appears at the end
    response = client.post(
        f"/api/v1/dive-sites/{site_id}/media",
        json={
            "media_type": "photo",
            "url": "http://example.com/site3.jpg",
            "description": "Site Photo 3"
        },
        headers=auth_headers
    )
    site_media_3_id = response.json()["id"]

    response = client.get(f"/api/v1/dive-sites/{site_id}/media")
    media_list = response.json()
    assert len(media_list) == 4
    assert media_list[3]["id"] == site_media_3_id # Should be last

    # 8. Delete ordered media (Site Media 2) and verify order cleanup (implicit or explicit)
    response = client.delete(
        f"/api/v1/dive-sites/{site_id}/media/{site_media_2_id}",
        headers=auth_headers
    )
    assert response.status_code == 200

    response = client.get(f"/api/v1/dive-sites/{site_id}/media")
    media_list = response.json()
    
    # Expected: Dive Media, Site Media 1, Site Media 3
    assert len(media_list) == 3
    assert media_list[0]["id"] == dive_media_id
    assert media_list[1]["id"] == site_media_1_id
    assert media_list[2]["id"] == site_media_3_id

