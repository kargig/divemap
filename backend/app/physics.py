"""
Core physics module for dive calculations.
Based on algorithms from Subsurface (https://github.com/subsurface/subsurface).

This module implements:
1. Real Gas Law (Compressibility/Z-Factor) using Virial expansion.
2. Gas Laws (Dalton's Law, partial pressures).
3. Isobaric Counterdiffusion (ICD) checks.
4. Unit conversions and standard constants.
"""

from typing import Tuple, Optional, Dict, List
from pydantic import BaseModel

# -----------------------------------------------------------------------------
# Constants & Enums
# -----------------------------------------------------------------------------

# Subsurface uses 1.01325 bar as standard surface pressure for volume conversions
SURFACE_PRESSURE_BAR = 1.01325

class GasMix(BaseModel):
    """
    Represents a breathing gas mixture.
    Percentages should be 0-100 (e.g., 21 for Air).
    """
    o2: float
    he: float = 0.0

    @property
    def n2(self) -> float:
        return 100.0 - self.o2 - self.he

    @property
    def is_air(self) -> bool:
        return abs(self.o2 - 21.0) < 0.1 and self.he < 0.1

    @property
    def is_trimix(self) -> bool:
        return self.he > 0.0

# -----------------------------------------------------------------------------
# Compressibility (Z-Factor) - Real Gas Law
# -----------------------------------------------------------------------------

def calculate_z_factor(pressure_bar: float, gas: GasMix) -> float:
    """
    Calculates the gas compressibility factor (Z) using the Virial equation.
    Based on Subsurface implementation (core/compressibility.c / core/gas.c).
    
    Z = PV / nRT
    Z = 1 + B/V + C/V^2 ... approximated via pressure series for diving ranges.
    
    Args:
        pressure_bar: Pressure in bar.
        gas: GasMix object.
        
    Returns:
        float: The compressibility factor Z.
    """
    # Clamp pressure to 0-500 bar range as per Subsurface to avoid polynomial explosion
    p = max(0.0, min(pressure_bar, 500.0))

    # Coefficients from Subsurface (3rd order virial expansion)
    # These are empirical coefficients for O2, N2, He
    O2_COEFFS = [-7.18092073703e-4, 2.81852572808e-6, -1.50290620492e-9]
    N2_COEFFS = [-2.19260353292e-4, 2.92844845532e-6, -2.07613482075e-9]
    HE_COEFFS = [4.87320026468e-4, -8.83632921053e-8, 5.33304543646e-11]

    def virial(coeffs: List[float], x: float) -> float:
        return x * coeffs[0] + (x ** 2) * coeffs[1] + (x ** 3) * coeffs[2]

    # Subsurface calculation uses weighted averages of the virial terms
    # Note: Subsurface code uses permille (0-1000), we convert to that scale for the formula match
    o2_permille = gas.o2 * 10.0
    he_permille = gas.he * 10.0
    n2_permille = gas.n2 * 10.0

    # The formula essentially calculates Z-1 (z_minus_1) scaled by 1000
    z_m1 = (virial(O2_COEFFS, p) * o2_permille + 
            virial(HE_COEFFS, p) * he_permille + 
            virial(N2_COEFFS, p) * n2_permille)

    # Convert back: Z = 1 + (Weighted_Virial_Sum / 1000)
    return z_m1 * 0.001 + 1.0

def calculate_real_volume(tank_water_volume_liters: float, pressure_bar: float, gas: GasMix) -> float:
    """
    Calculates the actual volume of gas (at surface pressure) in a tank, accounting for compressibility.
    
    Real Volume = (Tank_Water_Vol * Pressure) / Z
    (Note: Adjusted for surface pressure reference)
    
    Args:
        tank_water_volume_liters: Wet volume of the tank (e.g., 12L).
        pressure_bar: Current pressure in the tank.
        gas: The gas mixture.
        
    Returns:
        float: Equivalent surface volume in liters.
    """
    if pressure_bar <= 0:
        return 0.0
    
    z = calculate_z_factor(pressure_bar, gas)
    
    # Standard formula: V_surface = (P_tank * V_tank) / (P_surface * Z)
    return (pressure_bar * tank_water_volume_liters) / (SURFACE_PRESSURE_BAR * z)

def calculate_pressure_from_volume(surface_volume_liters: float, tank_water_volume_liters: float, gas: GasMix) -> float:
    """
    Inverse of calculate_real_volume. Iteratively solves for pressure given a gas volume.
    Useful for "How much pressure do I need for X liters of gas?"
    """
    # Initial guess using Ideal Gas Law: P = (V_surf * P_surf) / V_tank
    p_guess = (surface_volume_liters * SURFACE_PRESSURE_BAR) / tank_water_volume_liters
    
    # Newton-Raphson or simple iteration to converge
    for _ in range(5):
        z = calculate_z_factor(p_guess, gas)
        p_new = (surface_volume_liters * SURFACE_PRESSURE_BAR * z) / tank_water_volume_liters
        if abs(p_new - p_guess) < 0.1:
            return p_new
        p_guess = p_new
        
    return p_guess

# -----------------------------------------------------------------------------
# Partial Pressures & Depths
# -----------------------------------------------------------------------------

def depth_to_bar(depth_meters: float, surface_pressure: float = 1.013) -> float:
    """Calculates absolute ambient pressure at depth (ATA/bar)."""
    # Simple approx: depth/10 + surface. 
    # For higher precision, density of water (salt/fresh) could be a parameter.
    return (depth_meters / 10.0) + surface_pressure

def calculate_mod(gas: GasMix, pp_o2_max: float) -> float:
    """
    Calculates Maximum Operating Depth (MOD) in meters.
    MOD = (ppO2_max / fO2 - surface_pressure) * 10
    """
    if gas.o2 <= 0:
        return 0.0
    
    f_o2 = gas.o2 / 100.0
    max_ata = pp_o2_max / f_o2
    return max(0.0, (max_ata - 1.0) * 10.0)

def calculate_end(depth_meters: float, gas: GasMix) -> float:
    """
    Calculates Equivalent Narcotic Depth (END).
    Assumes O2 is narcotic (standard recreational/tech view).
    Formula: END = (Depth + 10) * (1 - fHe) - 10
    """
    f_he = gas.he / 100.0
    return (depth_meters + 10.0) * (1.0 - f_he) - 10.0

def calculate_ead(depth_meters: float, gas: GasMix) -> float:
    """
    Calculates Equivalent Air Depth (EAD) for Nitrox.
    EAD = (Depth + 10) * (fN2 / 0.79) - 10
    """
    f_n2 = gas.n2 / 100.0
    return (depth_meters + 10.0) * (f_n2 / 0.79) - 10.0

# -----------------------------------------------------------------------------
# Safety Checks
# -----------------------------------------------------------------------------

class ICDResult(BaseModel):
    warning: bool
    delta_n2: float
    delta_he: float
    message: Optional[str] = None

def check_isobaric_counterdiffusion(current_gas: GasMix, next_gas: GasMix) -> ICDResult:
    """
    Checks for Isobaric Counterdiffusion (ICD) risks when switching gases.
    Implements the 'Rule of Fifths': Nitrogen increase should not exceed 1/5th of Helium decrease.
    
    Based on Subsurface: core/gas.cpp -> isobaric_counterdiffusion()
    
    Args:
        current_gas: The gas being breathed currently.
        next_gas: The gas being switched to.
        
    Returns:
        ICDResult: Warning flag and delta values.
    """
    # Delta N2 (increase is positive)
    d_n2 = next_gas.n2 - current_gas.n2
    
    # Delta He (decrease is negative)
    d_he = next_gas.he - current_gas.he
    
    # Logic:
    # 1. Current gas must have Helium (>0)
    # 2. Switching results in N2 increase (>0)
    # 3. Switching results in He decrease (<0)
    # 4. Rule check: 5 * delta_N2 > -delta_He (Magnitude of N2 rise is large relative to He drop)
    
    warning = False
    message = None
    
    if current_gas.he > 0 and d_n2 > 0 and d_he < 0:
        # Subsurface logic: 5 * results->dN2 > -results->dHe
        if 5 * d_n2 > -d_he:
            warning = True
            message = (
                f"ICD Warning: Isobaric Counterdiffusion risk detected. "
                f"Nitrogen increase ({d_n2:.1f}%) is more than 1/5th of Helium decrease ({abs(d_he):.1f}%)."
            )

    return ICDResult(
        warning=warning,
        delta_n2=d_n2,
        delta_he=d_he,
        message=message
    )
