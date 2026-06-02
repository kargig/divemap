import pytest
from app.services.deco_service import calculate_deco_ceiling

def test_calculate_deco_ceiling_empty():
    assert calculate_deco_ceiling([]) == []

def test_calculate_deco_ceiling_basic():
    # A simple dive: 10 mins at 30m
    samples = []
    for i in range(11):
        samples.append({
            'time_minutes': float(i),
            'depth': 30.0 if i > 0 else 0.0
        })
    
    ceilings = calculate_deco_ceiling(samples, gf_low=30, gf_high=70)
    assert len(ceilings) == len(samples)
    # At 30m for 10 mins, we might not have mandatory deco but we should have tissue loading
    # The ceiling should be 0 or very shallow for an air dive at 30m for 10 min
    assert all(isinstance(c, (int, float)) for c in ceilings)

def test_calculate_deco_ceiling_with_deco():
    # A deeper/longer dive to trigger mandatory deco
    # 40m for 20 mins on Air
    samples = []
    # Descent
    samples.append({'time_minutes': 0.0, 'depth': 0.0})
    samples.append({'time_minutes': 2.0, 'depth': 40.0})
    # Bottom
    for i in range(3, 23):
        samples.append({'time_minutes': float(i), 'depth': 40.0})
    
    ceilings = calculate_deco_ceiling(samples, gf_low=30, gf_high=70)
    
    # Check that ceiling increases over time
    assert max(ceilings) > 0
    # Final ceiling should be significant
    assert ceilings[-1] > 3.0 
