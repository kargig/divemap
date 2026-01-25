"""
Wind Recommendation Service

Service to calculate dive site suitability based on wind conditions.
Considers both wind direction and wind speed to provide safety recommendations.
"""

from typing import Optional, Dict, Literal
import math

# Wind speed thresholds (in m/s)
WIND_SPEED_GOOD_THRESHOLD = 6.2  # ~12 knots - safe for diving below this threshold
WIND_SPEED_CAUTION_THRESHOLD = 7.7  # ~15 knots
WIND_SPEED_DIFFICULT_THRESHOLD = 10.0  # ~20 knots
WIND_GUST_UPGRADE_THRESHOLD = 13.0  # ~25 knots

# Marine thresholds
WAVE_HEIGHT_CAUTION = 0.5  # meters
WAVE_HEIGHT_DIFFICULT = 1.0  # meters
WAVE_HEIGHT_AVOID = 1.5  # meters
WAVE_PERIOD_SURGE = 8.0  # seconds

# Conversion factors
KNOTS_TO_MS = 0.514444  # 1 knot = 0.514444 m/s
KMH_TO_MS = 0.277778  # 1 km/h = 0.277778 m/s


def normalize_wind_speed(wind_speed: float, unit: str = "m/s") -> float:
    """
    Normalize wind speed to m/s.
    
    Args:
        wind_speed: Wind speed value
        unit: Unit of wind_speed ('m/s', 'km/h', 'knots')
    
    Returns:
        Wind speed in m/s
    """
    unit_lower = unit.lower()
    if unit_lower == "m/s" or unit_lower == "ms":
        return wind_speed
    elif unit_lower == "km/h" or unit_lower == "kmh":
        return wind_speed * KMH_TO_MS
    elif unit_lower == "knots" or unit_lower == "kt":
        return wind_speed * KNOTS_TO_MS
    else:
        # Default to m/s if unknown unit
        return wind_speed


def calculate_angle_difference(angle1: float, angle2: float) -> float:
    """
    Calculate the smallest angle difference between two angles (0-360 degrees).
    
    Handles 360° wrap correctly.
    """
    diff = abs(angle1 - angle2)
    # Handle wrap-around (e.g., 350° and 10° = 20° difference, not 340°)
    if diff > 180:
        diff = 360 - diff
    return diff


def get_wind_speed_category(wind_speed_ms: float) -> Literal["light", "moderate", "strong", "very_strong"]:
    """
    Categorize wind speed.
    
    Returns:
        "light" (< 6.2 m/s / ~12 knots - safe), "moderate" (6.2-7.7 m/s / 12-15 knots), 
        "strong" (7.7-10 m/s / 15-20 knots), "very_strong" (> 10 m/s / > 20 knots)
    """
    if wind_speed_ms < WIND_SPEED_GOOD_THRESHOLD:  # < 6.2 m/s
        return "light"
    elif wind_speed_ms < WIND_SPEED_CAUTION_THRESHOLD:  # 6.2-7.7 m/s
        return "moderate"
    elif wind_speed_ms < WIND_SPEED_DIFFICULT_THRESHOLD:  # 7.7-10 m/s
        return "strong"
    else:  # > 10 m/s
        return "very_strong"


def calculate_wind_suitability(
    wind_direction: float,
    wind_speed: float,
    shore_direction: Optional[float],
    wind_gusts: Optional[float] = None,
    wind_speed_unit: str = "m/s",
    wave_height: Optional[float] = None,
    wave_period: Optional[float] = None
) -> Dict[str, any]:
    """
    Calculate suitability for a dive site based on wind and marine conditions.
    
    Args:
        wind_direction: Wind direction in degrees (0-360, where wind is coming FROM)
        wind_speed: Wind speed
        shore_direction: Shore direction in degrees (0-360, direction shore faces) or None
        wind_gusts: Wind gusts (optional, in same unit as wind_speed)
        wind_speed_unit: Unit of wind_speed and wind_gusts ('m/s', 'km/h', 'knots')
        wave_height: Wave height in meters (optional)
        wave_period: Wave period in seconds (optional)
    
    Returns:
        Dictionary with:
        - suitability: 'good', 'caution', 'difficult', 'avoid', or 'unknown'
        - reasoning: Human-readable explanation
        - wind_speed_category: 'light', 'moderate', 'strong', 'very_strong'
    """
    # Normalize wind speed to m/s
    wind_speed_ms = normalize_wind_speed(wind_speed, wind_speed_unit)
    
    # Normalize gusts if available
    wind_gusts_ms = None
    if wind_gusts:
        wind_gusts_ms = normalize_wind_speed(wind_gusts, wind_speed_unit)
    
    # Use sustained wind speed for base calculation (gusts only upgrade severity, don't replace speed)
    effective_wind_speed = wind_speed_ms
    gusts_upgrade_severity = False
    
    # Check if gusts should upgrade severity (gusts > 25 knots / 13 m/s)
    if wind_gusts_ms and wind_gusts_ms > WIND_GUST_UPGRADE_THRESHOLD:
        gusts_upgrade_severity = True
    
    wind_speed_category = get_wind_speed_category(effective_wind_speed)
    
    # --- Wind Suitability Calculation ---
    
    # If no shore direction, can't determine direction-based suitability
    if shore_direction is None:
        # Still check wind speed alone
        wind_suitability = None
        wind_reasoning = None
        
        if effective_wind_speed >= WIND_SPEED_DIFFICULT_THRESHOLD:
            wind_suitability = "avoid"
            wind_reasoning = f"Wind speed {effective_wind_speed:.1f} m/s ({effective_wind_speed / KNOTS_TO_MS:.1f} knots) is too dangerous for shore diving regardless of direction"
        else:
            wind_suitability = "unknown"
            wind_reasoning = "Shore direction unknown - cannot determine direction-based suitability"
        
        # Apply gust upgrade if applicable
        if gusts_upgrade_severity and wind_suitability != "avoid":
            # Upgrade unknown -> caution if gusts are strong
            if wind_suitability == "unknown":
                wind_suitability = "caution"
                wind_reasoning += f" (strong gusts detected)"
        
    else:
        # Calculate angle difference between wind and shore direction
        angle_diff = calculate_angle_difference(wind_direction, shore_direction)
        
        # Determine base direction suitability
        if angle_diff <= 45:
            direction_status = "unfavorable"  # Wind blowing onto shore
        elif angle_diff <= 90:
            direction_status = "somewhat_unfavorable"
        else:
            direction_status = "favorable"
        
        # Calculate base suitability based on speed and direction
        if effective_wind_speed >= WIND_SPEED_DIFFICULT_THRESHOLD:
            # > 20 knots: Too dangerous regardless of direction
            wind_suitability = "avoid"
            wind_reasoning = (
                f"Wind speed {effective_wind_speed:.1f} m/s ({effective_wind_speed / KNOTS_TO_MS:.1f} knots) "
                f"is too dangerous for shore diving regardless of direction"
            )
        elif effective_wind_speed >= WIND_SPEED_CAUTION_THRESHOLD:
            # 15-20 knots: Challenging conditions
            if direction_status == "unfavorable":
                wind_suitability = "avoid"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) blowing onto shore facing {shore_direction:.0f}° - "
                    f"AVOID (dangerous conditions)"
                )
            elif direction_status == "somewhat_unfavorable":
                wind_suitability = "difficult"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) - DIFFICULT (strong winds, experienced divers only)"
                )
            else:  # favorable
                wind_suitability = "difficult"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) - DIFFICULT (strong winds, experienced divers only)"
                )
        elif effective_wind_speed >= WIND_SPEED_GOOD_THRESHOLD:
            # 6.2-7.7 m/s (12-15 knots): Moderate conditions
            if direction_status == "unfavorable":
                wind_suitability = "caution"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) - CAUTION (moderate winds with unfavorable direction)"
                )
            elif direction_status == "somewhat_unfavorable":
                wind_suitability = "caution"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) - CAUTION (moderate winds with somewhat unfavorable direction)"
                )
            else:  # favorable
                wind_suitability = "good"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) favorable for shore facing {shore_direction:.0f}° - "
                    f"GOOD conditions"
                )
        else:
            # < 6.2 m/s (~12 knots): Safe conditions
            if direction_status == "unfavorable":
                wind_suitability = "caution"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) - CAUTION (light winds with unfavorable direction)"
                )
            else:
                wind_suitability = "good"
                wind_reasoning = (
                    f"Wind from {wind_direction:.0f}° at {effective_wind_speed:.1f} m/s "
                    f"({effective_wind_speed / KNOTS_TO_MS:.1f} knots) favorable for shore facing {shore_direction:.0f}° - "
                    f"GOOD conditions (safe for diving)"
                )
        
        # Apply gust upgrade to wind suitability
        if gusts_upgrade_severity:
            if wind_suitability == "good":
                wind_suitability = "caution"
                wind_reasoning = wind_reasoning.replace("GOOD", "CAUTION (upgraded due to strong gusts)")
            elif wind_suitability == "caution":
                wind_suitability = "difficult"
                wind_reasoning = wind_reasoning.replace("CAUTION", "DIFFICULT (upgraded due to strong gusts)")
            elif wind_suitability == "difficult":
                wind_suitability = "avoid"
                wind_reasoning = wind_reasoning.replace("DIFFICULT", "AVOID (upgraded due to strong gusts)")
    
    # --- Marine Suitability Calculation ---
    
    marine_suitability = "good"
    marine_reasoning_parts = []
    
    if wave_height is not None:
        if wave_height >= WAVE_HEIGHT_AVOID:
            marine_suitability = "avoid"
            marine_reasoning_parts.append(f"Waves {wave_height:.1f}m - AVOID (dangerous shore break)")
        elif wave_height >= WAVE_HEIGHT_DIFFICULT:
            marine_suitability = "difficult"
            marine_reasoning_parts.append(f"Waves {wave_height:.1f}m - DIFFICULT (challenging entry)")
        elif wave_height >= WAVE_HEIGHT_CAUTION:
            marine_suitability = "caution"
            marine_reasoning_parts.append(f"Waves {wave_height:.1f}m - CAUTION (moderate chop)")
    
    # Check for surge (long period waves)
    if wave_period is not None and wave_period >= WAVE_PERIOD_SURGE:
        # Surge makes entry/exit harder, especially if there are waves
        if marine_suitability == "good":
            # Only downgrade to caution if waves are minimal but period is long
            # (though usually long period implies swell)
            if wave_height is not None and wave_height >= 0.3:
                marine_suitability = "caution"
                marine_reasoning_parts.append(f"Period {wave_period:.1f}s - CAUTION (surge risk)")
        elif marine_suitability == "caution":
            marine_suitability = "difficult"
            marine_reasoning_parts.append(f"Period {wave_period:.1f}s - DIFFICULT (strong surge)")
        # If already difficult or avoid, surge just adds to the reasoning but doesn't change category
        elif marine_suitability == "difficult":
             marine_reasoning_parts.append(f"Period {wave_period:.1f}s (strong surge)")

    # --- Combine Suitabilities ---
    
    # Determine overall suitability: worst case wins
    # Order: unknown < good < caution < difficult < avoid
    # (Using numeric values for comparison)
    suitability_rank = {
        "unknown": 0,
        "good": 1,
        "caution": 2,
        "difficult": 3,
        "avoid": 4
    }
    
    final_suitability = wind_suitability
    current_rank = suitability_rank.get(wind_suitability, 0)
    
    # Marine data can override if worse
    marine_rank = suitability_rank.get(marine_suitability, 0)
    
    if marine_rank > current_rank:
        final_suitability = marine_suitability
        # If wind was unknown, take marine directly
        if current_rank == 0:
            wind_reasoning = "" # Clear "unknown" message if we have definitive marine data? 
            # Or keep it? "Shore direction unknown... BUT Waves 1.6m - AVOID"
            pass
    
    # Combine reasoning
    final_reasoning = wind_reasoning
    if marine_reasoning_parts:
        if final_reasoning:
            final_reasoning += ". " + ". ".join(marine_reasoning_parts)
        else:
            final_reasoning = ". ".join(marine_reasoning_parts)
            
    # Add gust info if not already added
    if wind_gusts_ms:
        if f"gusts up to {wind_gusts_ms / KNOTS_TO_MS:.1f} knots" not in (final_reasoning or ""):
             final_reasoning += f" (gusts up to {wind_gusts_ms / KNOTS_TO_MS:.1f} knots)"
    
    return {
        "suitability": final_suitability,
        "reasoning": final_reasoning,
        "wind_speed_category": wind_speed_category
    }

