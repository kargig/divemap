import orjson
import re

# Tank matching constants
TANK_DEFINITIONS = [
    {'id': '3', 'size': 3.0},
    {'id': 'al40', 'size': 5.7},
    {'id': 'alu7', 'size': 7.0},
    {'id': '7', 'size': 7.0},
    {'id': '8.5', 'size': 8.5},
    {'id': '10', 'size': 10.0},
    {'id': 'al80', 'size': 11.1},
    {'id': '12', 'size': 12.0},
    {'id': '14', 'size': 14.0},
    {'id': '15', 'size': 15.0},
    {'id': '18', 'size': 18.0},
    {'id': 'double_al80', 'size': 22.2},
    {'id': '24', 'size': 24.0},
]

def match_tank_id(vol_liters):
    """Find closest matching tank ID for a given volume"""
    if not vol_liters:
        return '12'
    best_id = '12'
    min_diff = float('inf')
    for tank in TANK_DEFINITIONS:
        diff = abs(tank['size'] - vol_liters)
        if diff < min_diff:
            min_diff = diff
            best_id = tank['id']
    return best_id

def is_aluminum_tank(cyl):
    """Check if a cylinder is likely aluminum based on description and work pressure"""
    desc = str(cyl.get('description') or '').lower()
    wp = str(cyl.get('workpressure') or '').lower()
    
    # Aluminum keywords
    alu_keywords = ['al40', 'al80', 'alu', 'aluminum', 'aluminium', 'luxfer', 's080', 's040', '80cf', '40cf']
    for kw in alu_keywords:
        if kw in desc:
            return True
            
    # "al" as a standalone word or prefix
    if re.search(r'\bal\b|\bal\d+', desc):
        return True
            
    # Work pressure check: Aluminum is usually 207 bar (3000 psi)
    if '207' in wp or '3000' in wp:
        return True
        
    return False

def create_structured_gas_data(cylinders, events=None):
    """Convert cylinder list to structured JSON string"""
    if not cylinders:
        return None
    
    def clean_val(val, suffix=None):
        if val is None: return 0.0
        if isinstance(val, (int, float)): return float(val)
        s = str(val).lower()
        if suffix: s = s.replace(suffix.lower(), "")
        try:
            return float(s.strip())
        except ValueError:
            return 0.0

    # Per user request: if any cylinder has both start and end pressure,
    # we assume only those with pressures are actually used and relevant.
    any_has_pressure = any(bool(cyl.get('start') and cyl.get('end')) for cyl in cylinders)
    
    valid_cylinders = []
    for cyl in cylinders:
        has_start = bool(cyl.get('start'))
        has_end = bool(cyl.get('end'))
        
        if any_has_pressure:
            # If some gasses have pressure data, only keep those with BOTH pressures
            if has_start and has_end:
                valid_cylinders.append(cyl)
        else:
            # Fallback for dives without any pressure data (e.g. manual entries)
            # Keep gasses that have at least some defining characteristics
            if bool(cyl.get('size')) or bool(cyl.get('o2')) or bool(cyl.get('he')) or \
               (bool(cyl.get('description')) and cyl.get('description') != 'unknown'):
                valid_cylinders.append(cyl)
    
    if not valid_cylinders:
        return None
        
    back_gas_index = 0
    
    # 1. Size heuristic: larger tank is usually back gas
    if len(valid_cylinders) >= 2:
        try:
            size0 = clean_val(valid_cylinders[0].get('size'), ' l')
            size1 = clean_val(valid_cylinders[1].get('size'), ' l')
            if size0 > 0 and size1 > 0 and size0 < size1:
                back_gas_index = 1
        except Exception:
            pass

    # 2. Material heuristic: prefer steel for back gas
    if len(valid_cylinders) >= 2:
        is_0_alu = is_aluminum_tank(valid_cylinders[0])
        is_1_alu = is_aluminum_tank(valid_cylinders[1])
        
        if is_0_alu and not is_1_alu:
            # 0 is alu, 1 is likely steel -> prefer 1
            back_gas_index = 1
        elif not is_0_alu and is_1_alu:
            # 0 is likely steel, 1 is alu -> prefer 0
            back_gas_index = 0

    # 3. Explicit gaschange events (strongest indicator)
    if events:
        for event in events:
            if event.get('type') == 'gaschange' and event.get('time_minutes') == 0:
                try:
                    idx = int(event.get('cylinder'))
                    if idx < len(valid_cylinders):
                        back_gas_index = idx
                        break
                except Exception:
                    pass

    structured = {"mode": "structured", "back_gas": None, "stages": []}
    for i, cyl in enumerate(valid_cylinders):
        vol = clean_val(cyl.get('size'), ' l')
        tank_id = match_tank_id(vol)
        o2 = int(clean_val(cyl.get('o2'), '%') or 21)
        he = int(clean_val(cyl.get('he'), '%') or 0)
        
        start_p = clean_val(cyl.get('start'), ' bar')
        if not start_p and not cyl.get('start') in [0, 0.0, "0"]:
            start_p = None
        else:
            start_p = int(start_p)
            
        end_p = clean_val(cyl.get('end'), ' bar')
        if not end_p and not cyl.get('end') in [0, 0.0, "0"]:
            end_p = None
        else:
            end_p = int(end_p)
        
        tank_obj = {
            "tank": tank_id,
            "start_pressure": start_p,
            "end_pressure": end_p,
            "gas": {"o2": o2, "he": he},
            "index": i,
            "description": cyl.get('description'),
            "workpressure": cyl.get('workpressure'),
            "depth": cyl.get('depth')
        }
        
        if i == back_gas_index:
            structured["back_gas"] = tank_obj
        else:
            structured["stages"].append(tank_obj)
            
    return orjson.dumps(structured).decode('utf-8')
