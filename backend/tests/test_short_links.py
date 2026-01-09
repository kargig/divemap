import pytest
from app.models import ShortLink
from datetime import datetime, timedelta, timezone

def test_create_and_redirect_short_link(client, db_session):
    # 1. Create a short link
    long_url = "https://example.com/very/long/url?param=1&filter=abc"
    expected_relative_url = "/very/long/url?param=1&filter=abc"
    
    response = client.post("/api/v1/short-links/create", json={"url": long_url})
    
    assert response.status_code == 200
    data = response.json()
    assert "short_url" in data
    assert "expires_at" in data
    
    short_url = data["short_url"]
    # Extract ID from URL (assuming format http://.../l/{id})
    short_id = short_url.split("/l/")[-1]
    
    # 2. Verify in DB
    link = db_session.query(ShortLink).filter(ShortLink.id == short_id).first()
    assert link is not None
    assert link.original_url == expected_relative_url
    
    # 3. Test Redirect
    # Note: client.get follows redirects by default? No, usually not unless configured.
    # We want to verify the redirect response.
    redirect_response = client.get(f"/l/{short_id}", follow_redirects=False)
    
    # FastAPI RedirectResponse returns 307 by default
    assert redirect_response.status_code == 307
    assert redirect_response.headers["location"] == expected_relative_url

def test_expired_short_link(client, db_session):
    # Create an expired link manually
    short_id = "expired123"
    long_url = "https://example.com"
    expired_at = datetime.now(timezone.utc) - timedelta(days=1)
    
    link = ShortLink(
        id=short_id,
        original_url=long_url,
        expires_at=expired_at
    )
    db_session.add(link)
    db_session.commit()
    
    # Try to access
    response = client.get(f"/l/{short_id}", follow_redirects=False)
    
    assert response.status_code == 410 # Gone
    
    # Verify deleted from DB
    db_session.expire_all()
    link = db_session.query(ShortLink).filter(ShortLink.id == short_id).first()
    assert link is None

def test_nonexistent_short_link(client):
    response = client.get("/l/nonexistent123", follow_redirects=False)
    assert response.status_code == 404

def test_create_short_link_strips_domain(client, db_session):
    # Test with external domain - should be stripped to relative path
    long_url = "https://google.com/search?q=divemap"
    response = client.post("/api/v1/short-links/create", json={"url": long_url})
    
    assert response.status_code == 200
    data = response.json()
    short_url = data["short_url"]
    short_id = short_url.split("/l/")[-1]
    
    # Verify in DB that it is stored as relative path
    link = db_session.query(ShortLink).filter(ShortLink.id == short_id).first()
    assert link.original_url == "/search?q=divemap"
    
    # Test with local domain
    long_url_local = "http://localhost:3000/map?lat=123"
    response = client.post("/api/v1/short-links/create", json={"url": long_url_local})
    assert response.status_code == 200
    
    data = response.json()
    short_id = data["short_url"].split("/l/")[-1]
    link = db_session.query(ShortLink).filter(ShortLink.id == short_id).first()
    assert link.original_url == "/map?lat=123"

