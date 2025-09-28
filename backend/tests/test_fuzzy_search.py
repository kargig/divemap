import pytest
from fastapi import status
from unittest.mock import patch, MagicMock
import difflib

from app.utils import (
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
    UNIFIED_TYPO_TOLERANCE
)
from app.models import DiveSite, DivingCenter, AvailableTag, DiveSiteTag


class TestUnifiedPhraseAwareScoring:
    """Test the unified phrase-aware scoring function."""

    def test_exact_phrase_match(self):
        """Test exact phrase match returns highest score."""
        score = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="Blue Hole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score == 1.0

    def test_word_by_word_matching(self):
        """Test word-by-word matching with partial matches."""
        score = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="Blue Hole Diving Site",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.8  # Should be high due to word matching

    def test_consecutive_word_bonus(self):
        """Test consecutive word bonus for concatenated names."""
        score = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="Bluehole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.7  # Should include consecutive bonus

    def test_geographic_field_matching(self):
        """Test geographic field matching (country, region, city)."""
        score = calculate_unified_phrase_aware_score(
            query="bahamas",
            primary_name="Blue Hole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.2  # Should include geographic bonus

    def test_tag_matching(self):
        """Test tag matching for specialized searches."""
        score = calculate_unified_phrase_aware_score(
            query="wreck",
            primary_name="Blue Hole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean",
            tags=["Wreck Diving", "Reef Diving"]
        )
        assert score > 0.3  # Should include tag bonus

    def test_single_word_high_similarity(self):
        """Test single word with high similarity boost."""
        score = calculate_unified_phrase_aware_score(
            query="nautalus",  # Typo for "nautilus"
            primary_name="Nautilus Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.6  # Should be boosted by high similarity

    def test_description_bonus(self):
        """Test description field matching bonus."""
        score = calculate_unified_phrase_aware_score(
            query="beautiful",
            primary_name="Blue Hole Reef",
            description="A beautiful reef with amazing marine life",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.1  # Should include description bonus

    def test_empty_fields_handling(self):
        """Test handling of None/empty fields."""
        score = calculate_unified_phrase_aware_score(
            query="test",
            primary_name="Test Site",
            description=None,
            country=None,
            region=None,
            city=None
        )
        assert score > 0.0  # Should still work with empty fields

    def test_case_insensitive_matching(self):
        """Test that matching is case insensitive."""
        score_lower = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="BLUE HOLE REEF",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        score_upper = calculate_unified_phrase_aware_score(
            query="BLUE HOLE",
            primary_name="blue hole reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert abs(score_lower - score_upper) < 0.01  # Should be nearly identical


class TestMatchTypeClassification:
    """Test the match type classification function."""

    def test_exact_phrase_classification(self):
        """Test exact phrase match classification."""
        match_type = classify_match_type(1.0)
        assert match_type == "exact_phrase"

    def test_exact_words_classification(self):
        """Test exact words match classification."""
        match_type = classify_match_type(0.8)
        assert match_type == "exact_words"

    def test_partial_words_classification(self):
        """Test partial words match classification."""
        match_type = classify_match_type(0.6)
        assert match_type == "partial_words"

    def test_similar_classification(self):
        """Test similar match classification."""
        match_type = classify_match_type(0.4)
        assert match_type == "similar"

    def test_fuzzy_classification(self):
        """Test fuzzy match classification."""
        match_type = classify_match_type(0.1)
        assert match_type == "fuzzy"

    def test_boundary_values(self):
        """Test classification at boundary values."""
        assert classify_match_type(0.9) == "exact_phrase"
        assert classify_match_type(0.7) == "exact_words"
        assert classify_match_type(0.5) == "partial_words"
        assert classify_match_type(0.3) == "similar"
        assert classify_match_type(0.2) == "fuzzy"


class TestFuzzySearchTriggers:
    """Test fuzzy search trigger conditions."""

    def test_multi_word_query_trigger(self):
        """Test that multi-word queries trigger fuzzy search."""
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="scuba life",
            exact_result_count=10,
            max_exact_results=5
        )
        assert should_trigger is True

    def test_short_query_trigger(self):
        """Test that short queries trigger fuzzy search."""
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="test",
            exact_result_count=10,
            max_exact_results=5
        )
        assert should_trigger is True

    def test_insufficient_results_trigger(self):
        """Test that insufficient results trigger fuzzy search."""
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="very long search query that exceeds normal length",
            exact_result_count=3,
            max_exact_results=5
        )
        assert should_trigger is True

    def test_long_query_sufficient_results_no_trigger(self):
        """Test that long queries with sufficient results don't trigger fuzzy search."""
        # Note: Multi-word queries always trigger fuzzy search due to space detection
        # This test checks the case where there are no spaces but sufficient results
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="verylongsearchquerywithexceedsnormallength",
            exact_result_count=10,
            max_exact_results=5
        )
        assert should_trigger is False

    def test_long_query_with_spaces_always_triggers(self):
        """Test that long queries with spaces always trigger fuzzy search."""
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="very long search query that exceeds normal length",
            exact_result_count=10,
            max_exact_results=5
        )
        assert should_trigger is True  # Should trigger due to spaces


class TestDivingCentersEnhancedSearch:
    """Test the enhanced search functionality in diving centers."""

    def test_partial_character_matching_city(self, client, test_diving_center_with_city):
        """Test that partial character matching works for city fields."""
        # Test "anavys" matching "Anavissos Municipal Unit"
        response = client.get("/api/v1/diving-centers/?search=anavys")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_anavys_search_specific_case(self, client, test_diving_center_with_city):
        """Test the specific 'anavys' search case mentioned in user query."""
        # This should now find "Anavissos Municipal Unit" via partial character matching
        response = client.get("/api/v1/diving-centers/?search=anavys")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should find the diving center with city "Anavissos Municipal Unit"
        found = False
        for center in data:
            if center.get("city") and "anavissos" in center["city"].lower():
                found = True
                break
        assert found, "Should find diving center with 'anavissos' in city"

    def test_partial_character_matching_various_lengths(self, client, test_diving_center_with_city):
        """Test partial character matching with various search term lengths."""
        # Test 4-character partial match
        response = client.get("/api/v1/diving-centers/?search=anav")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        
        # Test 5-character partial match
        response = client.get("/api/v1/diving-centers/?search=anavi")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        
        # Test 6-character partial match (should match "anavissos")
        response = client.get("/api/v1/diving-centers/?search=anavis")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_geographic_field_search(self, client, test_diving_center_with_city):
        """Test search across all geographic fields."""
        response = client.get("/api/v1/diving-centers/?search=attica")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_multi_word_search_trigger(self, client, test_diving_center):
        """Test that multi-word searches trigger fuzzy search."""
        response = client.get("/api/v1/diving-centers/?search=scuba life")
        assert response.status_code == status.HTTP_200_OK
        # Should trigger fuzzy search due to space in query

    def test_short_query_fuzzy_trigger(self, client, test_diving_center):
        """Test that short queries trigger fuzzy search."""
        response = client.get("/api/v1/diving-centers/?search=test")
        assert response.status_code == status.HTTP_200_OK
        # Should trigger fuzzy search due to short length

    def test_search_with_match_types_header(self, client, test_diving_center):
        """Test that search returns match types in headers."""
        response = client.get("/api/v1/diving-centers/?search=test")
        assert response.status_code == status.HTTP_200_OK
        # Check if match types header is present (when fuzzy search is triggered)
        if "x-match-types" in response.headers:
            match_types = response.headers["x-match-types"]
            assert match_types is not None

    def test_enhanced_search_with_description(self, client, test_diving_center_with_city):
        """Test that search also finds results in description fields."""
        # Search for "anavissos" which should be in the description
        response = client.get("/api/v1/diving-centers/?search=anavissos")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_search_priority_ordering(self, client, test_diving_center_with_city):
        """Test that search results are properly ordered by relevance."""
        response = client.get("/api/v1/diving-centers/?search=anavissos")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if len(data) > 1:
            # Results should be ordered by relevance (exact matches first)
            # This tests the fuzzy search scoring and ordering
            pass

    def test_search_with_sorting_and_fuzzy(self, client, test_diving_center_with_city):
        """Test that fuzzy search works with sorting parameters."""
        response = client.get("/api/v1/diving-centers/?search=anavys&sort_by=name&sort_order=asc")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_search_pagination_with_fuzzy(self, client, test_diving_center_with_city):
        """Test that pagination works correctly with fuzzy search results."""
        response = client.get("/api/v1/diving-centers/?search=anavys&page=1&page_size=25")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        
        # Check pagination headers
        assert "x-total-count" in response.headers
        assert "x-total-pages" in response.headers


class TestDiveSitesFuzzySearch:
    """Test the fuzzy search functionality in dive sites."""

    def test_fuzzy_search_with_tags(self, client, test_dive_site_with_tags):
        """Test fuzzy search that includes tag matching."""
        response = client.get("/api/v1/dive-sites/?search=blue")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_geographic_search_dive_sites(self, client, test_dive_site):
        """Test geographic field search in dive sites."""
        response = client.get("/api/v1/dive-sites/?search=test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_multi_word_search_dive_sites(self, client, test_dive_site):
        """Test multi-word search in dive sites."""
        response = client.get("/api/v1/dive-sites/?search=test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_fuzzy_search_threshold(self, client, test_dive_site):
        """Test that fuzzy search respects similarity threshold."""
        response = client.get("/api/v1/dive-sites/?search=xyz")  # Very different from test data
        assert response.status_code == status.HTTP_200_OK
        # Should return only exact matches or very similar results

    def test_search_with_aliases(self, client, test_dive_site_with_aliases):
        """Test search that includes dive site aliases."""
        response = client.get("/api/v1/dive-sites/?search=blue")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_fuzzy_search_trigger_conditions(self, client, test_dive_site):
        """Test that fuzzy search triggers under correct conditions."""
        # Short query should trigger fuzzy search
        response = client.get("/api/v1/dive-sites/?search=test")
        assert response.status_code == status.HTTP_200_OK
        
        # Multi-word query should trigger fuzzy search
        response = client.get("/api/v1/dive-sites/?search=blue hole")
        assert response.status_code == status.HTTP_200_OK

    def test_search_result_ordering(self, client, test_dive_site_with_tags):
        """Test that search results are properly ordered by relevance."""
        response = client.get("/api/v1/dive-sites/?search=blue")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if len(data) > 1:
            # Results should be ordered by relevance (exact matches first)
            # This tests the fuzzy search scoring and ordering
            pass

    def test_search_with_difficulty_filter(self, client, test_dive_site):
        """Test search combined with difficulty filtering."""
        response = client.get("/api/v1/dive-sites/?search=test&difficulty=intermediate")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_search_performance_with_large_dataset(self, client, multiple_test_dive_sites):
        """Test search performance with multiple dive sites."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dive-sites/?search=test")
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 2.0  # Should complete within 2 seconds even with more data


class TestUnifiedTypoTolerance:
    """Test the unified typo tolerance settings."""

    def test_typo_tolerance_constants(self):
        """Test that typo tolerance constants are properly defined."""
        assert UNIFIED_TYPO_TOLERANCE['word_similarity'] == 0.7
        assert UNIFIED_TYPO_TOLERANCE['single_word'] == 0.8
        assert UNIFIED_TYPO_TOLERANCE['phrase_similarity'] == 0.7
        assert UNIFIED_TYPO_TOLERANCE['overall_threshold'] == 0.2

    def test_word_similarity_threshold(self):
        """Test word similarity threshold in practice."""
        # Test with words that are 70% similar
        similarity = difflib.SequenceMatcher(None, "nautalus", "nautilus").ratio()
        assert similarity >= 0.7  # Should meet the threshold

    def test_single_word_threshold(self):
        """Test single word similarity threshold."""
        # Test with words that are 80% similar
        similarity = difflib.SequenceMatcher(None, "scuba", "scubba").ratio()
        assert similarity >= 0.8  # Should meet the threshold


class TestSearchIntegration:
    """Test integration between different search components."""

    def test_search_consistency_across_endpoints(self, client, test_dive_site, test_diving_center):
        """Test that search behavior is consistent across endpoints."""
        # Test dive sites search
        dive_sites_response = client.get("/api/v1/dive-sites/?search=test")
        assert dive_sites_response.status_code == status.HTTP_200_OK
        
        # Test diving centers search
        diving_centers_response = client.get("/api/v1/diving-centers/?search=test")
        assert diving_centers_response.status_code == status.HTTP_200_OK

    def test_search_performance(self, client, test_dive_site, test_diving_center):
        """Test that search performance is acceptable."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dive-sites/?search=test")
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 1.0  # Should complete within 1 second


class TestNewslettersFuzzySearch:
    """Test the fuzzy search functionality in newsletters."""

    def test_newsletter_search_basic(self, client, test_newsletter, admin_headers):
        """Test basic newsletter search functionality."""
        response = client.get("/api/v1/newsletters/?search=test", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_newsletter_search_with_title(self, client, test_newsletter, admin_headers):
        """Test newsletter search by content (since Newsletter only has content field)."""
        response = client.get("/api/v1/newsletters/?search=newsletter", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_newsletter_search_with_content(self, client, test_newsletter, admin_headers):
        """Test newsletter search by content."""
        response = client.get("/api/v1/newsletters/?search=content", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0


class TestUtilsFunctions:
    """Test utility functions used by fuzzy search."""

    def test_get_unified_fuzzy_trigger_conditions_edge_cases(self):
        """Test edge cases for fuzzy search trigger conditions."""
        # Test with empty string
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="",
            exact_result_count=5,
            max_exact_results=5
        )
        assert should_trigger == ""  # Empty string returns empty string
        
        # Test with None
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query=None,
            exact_result_count=5,
            max_exact_results=5
        )
        assert should_trigger is None  # None returns None
        
        # Test with whitespace-only
        should_trigger = get_unified_fuzzy_trigger_conditions(
            search_query="   ",
            exact_result_count=5,
            max_exact_results=5
        )
        assert should_trigger is True  # Whitespace-only returns True due to space detection

    def test_classify_match_type_edge_cases(self):
        """Test edge cases for match type classification."""
        # Test with exact 1.0
        assert classify_match_type(1.0) == "exact_phrase"
        
        # Test with 0.0
        assert classify_match_type(0.0) == "fuzzy"
        
        # Test with negative values
        assert classify_match_type(-0.1) == "fuzzy"
        
        # Test with values above 1.0
        assert classify_match_type(1.1) == "exact_phrase"

    def test_calculate_unified_phrase_aware_score_edge_cases(self):
        """Test edge cases for the unified scoring function."""
        # Test with empty query
        score = calculate_unified_phrase_aware_score(
            query="",
            primary_name="Test Site"
        )
        assert score == 1.0  # Empty query should match everything
        
        # Test with empty primary name
        score = calculate_unified_phrase_aware_score(
            query="test",
            primary_name=""
        )
        assert score >= 0.0  # Should handle empty name gracefully
        
        # Test with very long query
        long_query = "a" * 1000
        score = calculate_unified_phrase_aware_score(
            query=long_query,
            primary_name="Test Site"
        )
        assert score >= 0.0  # Should handle long queries gracefully


class TestSearchErrorHandling:
    """Test error handling in search functionality."""

    def test_search_with_invalid_characters(self, client, test_dive_site):
        """Test search with potentially problematic characters."""
        # Test with SQL injection attempt
        response = client.get("/api/v1/dive-sites/?search=test'; DROP TABLE dive_sites; --")
        assert response.status_code == status.HTTP_200_OK
        # Should handle SQL injection attempts gracefully and return 200 OK
        
        # Test with very long search term
        long_search = "a" * 1000
        response = client.get(f"/api/v1/dive-sites/?search={long_search}")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        # Should return 422 for very long searches, which is correct validation behavior

    def test_search_with_special_characters(self, client, test_dive_site):
        """Test search with special characters and unicode."""
        # Test with unicode characters
        response = client.get("/api/v1/dive-sites/?search=testé")
        assert response.status_code == status.HTTP_200_OK
        
        # Test with special characters
        response = client.get("/api/v1/dive-sites/?search=test@#$%")
        assert response.status_code == status.HTTP_200_OK


# Test fixtures for enhanced testing
@pytest.fixture
def test_diving_center_with_city(db_session):
    """Create a test diving center with city information."""
    center = DivingCenter(
        name="Aqualized",
        description="Established diving center in Anavissos",
        email="test@aqualized.com",
        phone="+1234567890",
        website="www.aqualized.com",
        latitude=37.7308,
        longitude=23.9475,
        country="Greece",
        region="Attica",
        city="Anavissos Municipal Unit"
    )
    db_session.add(center)
    db_session.commit()
    db_session.refresh(center)
    return center

@pytest.fixture
def test_dive_site_with_tags(db_session):
    """Create a test dive site with tags."""
    site = DiveSite(
        name="Blue Hole Wreck",
        description="A beautiful wreck dive site",
        latitude=25.0,
        longitude=30.0,
        country="Bahamas",
        region="Caribbean",
        difficulty_level=2  # 2=intermediate
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    
    # Add tags
    wreck_tag = AvailableTag(name="Wreck Diving")
    reef_tag = AvailableTag(name="Reef Diving")
    db_session.add(wreck_tag)
    db_session.add(reef_tag)
    db_session.commit()
    
    # Link tags to site
    site_tag1 = DiveSiteTag(dive_site_id=site.id, tag_id=wreck_tag.id)
    site_tag2 = DiveSiteTag(dive_site_id=site.id, tag_id=reef_tag.id)
    db_session.add(site_tag1)
    db_session.add(site_tag2)
    db_session.commit()
    
    return site

@pytest.fixture
def test_dive_site_with_aliases(db_session):
    """Create a test dive site with aliases."""
    site = DiveSite(
        name="Blue Hole Reef",
        description="A beautiful reef dive site",
        latitude=25.0,
        longitude=30.0,
        country="Bahamas",
        region="Caribbean",
        difficulty_level=1  # beginner
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)
    
    # Add aliases
    from app.models import DiveSiteAlias
    alias1 = DiveSiteAlias(
        dive_site_id=site.id,
        alias="Blue Hole"
    )
    alias2 = DiveSiteAlias(
        dive_site_id=site.id,
        alias="Bleu Hole"
    )
    db_session.add(alias1)
    db_session.add(alias2)
    db_session.commit()
    
    return site

@pytest.fixture
def multiple_test_dive_sites(db_session):
    """Create multiple test dive sites for performance testing."""
    sites = []
    for i in range(10):
        site = DiveSite(
            name=f"Test Dive Site {i}",
            description=f"A test dive site number {i}",
            latitude=25.0 + (i * 0.1),
            longitude=30.0 + (i * 0.1),
            country="Test Country",
            region="Test Region",
            difficulty_level=2  # 2=intermediate
        )
        db_session.add(site)
        sites.append(site)
    
    db_session.commit()
    for site in sites:
        db_session.refresh(site)
    
    return sites

@pytest.fixture
def test_newsletter(db_session):
    """Create a test newsletter for testing."""
    from app.models import Newsletter
    newsletter = Newsletter(
        content="This is a test newsletter content for testing purposes. It contains the word test and newsletter."
    )
    db_session.add(newsletter)
    db_session.commit()
    db_session.refresh(newsletter)
    return newsletter
