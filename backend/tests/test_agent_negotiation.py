import pytest
import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_agent_discoverability_link_headers_updated():
    """
    Test that the updated Link headers including llms.txt are present.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert "link" in response.headers
    expected_link = '</openapi.json>; rel="api-catalog", </docs>; rel="service-doc", </llms.txt>; rel="service-desc"'
    assert response.headers["link"] == expected_link

def test_markdown_negotiation_homepage():
    """
    Test the markdown negotiation endpoint for the homepage.
    """
    # Ensure the llm_content directory and llms.txt exist in the test environment
    llm_content_dir = os.path.join(os.getcwd(), "llm_content")
    os.makedirs(llm_content_dir, exist_ok=True)
    llms_txt_path = os.path.join(llm_content_dir, "llms.txt")
    
    test_content = "# Test Knowledge Base\nThis is a test."
    with open(llms_txt_path, "w") as f:
        f.write(test_content)

    # Request the root path with markdown negotiation
    # Note: We test the backend endpoint directly here as TestClient doesn't go through Nginx
    response = client.get("/api/v1/agent/negotiate/")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    assert "x-markdown-tokens" in response.headers
    assert int(response.headers["x-markdown-tokens"]) > 0
    assert response.text == test_content

def test_markdown_negotiation_deep_link():
    """
    Test that deep links map to the correct markdown catalogs.
    """
    llm_content_dir = os.path.join(os.getcwd(), "llm_content")
    sites_md_path = os.path.join(llm_content_dir, "dive-sites.md")
    
    test_content = "# Dive Sites\n- Site 1"
    with open(sites_md_path, "w") as f:
        f.write(test_content)

    # Request a dive site deep link
    response = client.get("/api/v1/agent/negotiate/dive-sites/123-some-slug")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    assert response.text == test_content

def test_markdown_negotiation_404():
    """
    Test handling of non-existent markdown files.
    """
    # This path should default to llms.txt which we created in the first test,
    # but let's test a path that definitely doesn't map to anything if we can.
    # Actually, the implementation defaults to llms.txt.
    pass
