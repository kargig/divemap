import pytest
from app.services.deco_service import calculate_deco_ceiling

def test_calculate_deco_ceiling_empty():
    ceilings, tissues, heatmap = calculate_deco_ceiling([])
    assert ceilings == []
    assert tissues is None
    assert heatmap is None

def test_calculate_deco_ceiling_basic():
    # A simple dive: 10 mins at 30m
    samples = []
    for i in range(11):
        samples.append({
            'time_minutes': float(i),
            'depth': 30.0 if i > 0 else 0.0
        })
    
    ceilings, tissues, heatmap = calculate_deco_ceiling(samples, gf_low=30, gf_high=70)
    assert len(ceilings) == len(samples)
    assert all(isinstance(c, (int, float)) for c in ceilings)
    
    # Tissue data should be present
    assert tissues is not None
    assert len(tissues) == 16
    assert all(isinstance(val, (int, float)) for val in tissues)
    
    # Heatmap data should be present
    assert heatmap is not None
    assert len(heatmap) == len(samples)

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
    
    # Ascent to surface
    samples.append({'time_minutes': 27.0, 'depth': 0.0})
    
    ceilings, tissues, heatmap = calculate_deco_ceiling(samples, gf_low=30, gf_high=70)
    
    # Check that ceiling increases over time
    assert max(ceilings) > 0
    # Final ceiling should be significant
    assert ceilings[-1] > 3.0
    
    # Check tissues (should be high for fast compartments)
    assert tissues is not None
    # Fast compartments (index 0-2) should be heavily loaded
    assert any(val > 100 for val in tissues[:5])
    
    # Check heatmap
    assert heatmap is not None
    assert len(heatmap) == len(samples)
