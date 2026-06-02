from octodeco.deco.DiveProfile import DiveProfile
from octodeco.deco.Gas import Air, Gas
from typing import List, Dict, Any, Optional

def calculate_deco_ceiling(samples: List[Dict[str, Any]], gf_low: int = 30, gf_high: int = 70) -> List[float]:
    """
    Calculate the decompression ceiling for a series of dive samples.
    Uses octo-deco's internal Bühlmann ZH-L16 implementation.
    
    Args:
        samples: List of dicts with 'time_minutes' and 'depth' (meters)
        gf_low: Gradient Factor Low (e.g., 30)
        gf_high: Gradient Factor High (e.g., 70)
        
    Returns:
        List of calculated ceiling depths in meters.
    """
    if not samples:
        return []

    # Initialize octodeco profile with provided GFs
    # DiveProfile expects GFs in the 0-100 range (default 35/70)
    profile = DiveProfile(gf_low=gf_low, gf_high=gf_high)
    air = Air()
    profile.add_gas(air)
    
    # Feed samples into profile
    for i, s in enumerate(samples):
        if i == 0:
            # Overwrite the default initial point at time 0
            profile._points[0].time = s['time_minutes']
            profile._points[0].depth = s['depth']
            profile._points[0].gas = air
        else:
            profile._append_point_abstime(s['time_minutes'], s['depth'], air)
    
    # Run the full deco simulation
    # This calculates gas uptake/release and the resulting ceiling line
    profile.update_deco_info()
    
    # Extract the ceiling from the library's internal dataframe
    # The 'Ceil' column correctly implements the Gradient Factor line (gf_low to gf_high)
    df = profile.dataframe()
    
    # Ensure we return a list of floats matching the input size
    ceilings = df['Ceil'].tolist()
    
    # Round for storage and UI
    return [round(float(c), 2) for c in ceilings]
