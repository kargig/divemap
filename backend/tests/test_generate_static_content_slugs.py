import pytest
import sys
import os

# Add the backend directory to sys.path so we can import generate_static_content
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from generate_static_content import generate_clean_slug, get_dive_site_slug, get_diving_center_slug

class MockEntity:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def test_generate_clean_slug():
    # Test deduplication
    assert generate_clean_slug(["Greece", "Attica", "East Attica", "East Attica Bay"]) == "greece-attica-east-bay"
    
    # Test boilerplate removal
    assert generate_clean_slug(["Greece", "regional-unit-of-east-attica", "Katafygi"]) == "greece-east-attica-katafygi"
    
    # Test complex boilerplate removal (Naxos)
    assert generate_clean_slug(["Greece", "Naxos and the lesser cyclades", "Nima Dive Center"]) == "greece-naxos-nima-dive-center"
    
    # Test ignoring empty parts
    assert generate_clean_slug(["Greece", None, "", "Bay"]) == "greece-bay"

def test_get_dive_site_slug():
    site = MockEntity(country="Greece", region="regional unit of East Attica", name="Katafygi Bay 1")
    assert get_dive_site_slug(site) == "greece-east-attica-katafygi-bay-1"
    
    # Test missing fields
    site = MockEntity(country=None, region=None, name="Just A Site")
    assert get_dive_site_slug(site) == "just-a-site"

def test_get_diving_center_slug():
    # Test city preference over region and deduplication
    center = MockEntity(country="Greece", region="South Aegean", city="Naxos and the lesser cyclades", name="Nima Dive Center")
    assert get_diving_center_slug(center) == "greece-naxos-nima-dive-center"
    
    # Test fallback to region if city is missing
    center = MockEntity(country="Egypt", region="Red Sea", city=None, name="Deep Blue")
    assert get_diving_center_slug(center) == "egypt-red-sea-deep-blue"
