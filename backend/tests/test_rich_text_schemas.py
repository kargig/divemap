import pytest
from app.schemas import (
    DiveSiteBase, 
    DivingCenterBase, 
    ParsedDiveTripCreate, 
    ParsedDiveCreate,
    ParsedDiveTripUpdate,
    DiveSiteUpdate
)

def test_dive_site_html_stripping():
    """Test that HTML tags are stripped from DiveSite fields."""
    payload = {
        "name": "Test Site",
        "description": "<p>This is <strong>bold</strong> and <a href='http://evil.com'>a link</a>.</p>",
        "latitude": 37.0,
        "longitude": 25.0,
        "access_instructions": "<div>Just walk <span>in</span></div>",
        "marine_life": "Fish <br> and <script>alert(1)</script> turtles",
        "safety_information": "Keep <b>safe</b>"
    }
    
    site = DiveSiteBase(**payload)
    
    # Text should be preserved, but tags removed
    # Note: nh3 strips script tags and their content by default
    assert site.description == "This is bold and a link."
    assert site.access_instructions == "Just walk in"
    assert site.marine_life == "Fish  and  turtles"
    assert site.safety_information == "Keep safe"

def test_markdown_preservation():
    """Test that Markdown syntax is NOT stripped (only HTML)."""
    markdown_content = "### Title\n\n- Item 1\n- Item 2\n\n**Bold** and *italic* [link](url)."
    
    payload = {
        "name": "Markdown Site",
        "description": markdown_content,
        "latitude": 37.0,
        "longitude": 25.0
    }
    
    site = DiveSiteBase(**payload)
    
    # Markdown should remain exactly the same
    assert site.description == markdown_content

def test_diving_center_html_stripping():
    """Test that HTML tags are stripped from Diving Center description."""
    payload = {
        "name": "Test Center",
        "description": "Best <h1>Dive</h1> Center",
        "latitude": 37.0,
        "longitude": 25.0
    }
    
    center = DivingCenterBase(**payload)
    assert center.description == "Best Dive Center"

def test_trip_and_dive_html_stripping():
    """Test that HTML tags are stripped from Trip and Dive fields."""
    # Test Dive
    dive_payload = {
        "dive_number": 1,
        "dive_description": "<i>Fun</i> dive"
    }
    dive = ParsedDiveCreate(**dive_payload)
    assert dive.dive_description == "Fun dive"
    
    # Test Trip
    trip_payload = {
        "trip_date": "2026-05-01",
        "trip_description": "<section>Exciting trip</section>",
        "special_requirements": "Bring <u>fins</u>"
    }
    trip = ParsedDiveTripCreate(**trip_payload)
    assert trip.trip_description == "Exciting trip"
    assert trip.special_requirements == "Bring fins"

def test_none_and_empty_handling():
    """Test that None and empty strings are handled gracefully."""
    payload = {
        "name": "Empty Site",
        "description": "",
        "latitude": 37.0,
        "longitude": 25.0,
        "access_instructions": None
    }
    
    site = DiveSiteBase(**payload)
    assert site.description == ""
    assert site.access_instructions is None

def test_update_schemas_stripping():
    """Test that update schemas also strip HTML."""
    # Dive Site Update
    site_update = DiveSiteUpdate(description="<b>New</b> description")
    assert site_update.description == "New description"
    
    # Trip Update
    trip_update = ParsedDiveTripUpdate(trip_description="<p>Updated</p> trip")
    assert trip_update.trip_description == "Updated trip"
