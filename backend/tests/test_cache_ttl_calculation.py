"""
Unit tests for cache TTL calculation function.

Tests the time-based caching strategy where TTL varies based on forecast distance.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.services.open_meteo_service import _calculate_cache_ttl


class TestCacheTTLCalculation:
    """Test cases for _calculate_cache_ttl function."""

    def test_current_time_none(self):
        """Test TTL for current time requests (target_datetime = None)."""
        now = datetime.now()
        ttl = _calculate_cache_ttl(None, now)
        assert ttl == timedelta(hours=1)

    def test_past_datetime(self):
        """Test TTL for past forecasts (should use shortest cache)."""
        now = datetime.now()
        past = now - timedelta(hours=2)
        ttl = _calculate_cache_ttl(past, now)
        assert ttl == timedelta(hours=1)

    def test_2_hours_from_now(self):
        """Test TTL for forecast 2 hours from now (0-6hrs range: dynamic)."""
        now = datetime.now()
        future = now + timedelta(hours=2)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=2)

    def test_5_hours_from_now(self):
        """Test TTL for forecast 5 hours from now (0-6hrs range: dynamic)."""
        now = datetime.now()
        future = now + timedelta(hours=5)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=5)

    def test_6_hours_from_now_boundary(self):
        """Test TTL for forecast exactly 6 hours from now (boundary case)."""
        now = datetime.now()
        future = now + timedelta(hours=6)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=6)

    def test_7_hours_from_now(self):
        """Test TTL for forecast 7 hours from now (6-12hrs range: 3 hours fixed)."""
        now = datetime.now()
        future = now + timedelta(hours=7)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=3)

    def test_10_hours_from_now(self):
        """Test TTL for forecast 10 hours from now (6-12hrs range: 3 hours fixed)."""
        now = datetime.now()
        future = now + timedelta(hours=10)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=3)

    def test_12_hours_from_now_boundary(self):
        """Test TTL for forecast exactly 12 hours from now (boundary case)."""
        now = datetime.now()
        future = now + timedelta(hours=12)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=3)

    def test_15_hours_from_now(self):
        """Test TTL for forecast 15 hours from now (12-24hrs range: 2 hours fixed)."""
        now = datetime.now()
        future = now + timedelta(hours=15)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=2)

    def test_24_hours_from_now_boundary(self):
        """Test TTL for forecast exactly 24 hours from now (boundary case)."""
        now = datetime.now()
        future = now + timedelta(hours=24)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=2)

    def test_36_hours_from_now(self):
        """Test TTL for forecast 36 hours from now (24+hrs range: 1 hour fixed)."""
        now = datetime.now()
        future = now + timedelta(hours=36)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=1)

    def test_48_hours_from_now(self):
        """Test TTL for forecast 48 hours from now (24+hrs range: 1 hour fixed)."""
        now = datetime.now()
        future = now + timedelta(hours=48)
        ttl = _calculate_cache_ttl(future, now)
        assert ttl == timedelta(hours=1)

    def test_minutes_precision(self):
        """Test TTL calculation with minutes precision (should round to hours)."""
        now = datetime.now()
        # 2 hours and 30 minutes from now
        future = now + timedelta(hours=2, minutes=30)
        ttl = _calculate_cache_ttl(future, now)
        # Should return approximately 2.5 hours (dynamic TTL)
        expected = timedelta(hours=2, minutes=30)
        assert abs((ttl - expected).total_seconds()) < 1  # Within 1 second

    def test_mixed_naive_and_aware_datetimes(self):
        """Test that _calculate_cache_ttl handles any combination of naive and aware datetimes."""
        base_time = datetime(2026, 10, 17, 12, 0, 0)
        now_aware = base_time.replace(tzinfo=UTC)
        now_naive = base_time

        future_aware = now_aware + timedelta(hours=2)
        future_naive = now_naive + timedelta(hours=2)

        # Aware now, naive future
        ttl_1 = _calculate_cache_ttl(future_naive, now_aware)
        assert ttl_1 == timedelta(hours=2)

        # Naive now, aware future
        ttl_2 = _calculate_cache_ttl(future_aware, now_naive)
        assert ttl_2 == timedelta(hours=2)

        # Both aware
        ttl_3 = _calculate_cache_ttl(future_aware, now_aware)
        assert ttl_3 == timedelta(hours=2)

        # Both naive
        ttl_4 = _calculate_cache_ttl(future_naive, now_naive)
        assert ttl_4 == timedelta(hours=2)
