import pytest
from app.services.wind_recommendation_service import calculate_wind_suitability

class TestWindRecommendationService:
    def test_calculate_wind_suitability_with_marine_data_high_waves(self):
        """Test suitability downgrade due to high waves despite low wind."""
        result = calculate_wind_suitability(
            wind_direction=180,
            wind_speed=2.0,  # Light wind (Good)
            shore_direction=0,  # Favorable direction (offshore)
            wave_height=1.6, # High waves (> 1.5m -> Avoid)
            wave_period=5.0
        )
        assert result["suitability"] == "avoid"
        assert "Waves 1.6m" in result["reasoning"]
        assert "AVOID" in result["reasoning"]

    def test_calculate_wind_suitability_with_marine_data_moderate_waves(self):
        """Test suitability downgrade to caution/difficult for moderate waves."""
        result = calculate_wind_suitability(
            wind_direction=180,
            wind_speed=2.0,  # Light wind
            shore_direction=0,
            wave_height=0.8, # Moderate waves (0.5-1.0m -> Caution)
            wave_period=5.0
        )
        assert result["suitability"] == "caution"
        assert "Waves 0.8m" in result["reasoning"]

    def test_calculate_wind_suitability_with_surge_risk(self):
        """Test upgrade due to long period swell (surge risk)."""
        result = calculate_wind_suitability(
            wind_direction=180,
            wind_speed=2.0,
            shore_direction=0,
            wave_height=0.6, # Caution range
            wave_period=9.0  # Long period (> 8s) -> Upgrade to Difficult
        )
        assert result["suitability"] == "difficult"
        assert "strong surge" in result["reasoning"].lower()

    def test_calculate_wind_suitability_marine_data_ignored_if_none(self):
        """Test that missing marine data doesn't break existing logic."""
        result = calculate_wind_suitability(
            wind_direction=180,
            wind_speed=5.0,  # Good
            shore_direction=0,
            wave_height=None,
            wave_period=None
        )
        assert result["suitability"] == "good"
