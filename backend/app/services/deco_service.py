from octodeco.deco.DiveProfile import DiveProfile
from octodeco.deco.Gas import Air, Gas
from typing import List, Dict, Any, Optional, Tuple

def calculate_deco_ceiling(samples: List[Dict[str, Any]], gf_low: int = 30, gf_high: int = 70) -> Tuple[List[float], Optional[List[float]], Optional[List[List[float]]]]:
    """
    Calculate the decompression ceiling, final tissue saturation, and heatmap data.
    Uses octo-deco's internal Bühlmann ZH-L16 implementation.
    
    Args:
        samples: List of dicts with 'time_minutes' and 'depth' (meters)
        gf_low: Gradient Factor Low (e.g., 30)
        gf_high: Gradient Factor High (e.g., 70)
        
    Returns:
        Tuple containing:
        1. List of calculated ceiling depths in meters.
        2. List of 16 GF99 percentages for final tissue saturation (or None).
        3. 2D List (Time x 16 Compartments) of surface-relative GF99 saturation for heatmap.
    """
    if not samples:
        return [], None, None
    
    # ... rest of setup ...
    profile = DiveProfile(gf_low=gf_low, gf_high=gf_high)
    air = Air()
    profile.add_gas(air)
    
    # Feed samples into profile
    # octo-deco requires the first point to be at time 0.0
    first_sample_time = samples[0].get('time_minutes', 0)
    
    for i, s in enumerate(samples):
        # Shift all samples so the first one starts at 0.0 to satisfy octo-deco's requirement
        # and ensure we have a valid baseline for tissue loading.
        normalized_time = max(0.0, s.get('time_minutes', 0) - first_sample_time)
        
        if i == 0:
            # Overwrite the default initial point at time 0
            profile._points[0].time = 0.0
            profile._points[0].depth = s['depth']
            profile._points[0].gas = air
        else:
            profile._append_point_abstime(normalized_time, s['depth'], air)
            
    profile.update_deco_info()
    
    # Extract the ceiling from the library's internal dataframe
    # The 'Ceil' column correctly implements the Gradient Factor line (gf_low to gf_high)
    df = profile.dataframe()
    
    # Ensure we return a list of floats matching the input size
    ceilings = df['Ceil'].tolist()
    
    # Round for storage and UI
    ceiling_list = [round(float(c), 2) for c in ceilings]
    
    # Extract final tissue status and full heatmap data
    final_saturation = None
    heatmap_data = []
    all_points = profile.points()
    
    for p in all_points:
        # Calculate GF99 relative to SURFACE (1.0 bar) for the heatmap
        # This shows how "at risk" the tissues are if the diver ascended instantly
        if hasattr(p, 'tissue_state'):
            # GF99s(1.0) returns a list of 16 GF99 percentages relative to surface
            row = [round(float(gf), 1) for gf in p.tissue_state.GF99s(1.0)]
            heatmap_data.append(row)
            
    if all_points:
        # For the final saturation bar chart, use the last point's heatmap row
        final_saturation = heatmap_data[-1]
            
    return ceiling_list, final_saturation, heatmap_data
