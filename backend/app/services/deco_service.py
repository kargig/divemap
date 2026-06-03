from typing import List, Dict, Any, Optional, Tuple

def calculate_deco_ceiling(
    samples: List[Dict[str, Any]], 
    gf_low: int = 30, 
    gf_high: int = 70,
    cylinders: Optional[List[Dict[str, Any]]] = None,
    events: Optional[List[Dict[str, Any]]] = None
) -> Tuple[List[float], Optional[List[float]], Optional[List[List[float]]]]:
    """
    Calculate the decompression ceiling, final tissue saturation, and heatmap data.
    Uses octo-deco's internal Bühlmann ZH-L16 implementation.
    
    This implementation avoids using the 'DiveProfile' wrapper to bypass 
    heavy 'pandas' dependencies during common listing requests.
    """
    if not samples:
        return [], None, None

    # Defer heavy engine import to local scope
    from octodeco.deco.Buhlmann import Buhlmann
    from octodeco.deco.Gas import Air, Nitrox, Trimix
    from octodeco.deco import Util

    # 1. Setup Gases
    gas_map = {}
    default_gas = Air()
    
    def parse_fraction(val):
        if val is None: return None
        if isinstance(val, str):
            val = val.replace('%', '').strip()
        try:
            return float(val)
        except ValueError:
            return None

    if cylinders:
        for i, c in enumerate(cylinders):
            o2 = parse_fraction(c.get('o2'))
            he = parse_fraction(c.get('he'))
            
            if o2 is None and he is None:
                g = Air()
            elif he is None or he == 0:
                g = Nitrox(o2 or 21.0)
            else:
                g = Trimix(o2 or 21.0, he)
            
            gas_map[str(i)] = g
            gas_map[str(i+1)] = g

    # 2. Extract Gas Switches
    switches = {}
    if events:
        for e in events:
            if (e.get('name') == 'gaschange' or e.get('type') == '25') and 'cylinder' in e:
                time_mins = e.get('time_minutes', 0)
                cyl_idx = str(e.get('cylinder'))
                if cyl_idx in gas_map:
                    switches[time_mins] = gas_map[cyl_idx]

    # 3. Initialize Model
    # Note: DiveProfile usually handles some defaults, we pass them manually here.
    # Note the spelling: 'gas_swich_mins' (missing 't') is how it's defined in octo-deco.
    deco_model = Buhlmann(
        gf_low, gf_high, 
        descent_speed=20, 
        ascent_speed=10, 
        max_pO2_deco=1.6, 
        gas_swich_mins=3.0, 
        last_stop_depth=3
    )
    
    # Feed samples and update tissues
    first_sample_time = samples[0].get('time_minutes', 0)
    current_gas = default_gas
    sorted_switch_times = sorted(switches.keys())
    
    # Initialize state at surface
    current_tissue_state = deco_model.cleared_tissue_state()
    
    ceiling_list = []
    heatmap_data = []
    
    last_time = 0.0
    last_p_amb = Util.depth_to_Pamb(samples[0]['depth'])
    
    for i, s in enumerate(samples):
        # Normalize time to start at 0.0
        normalized_time = max(0.0, s.get('time_minutes', 0) - first_sample_time)
        duration = normalized_time - last_time
        
        # Check for gas switch
        for t in sorted_switch_times:
            if t <= s.get('time_minutes', 0):
                current_gas = switches[t]
            else:
                break
        
        p_amb = Util.depth_to_Pamb(s['depth'])
        
        if i > 0:
            # Update tissue state based on interval
            p_amb_section = (p_amb + last_p_amb) / 2.0
            current_tissue_state = current_tissue_state.updated_state(duration, p_amb_section, current_gas)
        
        # Calculate ceiling for current state
        # Note: DiveProfile uses a more complex amb_to_gf tracking, 
        # but for backfilling, p_ceiling_for_gf_now(gf_high) is a good approximation
        # of the surface-relative risk shown in our heatmap.
        p_ceil = current_tissue_state.p_ceiling_for_gf_now(gf_high / 100.0)
        ceil_depth = round(max(0, (p_ceil - 1.0) * 10.0), 2)
        ceiling_list.append(ceil_depth)
        
        # Heatmap row (GF99 relative to surface)
        heatmap_row = [round(float(gf), 1) for gf in current_tissue_state.GF99s(1.0)]
        heatmap_data.append(heatmap_row)
        
        last_time = normalized_time
        last_p_amb = p_amb
            
    final_saturation = heatmap_data[-1] if heatmap_data else None
            
    return ceiling_list, final_saturation, heatmap_data
