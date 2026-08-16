from datetime import date
import pytest
from app.models import DiveSite, DivingCenter, DiveRoute, DifficultyLevel, User, Dive, DivingOrganization

@pytest.fixture
def sample_data(db_session):
    # Retrieve difficulty level created by conftest.py
    diff = db_session.query(DifficultyLevel).filter_by(code="OPEN_WATER").first()
    if not diff:
        diff = DifficultyLevel(id=1, code="OPEN_WATER", label="Open Water", order_index=1)
        db_session.add(diff)
        db_session.commit()

    # Create test user for ownership/constraint checks
    user = User(
        id=999,
        username="seotester",
        email="seo@test.com",
        password_hash="dummy_hash"
    )
    db_session.add(user)
    db_session.commit()

    # Create a test Dive Site
    site = DiveSite(
        id=123,
        name="SEO Test Site",
        country="Greece",
        region="Cyclades",
        description="A wonderful pre-rendered test dive site.",
        max_depth=25,
        latitude=37.0,
        longitude=25.0,
        status="approved",
        difficulty_id=diff.id
    )
    db_session.add(site)

    # Create a test Diving Center
    center = DivingCenter(
        id=456,
        name="SEO Test Center",
        country="Greece",
        region="Cyclades",
        city="Naxos",
        description="A professional dive center on Naxos island.",
        latitude=37.06,
        longitude=25.37,
    )
    db_session.add(center)

    db_session.commit()

    # Create a test Dive Route (depends on site and user)
    route = DiveRoute(
        id=789,
        name="SEO Test Route",
        description="Dynamic route pre-rendering description.",
        dive_site_id=site.id,
        created_by=user.id,
        route_type="scuba",
        route_data={"type": "FeatureCollection", "features": []}
    )
    db_session.add(route)

    # Create a test public Dive
    dive = Dive(
        id=111,
        user_id=user.id,
        dive_site_id=site.id,
        name="SEO Test Dive Log",
        is_private=False,
        max_depth=30.0,
        duration=45,
        dive_information="Superb dive with clear visibility.",
        dive_date=date(2026, 8, 14)
    )
    db_session.add(dive)

    # Retrieve or create test Diving Organization
    org = db_session.query(DivingOrganization).filter_by(acronym="PADI").first()
    if not org:
        org = DivingOrganization(
            id=11,
            name="PADI Organization",
            acronym="PADI"
        )
        db_session.add(org)
        db_session.commit()
    else:
        # Update name to match test expectations if it was pre-seeded differently
        org.name = "PADI Organization"
        db_session.commit()

    return site, center, route, user, dive, org


def test_seo_homepage(client, sample_data):
    response = client.get("/api/v1/seo/html/")
    assert response.status_code == 200
    assert response.headers.get("X-Prerendered") == "1"
    assert "Cache-Control" in response.headers
    
    html = response.text
    assert "<title>Divemap - Discover and Rate Scuba Dive Sites Worldwide</title>" in html
    assert "SEO Test Site" in html  # Home page should include the popular dive site links
    assert 'href="/dive-sites/123/' in html


def test_seo_dive_sites_listing(client, sample_data):
    response = client.get("/api/v1/seo/html/dive-sites")
    assert response.status_code == 200
    assert "<h1>Dive Sites</h1>" in response.text
    assert "SEO Test Site" in response.text


def test_seo_dive_site_detail(client, sample_data):
    site, _, _, _, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/dive-sites/{site.id}/greece-cyclades-seo-test-site")
    assert response.status_code == 200
    assert "<h1>SEO Test Site</h1>" in response.text
    assert "A wonderful pre-rendered test" in response.text
    assert "application/ld+json" in response.text


def test_seo_diving_centers_listing(client, sample_data):
    response = client.get("/api/v1/seo/html/diving-centers")
    assert response.status_code == 200
    assert "<h1>Diving Centers</h1>" in response.text
    assert "SEO Test Center" in response.text


def test_seo_diving_center_detail(client, sample_data):
    _, center, _, _, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/diving-centers/{center.id}/greece-naxos-seo-test-center")
    assert response.status_code == 200
    assert "<h1>SEO Test Center</h1>" in response.text
    assert "A professional dive center on Naxos island." in response.text


def test_seo_dive_routes_listing(client, sample_data):
    response = client.get("/api/v1/seo/html/dive-routes")
    assert response.status_code == 200
    assert "<h1>Dive Routes</h1>" in response.text
    assert "SEO Test Route" in response.text


def test_seo_dive_route_detail(client, sample_data):
    _, _, route, _, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/dive-routes/{route.id}/seo-test-route")
    assert response.status_code == 200
    assert "<h1>SEO Test Route</h1>" in response.text
    assert "Dynamic route pre-rendering description." in response.text


def test_seo_dives_listing(client, sample_data):
    response = client.get("/api/v1/seo/html/dives")
    assert response.status_code == 200
    assert "<h1>Public Dives</h1>" in response.text
    assert "seotester&#x27;s dive" in response.text


def test_seo_dive_detail(client, sample_data):
    _, _, _, _, dive, _ = sample_data
    response = client.get(f"/api/v1/seo/html/dives/{dive.id}/seo-test-dive-log")
    assert response.status_code == 200
    assert "<h1>seotester's dive at SEO Test Site</h1>" in response.text
    assert "Superb dive with clear visibility." in response.text


def test_seo_user_profile(client, sample_data):
    _, _, _, user, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/users/{user.username}")
    assert response.status_code == 200
    assert "<h1>Diver Profile: seotester</h1>" in response.text


def test_seo_user_analytics(client, sample_data):
    _, _, _, user, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/users/{user.username}/analytics")
    assert response.status_code == 200
    assert "<h1>Diving Analytics: seotester</h1>" in response.text


def test_seo_user_lists(client, sample_data):
    _, _, _, user, _, _ = sample_data
    response = client.get(f"/api/v1/seo/html/users/{user.username}/lists/11")
    assert response.status_code == 200
    assert "<h1>Custom Dive Site Collection</h1>" in response.text


def test_seo_resources_home(client):
    response = client.get("/api/v1/seo/html/resources")
    assert response.status_code == 200
    assert "<h1>Diving Resources</h1>" in response.text


def test_seo_resources_tags(client):
    response = client.get("/api/v1/seo/html/resources/tags")
    assert response.status_code == 200
    assert "<h1>Diving Tags</h1>" in response.text


def test_seo_resources_organizations(client, sample_data):
    response = client.get("/api/v1/seo/html/resources/diving-organizations")
    assert response.status_code == 200
    assert "<h1>Diving Organizations</h1>" in response.text
    assert "PADI Organization" in response.text


def test_seo_resources_tools(client):
    response = client.get("/api/v1/seo/html/resources/tools/mod")
    assert response.status_code == 200
    assert "<h1>Scuba Calculator: MOD</h1>" in response.text


def test_seo_static_pages(client):
    for page in ["about", "help", "privacy"]:
        response = client.get(f"/api/v1/seo/html/{page}")
        assert response.status_code == 200
        assert f"<h1>{page.capitalize()}" in response.text


def test_seo_404_not_found(client):
    response = client.get("/api/v1/seo/html/dive-sites/999999/non-existent-site")
    assert response.status_code == 404
    assert response.headers.get("X-Prerendered") == "404"
    assert "404 - Page Not Found" in response.text


def test_seo_junk_path_404(client):
    response = client.get("/api/v1/seo/html/invalid/path/format/junk")
    assert response.status_code == 404
    assert response.headers.get("X-Prerendered") == "404"
    assert "404 - Page Not Found" in response.text


def test_seo_mismatched_slug_redirect(client, sample_data):
    site, _, _, _, _, _ = sample_data
    # Access with a mismatched slug should do a 301 Redirect
    response = client.get(f"/api/v1/seo/html/dive-sites/{site.id}/completely-wrong-slug", follow_redirects=False)
    assert response.status_code == 301
    assert f"/dive-sites/{site.id}/greece-cyclades-seo-test-site" in response.headers["location"]


def test_seo_invalid_username_404(client):
    # Username with invalid URL-encoded characters should be rejected with 404
    response = client.get("/api/v1/seo/html/users/some%2Fusername")
    assert response.status_code == 404


def test_seo_invalid_list_id_404(client, sample_data):
    _, _, _, user, _, _ = sample_data
    # Non-numeric list ID should be rejected with 404
    response = client.get(f"/api/v1/seo/html/users/{user.username}/lists/abc")
    assert response.status_code == 404
    assert response.headers.get("X-Prerendered") == "404"


def test_seo_banned_user_profile_404(client, db_session, sample_data):
    _, _, _, user, _, _ = sample_data
    user.enabled = False
    db_session.commit()

    response = client.get(f"/api/v1/seo/html/users/{user.username}")
    assert response.status_code == 404


def test_seo_banned_user_dive_404(client, db_session, sample_data):
    _, _, _, user, dive, _ = sample_data
    user.enabled = False
    db_session.commit()

    response = client.get(f"/api/v1/seo/html/dives/{dive.id}/seo-test-dive-log")
    assert response.status_code == 404
