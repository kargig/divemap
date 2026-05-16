import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_agent_discoverability_link_headers():
    """
    Test that the Link headers for agent discoverability are present in the response
    as per RFC 8288 and RFC 9727 Section 3.
    This validates the add_security_headers middleware.
    """
    # Test a docs path (which should have the header)
    response = client.get("/docs")
    assert response.status_code == 200
    assert "link" in response.headers
    assert response.headers["link"] == '</openapi.json>; rel="api-catalog", </docs>; rel="service-doc", </llms.txt>; rel="service-desc"'

    # Test an API path (which should also have the header)
    response = client.get("/api/v1/dives/")
    # It might return 401 or 404 depending on auth/routing in the test environment,
    # but the middleware should still attach the header.
    assert "link" in response.headers
    assert response.headers["link"] == '</openapi.json>; rel="api-catalog", </docs>; rel="service-doc", </llms.txt>; rel="service-desc"'
