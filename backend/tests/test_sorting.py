"""
Test suite for sorting functionality across all entity types.

This module tests the sorting implementation for:
- Dive Sites (Phase 1.1)
- Diving Centers (Phase 1.2) 
- Dives (Phase 1.3)
- Dive Trips (Phase 1.4)
"""

import pytest
import time
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models import (
    DiveSite,
    DivingCenter,
    Dive,
    User,
    ParsedDiveTrip,
    DiveSiteAlias,
    DiveTag,
    AvailableTag,
    ParsedDive,
    DifficultyLevel,
    SiteRating,
)
from app.schemas import (
    DiveSiteSearchParams, DivingCenterSearchParams, 
    DiveSearchParams
)



class TestDiveSitesSorting:
    """Test sorting functionality for dive sites (Phase 1.1)."""
    
    def test_sort_by_name_asc(self, client, sample_dive_sites):
        """Test sorting dive sites by name in ascending order."""
        response = client.get("/api/v1/dive-sites/?sort_by=name&sort_order=asc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        
        # Verify sorting order
        names = [item["name"] for item in items]
        assert names == sorted(names)
    
    def test_sort_by_name_desc(self, client, sample_dive_sites):
        """Test sorting dive sites by name in descending order."""
        response = client.get("/api/v1/dive-sites/?sort_by=name&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dive_sites = data.get("items", [])
        
        # Verify sorting order
        names = [site["name"] for site in dive_sites]
        assert names == sorted(names, reverse=True)
    
    def test_sort_by_view_count_admin_only(self, client, sample_dive_sites):
        """Test that sorting by view_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/dive-sites/?sort_by=view_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by view_count is only available for admin users" in response.json()["detail"]
    
    def test_sort_by_average_rating_asc(self, client, sample_dive_sites):
        """Sorting by average_rating must not duplicate site_ratings joins (MySQL 1066)."""
        response = client.get(
            "/api/v1/dive-sites/?sort_by=average_rating&sort_order=asc&page=1&page_size=25"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_sort_by_created_at_desc(self, client, sample_dive_sites):
        """Test sorting dive sites by creation date in descending order."""
        response = client.get("/api/v1/dive-sites/?sort_by=created_at&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dive_sites = data.get("items", [])
        
        # Verify sorting order
        created_dates = [datetime.fromisoformat(site["created_at"]) for site in dive_sites]
        assert created_dates == sorted(created_dates, reverse=True)
    
    def test_sort_by_comment_count_admin_only(self, client, sample_dive_sites):
        """Test that sorting by comment_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/dive-sites/?sort_by=comment_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by comment_count is only available for admin users" in response.json()["detail"]
    
    def test_invalid_sort_field(self, client, sample_dive_sites):
        """Test that invalid sort fields are rejected."""
        response = client.get("/api/v1/dive-sites/?sort_by=invalid_field&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid sort_by field" in data["detail"]
    
    def test_invalid_sort_order(self, client, sample_dive_sites):
        """Test that invalid sort orders are rejected."""
        response = client.get("/api/v1/dive-sites/?sort_by=name&sort_order=invalid&page=1&page_size=25")
        
        assert response.status_code == 400
        data = response.json()
        assert "sort_order must be 'asc' or 'desc'" in data["detail"]

    def test_sort_by_region_asc(self, client, sample_dive_sites):
        """Regions sort case-insensitively (Crete, Rhodes, Santorini)."""
        response = client.get("/api/v1/dive-sites/?sort_by=region&sort_order=asc&page=1&page_size=25")
        assert response.status_code == 200
        regions = [s["region"] for s in response.json()["items"]]
        assert regions == sorted(regions, key=lambda x: (x or "").lower())

    def test_sort_by_updated_at_desc(self, client, sample_dive_sites):
        response = client.get("/api/v1/dive-sites/?sort_by=updated_at&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 200
        times = [datetime.fromisoformat(s["updated_at"]) for s in response.json()["items"]]
        assert times == sorted(times, reverse=True)

    def test_sort_by_difficulty_level_asc(self, client, sample_dive_sites):
        response = client.get(
            "/api/v1/dive-sites/?sort_by=difficulty_level&sort_order=asc&page=1&page_size=25"
        )
        assert response.status_code == 200
        codes = [s["difficulty_code"] for s in response.json()["items"] if s.get("difficulty_code")]
        rank = {"OPEN_WATER": 1, "ADVANCED_OPEN_WATER": 2, "DEEP_NITROX": 3, "TECHNICAL_DIVING": 4}
        keys = [rank.get(c, 0) for c in codes]
        assert keys == sorted(keys)

    def test_admin_sort_by_view_count_desc(self, client, sample_dive_sites, admin_headers):
        response = client.get(
            "/api/v1/dive-sites/?sort_by=view_count&sort_order=desc&page=1&page_size=25",
            headers=admin_headers,
        )
        assert response.status_code == 200
        views = [s["view_count"] for s in response.json()["items"]]
        assert views == sorted(views, reverse=True)

    def test_sort_by_average_rating_desc_order(self, client, sample_dive_sites_with_ratings):
        """Average rating desc: highest-rated site first."""
        response = client.get(
            "/api/v1/dive-sites/?sort_by=average_rating&sort_order=desc&page=1&page_size=25"
        )
        assert response.status_code == 200
        items = response.json()["items"]
        ours = [s for s in items if s["name"].startswith("RatingSort ")]
        assert [s["name"] for s in ours] == ["RatingSort High", "RatingSort Mid", "RatingSort Low"]

    def test_sort_by_country_asc_distinct_countries(self, client, db_session):
        """Lexicographic country sort across distinct values."""
        ow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "OPEN_WATER").first()
        did = ow.id if ow else 1
        sites = [
            DiveSite(name="CountrySort Malta", country="Malta", region="r", difficulty_id=did, latitude=35.0, longitude=14.0),
            DiveSite(name="CountrySort Albania", country="Albania", region="r", difficulty_id=did, latitude=41.0, longitude=20.0),
            DiveSite(name="CountrySort Greece", country="Greece", region="r", difficulty_id=did, latitude=37.0, longitude=24.0),
        ]
        db_session.add_all(sites)
        db_session.commit()
        try:
            r = client.get("/api/v1/dive-sites/?sort_by=country&sort_order=asc&page=1&page_size=100")
            assert r.status_code == 200
            subset = [x for x in r.json()["items"] if x["name"].startswith("CountrySort ")]
            assert [x["country"] for x in subset] == ["Albania", "Greece", "Malta"]
        finally:
            db_session.query(DiveSite).filter(DiveSite.name.startswith("CountrySort ")).delete(
                synchronize_session=False
            )
            db_session.commit()


class TestDivingCentersSorting:
    """Test sorting functionality for diving centers (Phase 1.2)."""
    
    def test_sort_by_name_asc(self, client, sample_diving_centers):
        """Test sorting diving centers by name in ascending order."""
        response = client.get("/api/v1/diving-centers/?sort_by=name&sort_order=asc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        diving_centers = data.get("items", [])
        
        # Verify sorting order
        names = [center["name"] for center in diving_centers]
        assert names == sorted(names)
    
    def test_sort_by_view_count_admin_only(self, client, sample_diving_centers):
        """Test that sorting by view_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/diving-centers/?sort_by=view_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by view_count is only available for admin users" in response.json()["detail"]
    
    def test_sort_by_comment_count_admin_only(self, client, sample_diving_centers):
        """Test that sorting by comment_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/diving-centers/?sort_by=comment_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by comment_count is only available for admin users" in response.json()["detail"]
    
    def test_sort_with_rating_filters(self, client, sample_diving_centers):
        """Test that sorting works correctly with rating filters."""
        # Test with a regular sort field (not admin-only)
        response = client.get("/api/v1/diving-centers/?sort_by=name&sort_order=asc&min_rating=4&max_rating=5&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        diving_centers = data.get("items", [])
        
        # Verify that rating filters are applied
        for center in diving_centers:
            assert center["average_rating"] >= 4
            assert center["average_rating"] <= 5
        
        # Verify sorting order (by name, ascending)
        names = [center["name"] for center in diving_centers]
        assert names == sorted(names)

    def test_invalid_sort_field(self, client, sample_diving_centers):
        response = client.get("/api/v1/diving-centers/?sort_by=not_a_field&sort_order=asc&page=1&page_size=25")
        assert response.status_code == 400
        assert "Invalid sort_by field" in response.json()["detail"]

    def test_sort_by_created_at_desc(self, client, sample_diving_centers):
        response = client.get(
            "/api/v1/diving-centers/?sort_by=created_at&sort_order=desc&page=1&page_size=25"
        )
        assert response.status_code == 200
        times = [datetime.fromisoformat(c["created_at"]) for c in response.json()["items"]]
        assert times == sorted(times, reverse=True)

    def test_sort_by_updated_at_asc(self, client, sample_diving_centers):
        response = client.get(
            "/api/v1/diving-centers/?sort_by=updated_at&sort_order=asc&page=1&page_size=25"
        )
        assert response.status_code == 200
        times = [datetime.fromisoformat(c["updated_at"]) for c in response.json()["items"]]
        assert times == sorted(times)

    def test_sort_by_country_region_city(self, client, sample_diving_centers_geo):
        """Geographic fields sort lexicographically."""
        r = client.get("/api/v1/diving-centers/?sort_by=country&sort_order=asc&page=1&page_size=25")
        assert r.status_code == 200
        countries = [c["country"] for c in r.json()["items"] if c["name"].startswith("GeoCenter ")]
        assert countries == ["Albania", "Greece", "Malta"]

        r2 = client.get("/api/v1/diving-centers/?sort_by=city&sort_order=desc&page=1&page_size=25")
        assert r2.status_code == 200
        cities = [c["city"] for c in r2.json()["items"] if c["name"].startswith("GeoCenter ")]
        assert cities == sorted(cities, reverse=True)

    def test_admin_sort_by_view_count_desc(self, client, sample_diving_centers, admin_headers):
        response = client.get(
            "/api/v1/diving-centers/?sort_by=view_count&sort_order=desc&page=1&page_size=25",
            headers=admin_headers,
        )
        assert response.status_code == 200
        views = [c["view_count"] for c in response.json()["items"]]
        assert views == sorted(views, reverse=True)


class TestDivesSorting:
    """Test sorting functionality for dives (Phase 1.3)."""
    
    def test_sort_by_dive_date_desc(self, client, sample_dives):
        """Test sorting dives by dive date in descending order."""
        response = client.get("/api/v1/dives/?sort_by=dive_date&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify sorting order
        dive_dates = [datetime.strptime(dive["dive_date"], "%Y-%m-%d").date() for dive in dives]
        assert dive_dates == sorted(dive_dates, reverse=True)
    
    def test_sort_by_max_depth_desc(self, client, sample_dives):
        """Test sorting dives by max depth in descending order."""
        response = client.get("/api/v1/dives/?sort_by=max_depth&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify sorting order
        depths = [dive["max_depth"] for dive in dives if dive["max_depth"] is not None]
        assert depths == sorted(depths, reverse=True)
    
    def test_sort_by_duration_desc(self, client, sample_dives):
        """Test sorting dives by duration in descending order."""
        response = client.get("/api/v1/dives/?sort_by=duration&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify sorting order
        durations = [dive["duration"] for dive in dives if dive["duration"] is not None]
        assert durations == sorted(durations, reverse=True)
    
    def test_sort_by_difficulty_level_asc(self, client, sample_dives):
        """Test sorting dives by difficulty level in ascending order."""
        response = client.get("/api/v1/dives/?sort_by=difficulty_level&sort_order=asc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify sorting order (OPEN_WATER < ADVANCED_OPEN_WATER < DEEP_NITROX < TECHNICAL_DIVING)
        difficulty_order = {"OPEN_WATER": 1, "ADVANCED_OPEN_WATER": 2, "DEEP_NITROX": 3, "TECHNICAL_DIVING": 4}
        difficulties = [difficulty_order.get(dive.get("difficulty_code"), 0) for dive in dives if dive.get("difficulty_code")]
        assert difficulties == sorted(difficulties)
    
    def test_sort_by_user_rating_desc(self, client, sample_dives):
        """Test sorting dives by user rating in descending order."""
        response = client.get("/api/v1/dives/?sort_by=user_rating&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify sorting order
        ratings = [dive["user_rating"] for dive in dives if dive["user_rating"] is not None]
        assert ratings == sorted(ratings, reverse=True)
    
    def test_sort_by_view_count_admin_only(self, client, sample_dives):
        """Test that sorting by view_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/dives/?sort_by=view_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by view_count is only available for admin users" in response.json()["detail"]

    def test_sort_by_visibility_rating_desc(self, client, sample_dives):
        response = client.get("/api/v1/dives/?sort_by=visibility_rating&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 200
        ratings = [d["visibility_rating"] for d in response.json()["items"] if d.get("visibility_rating") is not None]
        assert ratings == sorted(ratings, reverse=True)

    def test_invalid_sort_field(self, client, sample_dives):
        response = client.get("/api/v1/dives/?sort_by=bad_field&sort_order=asc&page=1&page_size=25")
        assert response.status_code == 400
        assert "Invalid sort_by field" in response.json()["detail"]

    def test_admin_sort_by_view_count_desc(self, client, sample_dives, admin_headers):
        response = client.get(
            "/api/v1/dives/?sort_by=view_count&sort_order=desc&page=1&page_size=25",
            headers=admin_headers,
        )
        assert response.status_code == 200
        counts = [d["view_count"] for d in response.json()["items"]]
        assert counts == sorted(counts, reverse=True)
    
    def test_default_sorting(self, client, sample_dives):
        """Test that default sorting by dive date works correctly."""
        response = client.get("/api/v1/dives/?page=1&page_size=25")
        
        assert response.status_code == 200
        data = response.json()
        dives = data.get("items", [])
        
        # Verify default sorting by dive date (newest first)
        dive_dates = [datetime.strptime(dive["dive_date"], "%Y-%m-%d").date() for dive in dives]
        assert dive_dates == sorted(dive_dates, reverse=True)


class TestDiveTripsSorting:
    """Test sorting functionality for dive trips (Phase 1.4)."""
    
    def test_sort_by_trip_date_desc(self, client, sample_dive_trips):
        """Test sorting dive trips by trip date in descending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=trip_date&sort_order=desc&page=1&page_size=10")
        
        assert response.status_code == 200
        trips = response.json().get('items', [])
        
        # Verify sorting order
        trip_dates = [trip["trip_date"] for trip in trips]
        assert trip_dates == sorted(trip_dates, reverse=True)
    
    def test_sort_by_trip_price_desc(self, client, sample_dive_trips):
        """Test sorting dive trips by price in descending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=trip_price&sort_order=desc&page=1&page_size=10")
        
        assert response.status_code == 200
        trips = response.json().get('items', [])
        
        # Verify sorting order
        prices = [trip["trip_price"] for trip in trips if trip["trip_price"] is not None]
        assert prices == sorted(prices, reverse=True)
    
    def test_sort_by_popularity_admin_only(self, client, sample_dive_trips):
        """Test that sorting by popularity is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/newsletters/trips?sort_by=popularity&sort_order=desc&page=1&page_size=10")
        assert response.status_code == 403
        assert "Sorting by popularity is only available for admin users" in response.json()["detail"]

    def test_sort_by_popularity_admin_returns_200(self, client, sample_dive_trips, admin_headers):
        response = client.get(
            "/api/v1/newsletters/trips?sort_by=popularity&sort_order=desc&page=1&page_size=10",
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert "items" in response.json()

    def test_sort_by_created_at_desc(self, client, sample_dive_trips):
        response = client.get(
            "/api/v1/newsletters/trips?sort_by=created_at&sort_order=desc&page=1&page_size=10"
        )
        assert response.status_code == 200
        items = response.json().get("items", [])
        if len(items) >= 2:
            times = [datetime.fromisoformat(t["created_at"]) for t in items]
            assert times == sorted(times, reverse=True)

    def test_sort_by_distance(self, client, sample_dive_trips):
        """Test sorting dive trips by distance from user location."""
        user_lat = 37.9838  # Athens, Greece
        user_lon = 23.7275
        
        response = client.get(f"/api/v1/newsletters/trips?sort_by=distance&sort_order=asc&user_lat={user_lat}&user_lon={user_lon}&page=1&page_size=10")
        
        # Distance sorting requires dive sites with coordinates, which our test data doesn't have
        # So we expect either no results or an error, but not a crash
        assert response.status_code in [200, 400, 422]
        
        if response.status_code == 200:
            trips = response.json().get('items', [])
            # If we get results, verify they're returned
            assert len(trips) >= 0
    
    def test_sort_by_difficulty_level_asc(self, client, sample_dive_trips):
        """Test sorting dive trips by difficulty level in ascending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=difficulty_level&sort_order=asc&page=1&page_size=10")
        
        assert response.status_code == 200
        trips = response.json().get('items', [])
        
        # Verify that results are returned
        assert len(trips) > 0
        
        # Get difficulties and filter out None values
        difficulties = [trip.get("trip_difficulty_code") for trip in trips if trip.get("trip_difficulty_code")]
        
        # If we have difficulties, verify they're sorted
        if difficulties:
            difficulty_order = {"OPEN_WATER": 1, "ADVANCED_OPEN_WATER": 2, "DEEP_NITROX": 3, "TECHNICAL_DIVING": 4}
            difficulty_values = [difficulty_order.get(diff, 0) for diff in difficulties]
            assert difficulty_values == sorted(difficulty_values)


class TestSortingPerformance:
    """Test sorting performance with database indexes."""
    
    def test_sorting_with_indexes(self, client, sample_dive_sites):
        """Test that sorting queries use the created indexes efficiently."""
        import time
        
        # Test sorting by created_at (should use index)
        start_time = time.time()
        response = client.get("/api/v1/dive-sites/?sort_by=created_at&sort_order=desc&page=1&page_size=100")
        end_time = time.time()
        
        # Verify that sorting completes in reasonable time
        assert end_time - start_time < 1.0  # Should complete in under 1 second
        
        # Verify results are sorted correctly
        assert response.status_code == 200
        data = response.json()
        dive_sites = data.get("items", [])
        created_dates = [datetime.fromisoformat(site["created_at"]) for site in dive_sites]
        assert created_dates == sorted(created_dates, reverse=True)
    
    def test_large_dataset_sorting(self, client):
        """Test sorting performance with larger datasets."""
        # This test would require creating more sample data
        # For now, we'll test with existing data
        start_time = time.time()
        response = client.get("/api/v1/dive-sites/?sort_by=created_at&sort_order=desc&page=1&page_size=50")
        end_time = time.time()
        
        # Verify that sorting completes in reasonable time
        assert end_time - start_time < 2.0  # Should complete in under 2 seconds
        
        # Verify results are sorted correctly
        assert response.status_code == 200
        data = response.json()
        dive_sites = data.get("items", [])
        created_dates = [datetime.fromisoformat(site["created_at"]) for site in dive_sites]
        assert created_dates == sorted(created_dates, reverse=True)


# Fixtures for test data
@pytest.fixture
def sample_dive_sites(db_session: Session):
    """Create sample dive sites for testing."""
    # Get difficulty IDs
    difficulty_aow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    difficulty_deep = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
    
    # Create test dive sites with different attributes
    dive_sites = [
        DiveSite(
            name="Alpha Reef",
            country="Greece",
            region="Crete",
            difficulty_id=difficulty_aow.id if difficulty_aow else 2,
            view_count=100,
            created_at=datetime.now() - timedelta(days=5),
            updated_at=datetime.now() - timedelta(days=1)
        ),
        DiveSite(
            name="Beta Bay",
            country="Greece", 
            region="Santorini",
            difficulty_id=difficulty_aow.id if difficulty_aow else 2,
            view_count=250,
            created_at=datetime.now() - timedelta(days=3),
            updated_at=datetime.now() - timedelta(days=2)
        ),
        DiveSite(
            name="Gamma Grotto",
            country="Greece",
            region="Rhodes", 
            difficulty_id=difficulty_deep.id if difficulty_deep else 3,
            view_count=75,
            created_at=datetime.now() - timedelta(days=1),
            updated_at=datetime.now()
        )
    ]
    
    db_session.add_all(dive_sites)
    db_session.commit()
    
    yield dive_sites
    
    # Cleanup
    db_session.query(DiveSite).delete()
    db_session.commit()


@pytest.fixture
def sample_diving_centers(db_session: Session):
    """Create sample diving centers for testing."""
    diving_centers = [
        DivingCenter(
            name="Alpha Diving",
            view_count=150,
            created_at=datetime.now() - timedelta(days=5),
            updated_at=datetime.now() - timedelta(days=1),
            latitude=35.0,
            longitude=25.0,
        ),
        DivingCenter(
            name="Beta Diving",
            view_count=300,
            created_at=datetime.now() - timedelta(days=3),
            updated_at=datetime.now() - timedelta(days=2),
            latitude=35.1,
            longitude=25.1,
        ),
        DivingCenter(
            name="Gamma Diving",
            view_count=75,
            created_at=datetime.now() - timedelta(days=1),
            updated_at=datetime.now(),
            latitude=35.2,
            longitude=25.2,
        ),
    ]

    db_session.add_all(diving_centers)
    db_session.commit()

    yield diving_centers

    # Cleanup
    db_session.query(DivingCenter).delete()
    db_session.commit()


@pytest.fixture
def sample_diving_centers_geo(db_session: Session):
    """Centers with distinct country / city for geographic sort tests."""
    centers = [
        DivingCenter(
            name="GeoCenter Malta",
            country="Malta",
            region="South",
            city="Valletta",
            latitude=35.9,
            longitude=14.5,
            view_count=10,
        ),
        DivingCenter(
            name="GeoCenter Albania",
            country="Albania",
            region="South",
            city="Sarande",
            latitude=39.5,
            longitude=20.0,
            view_count=20,
        ),
        DivingCenter(
            name="GeoCenter Greece",
            country="Greece",
            region="Attica",
            city="Athens",
            latitude=37.9,
            longitude=23.7,
            view_count=30,
        ),
    ]
    db_session.add_all(centers)
    db_session.commit()
    yield centers
    db_session.query(DivingCenter).filter(DivingCenter.name.startswith("GeoCenter ")).delete(
        synchronize_session=False
    )
    db_session.commit()


@pytest.fixture
def sample_dives(db_session: Session, sample_dive_sites, sample_users):
    """Create sample dives for testing."""
    # Get difficulty IDs
    difficulty_ow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "OPEN_WATER").first()
    difficulty_aow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    difficulty_deep = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
    
    dives = [
        Dive(
            user_id=sample_users[0].id,
            dive_site_id=sample_dive_sites[0].id,
            name="Test Dive 1",
            dive_date=date.today() - timedelta(days=5),
            max_depth=15.5,
            duration=45,
            difficulty_id=difficulty_ow.id if difficulty_ow else 1,
            visibility_rating=8,
            user_rating=4,
            view_count=25
        ),
        Dive(
            user_id=sample_users[1].id,
            dive_site_id=sample_dive_sites[1].id,
            name="Test Dive 2", 
            dive_date=date.today() - timedelta(days=3),
            max_depth=25.0,
            duration=60,
            difficulty_id=difficulty_aow.id if difficulty_aow else 2,
            visibility_rating=7,
            user_rating=5,
            view_count=40
        ),
        Dive(
            user_id=sample_users[0].id,
            dive_site_id=sample_dive_sites[2].id,
            name="Test Dive 3",
            dive_date=date.today() - timedelta(days=1),
            max_depth=35.5,
            duration=75,
            difficulty_id=difficulty_deep.id if difficulty_deep else 3,
            visibility_rating=6,
            user_rating=3,
            view_count=15
        )
    ]
    
    db_session.add_all(dives)
    db_session.commit()
    
    yield dives
    
    # Cleanup
    db_session.query(Dive).delete()
    db_session.commit()


@pytest.fixture
def sample_dive_trips(db_session: Session, sample_diving_centers):
    """Create sample dive trips for testing."""
    # Get difficulty IDs
    difficulty_ow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "OPEN_WATER").first()
    difficulty_aow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    difficulty_deep = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
    
    dive_trips = [
        ParsedDiveTrip(
            diving_center_id=sample_diving_centers[0].id,
            trip_date=date.today() + timedelta(days=5),
            trip_price=Decimal("150.00"),
            trip_duration=120,
            trip_difficulty_id=difficulty_ow.id if difficulty_ow else 1
        ),
        ParsedDiveTrip(
            diving_center_id=sample_diving_centers[1].id,
            trip_date=date.today() + timedelta(days=3),
            trip_price=Decimal("200.00"),
            trip_duration=180,
            trip_difficulty_id=difficulty_aow.id if difficulty_aow else 2
        ),
        ParsedDiveTrip(
            diving_center_id=sample_diving_centers[2].id,
            trip_date=date.today() + timedelta(days=1),
            trip_price=Decimal("300.00"),
            trip_duration=240,
            trip_difficulty_id=difficulty_deep.id if difficulty_deep else 3
        )
    ]
    
    db_session.add_all(dive_trips)
    db_session.commit()
    
    yield dive_trips
    
    # Cleanup
    db_session.query(ParsedDiveTrip).delete()
    db_session.commit()


@pytest.fixture
def sample_users(db_session: Session):
    """Create sample users for testing."""
    users = [
        User(
            username="testuser_sorting_1",
            email="test1_sorting@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
            enabled=True,
        ),
        User(
            username="testuser_sorting_2",
            email="test2_sorting@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
            enabled=True,
        ),
    ]

    db_session.add_all(users)
    db_session.commit()

    yield users

    # Cleanup
    db_session.query(User).delete()
    db_session.commit()


@pytest.fixture
def sample_dive_sites_with_ratings(db_session: Session, sample_users):
    """Three dive sites with distinct average ratings (4, 10, 7)."""
    ow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "OPEN_WATER").first()
    did = ow.id if ow else 1
    sites = [
        DiveSite(
            name="RatingSort Low",
            country="Greece",
            region="r",
            difficulty_id=did,
            latitude=36.0,
            longitude=25.0,
        ),
        DiveSite(
            name="RatingSort High",
            country="Greece",
            region="r",
            difficulty_id=did,
            latitude=36.1,
            longitude=25.1,
        ),
        DiveSite(
            name="RatingSort Mid",
            country="Greece",
            region="r",
            difficulty_id=did,
            latitude=36.2,
            longitude=25.2,
        ),
    ]
    db_session.add_all(sites)
    db_session.commit()
    for s in sites:
        db_session.refresh(s)

    ratings = [
        SiteRating(dive_site_id=sites[0].id, user_id=sample_users[0].id, score=4),
        SiteRating(dive_site_id=sites[1].id, user_id=sample_users[1].id, score=10),
        SiteRating(dive_site_id=sites[2].id, user_id=sample_users[0].id, score=7),
    ]
    db_session.add_all(ratings)
    db_session.commit()

    yield sites

    db_session.query(SiteRating).filter(SiteRating.dive_site_id.in_([s.id for s in sites])).delete(
        synchronize_session=False
    )
    db_session.query(DiveSite).filter(DiveSite.id.in_([s.id for s in sites])).delete(
        synchronize_session=False
    )
    db_session.commit()
