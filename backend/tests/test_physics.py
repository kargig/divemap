
from app.physics import (
    GasMix, 
    calculate_z_factor, 
    calculate_real_volume, 
    calculate_pressure_from_volume,
    check_isobaric_counterdiffusion
)
import pytest

def test_z_factor_air_surface():
    # Air at 1 bar should be close to ideal (Z=1)
    air = GasMix(o2=21, he=0)
    z = calculate_z_factor(1.0, air)
    assert abs(z - 1.0) < 0.01

def test_z_factor_air_high_pressure():
    # Air at 200 bar compresses LESS than ideal (Z > 1)
    air = GasMix(o2=21, he=0)
    z = calculate_z_factor(200.0, air)
    assert z > 1.0
    # Expected approx range 1.05 - 1.10 for 200 bar air
    assert 1.0 < z < 1.15

def test_real_volume_air_200bar():
    # 12L tank at 200 bar
    # Ideal: 12 * 200 = 2400 L
    # Real: Less than 2400 because Z > 1
    air = GasMix(o2=21, he=0)
    vol = calculate_real_volume(12, 200, air)
    
    # Calculate expected roughly
    # z ~ 1.07
    # P_surf = 1.01325
    # V = (200 * 12) / (1.01325 * 1.07) ~ 2213 L
    assert vol < 2400
    assert 2100 < vol < 2300

def test_icd_check_trimix_to_air():
    # Switching from Trimix 21/35 (35% He) to Air (0% He, 79% N2)
    # Current: 21% O2, 35% He, 44% N2
    # Next: 21% O2, 0% He, 79% N2
    # dHe = -35
    # dN2 = +35
    # Rule of Fifths: 5 * dN2 > -dHe ?
    # 5 * 35 = 175. 175 > 35. Yes -> Warning.
    
    tx = GasMix(o2=21, he=35)
    air = GasMix(o2=21, he=0)
    
    result = check_isobaric_counterdiffusion(tx, air)
    assert result.warning is True
    assert "Isobaric Counterdiffusion risk" in result.message

def test_icd_check_safe_switch():
    # Switching from Tx 18/45 to Tx 50/25 (Deco gas)
    # Current: 18% O2, 45% He, 37% N2
    # Next: 50% O2, 25% He, 25% N2
    # dHe = -20
    # dN2 = -12 (N2 actually decreases too, so no ICD risk from N2 loading)
    
    deep_gas = GasMix(o2=18, he=45)
    deco_gas = GasMix(o2=50, he=25)
    
    result = check_isobaric_counterdiffusion(deep_gas, deco_gas)
    assert result.warning is False
