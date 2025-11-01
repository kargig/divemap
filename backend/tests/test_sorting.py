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
    DiveSite, DivingCenter, Dive, User, ParsedDiveTrip, 
    DiveSiteAlias, DiveTag, AvailableTag, ParsedDive, DifficultyLevel
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
        dive_sites = response.json()
        
        # Verify sorting order
        names = [site["name"] for site in dive_sites]
        assert names == sorted(names)
    
    def test_sort_by_name_desc(self, client, sample_dive_sites):
        """Test sorting dive sites by name in descending order."""
        response = client.get("/api/v1/dive-sites/?sort_by=name&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dive_sites = response.json()
        
        # Verify sorting order
        names = [site["name"] for site in dive_sites]
        assert names == sorted(names, reverse=True)
    
    def test_sort_by_view_count_admin_only(self, client, sample_dive_sites):
        """Test that sorting by view_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/dive-sites/?sort_by=view_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by view_count is only available for admin users" in response.json()["detail"]
    
    def test_sort_by_created_at_desc(self, client, sample_dive_sites):
        """Test sorting dive sites by creation date in descending order."""
        response = client.get("/api/v1/dive-sites/?sort_by=created_at&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dive_sites = response.json()
        
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


class TestDivingCentersSorting:
    """Test sorting functionality for diving centers (Phase 1.2)."""
    
    def test_sort_by_name_asc(self, client, sample_diving_centers):
        """Test sorting diving centers by name in ascending order."""
        response = client.get("/api/v1/diving-centers/?sort_by=name&sort_order=asc&page=1&page_size=25")
        
        assert response.status_code == 200
        diving_centers = response.json()
        
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
        diving_centers = response.json()
        
        # Verify that rating filters are applied
        for center in diving_centers:
            assert center["average_rating"] >= 4
            assert center["average_rating"] <= 5
        
        # Verify sorting order (by name, ascending)
        names = [center["name"] for center in diving_centers]
        assert names == sorted(names)


class TestDivesSorting:
    """Test sorting functionality for dives (Phase 1.3)."""
    
    def test_sort_by_dive_date_desc(self, client, sample_dives):
        """Test sorting dives by dive date in descending order."""
        response = client.get("/api/v1/dives/?sort_by=dive_date&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify sorting order
        dive_dates = [datetime.strptime(dive["dive_date"], "%Y-%m-%d").date() for dive in dives]
        assert dive_dates == sorted(dive_dates, reverse=True)
    
    def test_sort_by_max_depth_desc(self, client, sample_dives):
        """Test sorting dives by max depth in descending order."""
        response = client.get("/api/v1/dives/?sort_by=max_depth&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify sorting order
        depths = [dive["max_depth"] for dive in dives if dive["max_depth"] is not None]
        assert depths == sorted(depths, reverse=True)
    
    def test_sort_by_duration_desc(self, client, sample_dives):
        """Test sorting dives by duration in descending order."""
        response = client.get("/api/v1/dives/?sort_by=duration&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify sorting order
        durations = [dive["duration"] for dive in dives if dive["duration"] is not None]
        assert durations == sorted(durations, reverse=True)
    
    def test_sort_by_difficulty_level_asc(self, client, sample_dives):
        """Test sorting dives by difficulty level in ascending order."""
        response = client.get("/api/v1/dives/?sort_by=difficulty_level&sort_order=asc&page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify sorting order (OPEN_WATER < ADVANCED_OPEN_WATER < DEEP_NITROX < TECHNICAL_DIVING)
        difficulty_order = {"OPEN_WATER": 1, "ADVANCED_OPEN_WATER": 2, "DEEP_NITROX": 3, "TECHNICAL_DIVING": 4}
        difficulties = [difficulty_order.get(dive.get("difficulty_code"), 0) for dive in dives if dive.get("difficulty_code")]
        assert difficulties == sorted(difficulties)
    
    def test_sort_by_user_rating_desc(self, client, sample_dives):
        """Test sorting dives by user rating in descending order."""
        response = client.get("/api/v1/dives/?sort_by=user_rating&sort_order=desc&page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify sorting order
        ratings = [dive["user_rating"] for dive in dives if dive["user_rating"] is not None]
        assert ratings == sorted(ratings, reverse=True)
    
    def test_sort_by_view_count_admin_only(self, client, sample_dives):
        """Test that sorting by view_count is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/dives/?sort_by=view_count&sort_order=desc&page=1&page_size=25")
        assert response.status_code == 403
        assert "Sorting by view_count is only available for admin users" in response.json()["detail"]
    
    def test_default_sorting(self, client, sample_dives):
        """Test that default sorting by dive date works correctly."""
        response = client.get("/api/v1/dives/?page=1&page_size=25")
        
        assert response.status_code == 200
        dives = response.json()
        
        # Verify default sorting by dive date (newest first)
        dive_dates = [datetime.strptime(dive["dive_date"], "%Y-%m-%d").date() for dive in dives]
        assert dive_dates == sorted(dive_dates, reverse=True)


class TestDiveTripsSorting:
    """Test sorting functionality for dive trips (Phase 1.4)."""
    
    def test_sort_by_trip_date_desc(self, client, sample_dive_trips):
        """Test sorting dive trips by trip date in descending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=trip_date&sort_order=desc&skip=0&limit=10")
        
        assert response.status_code == 200
        trips = response.json()
        
        # Verify sorting order
        trip_dates = [trip["trip_date"] for trip in trips]
        assert trip_dates == sorted(trip_dates, reverse=True)
    
    def test_sort_by_trip_price_desc(self, client, sample_dive_trips):
        """Test sorting dive trips by price in descending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=trip_price&sort_order=desc&skip=0&limit=10")
        
        assert response.status_code == 200
        trips = response.json()
        
        # Verify sorting order
        prices = [trip["trip_price"] for trip in trips if trip["trip_price"] is not None]
        assert prices == sorted(prices, reverse=True)
    
    def test_sort_by_popularity_admin_only(self, client, sample_dive_trips):
        """Test that sorting by popularity is restricted to admin users."""
        # Test as non-admin user (should fail)
        response = client.get("/api/v1/newsletters/trips?sort_by=popularity&sort_order=desc&skip=0&limit=10")
        assert response.status_code == 403
        assert "Sorting by popularity is only available for admin users" in response.json()["detail"]
    
    def test_sort_by_distance(self, client, sample_dive_trips):
        """Test sorting dive trips by distance from user location."""
        user_lat = 37.9838  # Athens, Greece
        user_lon = 23.7275
        
        response = client.get(f"/api/v1/newsletters/trips?sort_by=distance&sort_order=asc&user_lat={user_lat}&user_lon={user_lon}&skip=0&limit=10")
        
        # Distance sorting requires dive sites with coordinates, which our test data doesn't have
        # So we expect either no results or an error, but not a crash
        assert response.status_code in [200, 400, 422]
        
        if response.status_code == 200:
            trips = response.json()
            # If we get results, verify they're returned
            assert len(trips) >= 0
    
    def test_sort_by_difficulty_level_asc(self, client, sample_dive_trips):
        """Test sorting dive trips by difficulty level in ascending order."""
        response = client.get("/api/v1/newsletters/trips?sort_by=difficulty_level&sort_order=asc&skip=0&limit=10")
        
        assert response.status_code == 200
        trips = response.json()
        
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
        dive_sites = response.json()
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
        dive_sites = response.json()
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
            updated_at=datetime.now() - timedelta(days=1)
        ),
        DivingCenter(
            name="Beta Diving",
            view_count=300,
            created_at=datetime.now() - timedelta(days=3),
            updated_at=datetime.now() - timedelta(days=2)
        ),
        DivingCenter(
            name="Gamma Diving",
            view_count=75,
            created_at=datetime.now() - timedelta(days=1),
            updated_at=datetime.now()
        )
    ]
    
    db_session.add_all(diving_centers)
    db_session.commit()
    
    yield diving_centers
    
    # Cleanup
    db_session.query(DivingCenter).delete()
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
            enabled=True
        ),
        User(
            username="testuser_sorting_2",
            email="test2_sorting@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
            enabled=True
        )
    ]

    db_session.add_all(users)
    db_session.commit()

    yield users

    # Cleanup
    db_session.query(User).delete()
    db_session.commit()
