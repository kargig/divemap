import orjson
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

from .gas_utils import create_structured_gas_data

def pa_to_bar(pa: Optional[float]) -> Optional[float]:
    """Convert Pascals to Bar."""
    return round(pa / 100000.0, 1) if pa is not None else None

def parse_suunto_json_file(json_content: bytes) -> Dict[str, Any]:
    """
    Parse a Suunto JSON file and return a standardized dive dictionary.
    Supports both Format A (D5, EON Core) and Format B (Ocean).
    Incorporates logic from Subsurface import-suunto-json.cpp.
    """
    try:
        data = orjson.loads(json_content)
    except Exception as e:
        logger.error(f"Failed to parse Suunto JSON: {e}")
        raise ValueError(f"Invalid JSON content: {e}")

    device_log = data.get("DeviceLog", {})
    header = device_log.get("Header", {})
    diving = header.get("Diving", {})
    samples_raw = device_log.get("Samples", [])
    sample_interval = header.get("SampleInterval", 10)

    # Device identification for Gas Offset logic
    device = header.get("Device", {})
    model = device.get("Name", "Suunto Device")
    # Subsurface identifies "Vaasa" (Nautic) and "Porvoo" (Ocean) as 0-indexed
    # EON Core/Steel and D5 are 1-indexed
    gas_offset = 1
    if any(m in model for m in ["Ocean", "Porvoo", "Vaasa", "Nautic"]):
        gas_offset = 0

    # Basic metadata
    dt_str = header.get("DateTime")
    dive_date = ""
    dive_time = ""
    if dt_str:
        try:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            dive_date = dt.date().isoformat()
            dive_time = dt.strftime("%H:%M:%S")
        except ValueError:
            logger.warning(f"Invalid DateTime format: {dt_str}")

    # Duration: Suunto often provides it in seconds (Duration) or minutes (DiveTime)
    duration_sec = header.get("Duration")
    if duration_sec is None:
        duration_sec = header.get("DiveTime", 0)
    
    duration_min = int(duration_sec // 60)
    algorithm = diving.get("Algorithm", "Suunto Algorithm")

    # Surface Pressure (useful for depth calculation)
    surface_pressure = diving.get("SurfacePressure") or header.get("SurfacePressure")
    # If not in header, look in first sample
    if not surface_pressure and samples_raw:
        surface_pressure = samples_raw[0].get("SurfacePressure") or samples_raw[0].get("AbsPressure")

    # GPS (Format B)
    location = header.get("DiveRouteOrigin")
    latitude = location.get("Latitude") if location else None
    longitude = location.get("Longitude") if location else None

    # Gas Information
    gases = diving.get("Gases", [])
    o2_percent = 21
    he_percent = 0
    cylinders = []

    if gases:
        for i, g in enumerate(gases):
            o2 = int(g.get("Oxygen", 0.21) * 100)
            he = int(g.get("Helium", 0) * 100)
            size = g.get("TankSize", 0.012) * 1000 # m3 to L
            start_p = pa_to_bar(g.get("StartPressure") or g.get("TankFillPressure"))
            end_p = pa_to_bar(g.get("EndPressure"))
            
            cyl = {
                "size": size,
                "o2": o2,
                "he": he,
                "start": start_p,
                "end": end_p,
                "index": i, # Our internal index
                "suunto_index": i + gas_offset, # For event matching
                "state": g.get("State")
            }
            cylinders.append(cyl)
            
            if g.get("State") == "Primary" or i == 0:
                o2_percent = o2
                he_percent = he
    else:
        mixture = diving.get("AlgorithmBottomMixture")
        if mixture:
            o2_percent = int(mixture.get("Oxygen", 0.21) * 100)
            he_percent = int(mixture.get("Helium", 0) * 100)

    # Profile Samples & Events
    samples = []
    events = []
    max_depth = 0.0
    sum_depth = 0.0
    depth_count = 0
    min_temp = None
    max_temp = None
    last_temp = None
    sum_ventilation = 0.0
    ventilation_count = 0
    
    start_dt = None
    if dt_str:
        try:
            start_dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    for i, s in enumerate(samples_raw):
        sample_time_str = s.get("TimeISO8601")
        time_minutes = 0.0
        if sample_time_str and start_dt:
            try:
                sample_dt = datetime.fromisoformat(sample_time_str.replace("Z", "+00:00"))
                time_minutes = (sample_dt - start_dt).total_seconds() / 60.0
            except ValueError:
                time_minutes = (i * sample_interval) / 60.0
        else:
            time_minutes = (i * sample_interval) / 60.0

        depth = s.get("Depth")
        # Depth calculation from pressure if Depth field is missing (Subsurface logic)
        if depth is None and s.get("AbsPressure") and surface_pressure:
            # 100,000 Pa approx 10m in salt water
            # Subsurface uses 1000mbar / 10m
            depth = (s["AbsPressure"] - surface_pressure) / 10000.0
            if depth < 0: depth = 0.0

        if depth is not None:
            if depth > max_depth:
                max_depth = depth
            sum_depth += depth
            depth_count += 1

        # Temperature (with carry-forward)
        temp_k = s.get("Temperature")
        temp_c = round(temp_k - 273.15, 1) if temp_k is not None else last_temp
        if temp_c is not None:
            last_temp = temp_c
            if min_temp is None or temp_c < min_temp: min_temp = temp_c
            if max_temp is None or temp_c > max_temp: max_temp = temp_c

        # NDL, Deco, and TTS
        ndl_sec = s.get("NoDecTime")
        ceiling = s.get("Ceiling", 0.0)
        tts_sec = s.get("TimeToSurface")
        cns_sample = s.get("CNS")
        
        pressure = pa_to_bar(s.get("Pressure"))
        
        # Ventilation (m3/s to L/min)
        vent = s.get("Ventilation")
        if vent is not None:
            sum_ventilation += vent * 60000.0
            ventilation_count += 1

        sample_dict = {
            "time_minutes": round(time_minutes, 3),
            "depth": round(depth, 2) if depth is not None else None,
            "temperature": temp_c,
            "pressure": pressure,
            "ndl_minutes": round(ndl_sec / 60.0, 1) if ndl_sec is not None else None,
            "stopdepth": round(ceiling, 1) if ceiling > 0 else None,
            "in_deco": ceiling > 0,
            "tts_minutes": round(tts_sec / 60.0, 1) if tts_sec is not None else None,
            "cns_percent": round(cns_sample * 100, 1) if cns_sample is not None else None
        }
        
        if depth is not None or vent is not None or pressure is not None:
            samples.append(sample_dict)

        # Event Parsing (Subsurface style)
        
        # Format A: Events Array
        for e in s.get("Events", []):
            for evt_type, evt_data in e.items():
                if evt_type == "GasSwitch":
                    # Map Suunto GasNumber to our cylinder index using offset
                    raw_num = evt_data.get("GasNumber", 0)
                    cyl_idx = raw_num - gas_offset
                    events.append({
                        "time_minutes": round(time_minutes, 2),
                        "type": "gaschange",
                        "name": "gaschange",
                        "o2": f"{int(evt_data.get('Oxygen', 0) * 100)}%" if "Oxygen" in evt_data else None,
                        "cylinder": str(cyl_idx if cyl_idx >= 0 else 0)
                    })
                elif evt_type == "Alarm":
                    events.append({
                        "time_minutes": round(time_minutes, 2),
                        "type": "warning",
                        "name": evt_data.get("Type", "Unknown Alarm")
                    })
        
        # Format B: DiveEvents Object
        dive_events = s.get("DiveEvents")
        if dive_events:
            if "GasSwitch" in dive_events:
                gs = dive_events["GasSwitch"]
                raw_num = gs.get("GasNumber", 0)
                cyl_idx = raw_num - gas_offset
                events.append({
                    "time_minutes": round(time_minutes, 2),
                    "type": "gaschange",
                    "name": "gaschange",
                    "cylinder": str(cyl_idx if cyl_idx >= 0 else 0)
                })
            if "Alarm" in dive_events:
                alm = dive_events["Alarm"]
                events.append({
                    "time_minutes": round(time_minutes, 2),
                    "type": "warning",
                    "name": alm.get("Type", "Alarm")
                })
            if "State" in dive_events:
                st = dive_events["State"]
                events.append({
                    "time_minutes": round(time_minutes, 2),
                    "type": "info",
                    "name": st.get("Type", "State Change")
                })

    avg_depth = round(sum_depth / depth_count, 2) if depth_count > 0 else 0.0
    avg_sac = round(sum_ventilation / ventilation_count, 1) if ventilation_count > 0 else None
    
    # Extract end-of-dive summary data from Diving header
    # Subsurface-style extraction: CNS and OTU are in EndTissue
    end_tissue = diving.get("EndTissue", {})
    max_cns = end_tissue.get("CNS")
    otu = end_tissue.get("OTU")
    
    if max_cns is None and samples:
        # Fallback: scan samples for max CNS if not in header
        cns_values = [s.get("cns_percent") for s in samples if s.get("cns_percent") is not None]
        if cns_values:
            max_cns = max(cns_values) / 100.0 # samples are already in %

    # Calculate SAC from cylinder pressures if ventilation is missing
    final_sac = avg_sac
    if not final_sac and duration_min > 0:
        # Try to find primary cylinder
        primary_cyl = next((c for c in cylinders if c.get("state") == "Primary"), cylinders[0] if cylinders else None)
        if primary_cyl:
            try:
                def to_float(val):
                    if val is None: return 0.0
                    if isinstance(val, (int, float)): return float(val)
                    try:
                        return float(str(val).split()[0])
                    except (ValueError, IndexError, AttributeError):
                        return 0.0

                vol = to_float(primary_cyl.get("size"))
                start_p = to_float(primary_cyl.get("start"))
                
                # If end_p is missing in header, look for it in the last sample
                end_p = to_float(primary_cyl.get("end"))
                if not end_p:
                    # Scan samples backwards for the last recorded tank pressure
                    for s in reversed(samples):
                        if s.get("pressure") is not None:
                            end_p = s["pressure"]
                            break
                
                if vol and start_p and end_p and start_p > 0 and end_p > 0 and start_p > end_p:
                    ata_avg = (avg_depth / 10.0) + 1.0
                    final_sac = round((vol * (start_p - end_p)) / duration_min / ata_avg, 3)
            except (ValueError, KeyError, IndexError, ZeroDivisionError):
                pass

    # Build requested format for dive_information
    info_parts = []
    if final_sac:
        info_parts.append(f"SAC: {final_sac} l/min")
    if otu:
        info_parts.append(f"OTU: {int(otu)}")
    if max_cns is not None:
        info_parts.append(f"CNS: {int(max_cns * 100)}%")
    
    info_parts.append(f"Max Depth: {round(max_depth, 2)} m")
    info_parts.append(f"Avg Depth: {avg_depth} m")
    
    if min_temp:
        info_parts.append(f"Water Temp: {min_temp} C")
    
    # Deco Model with parameters
    deco_label = f"Deco Model: {algorithm}"
    conservatism = diving.get("Conservatism")
    if conservatism is not None:
        # Suunto uses P0, P1, P2 for conservatism
        deco_label += f" (P{conservatism})"
    
    deep_stop = diving.get("DeepStopEnabled")
    if deep_stop is not None:
        deco_label += f" [DeepStop: {'On' if deep_stop else 'Off'}]"
    
    info_parts.append(deco_label)
    info_parts.append(f"Device: {model}")

    # Weight systems (Format A)
    weights = diving.get("WeightSystems", [])
    if weights:
        weight_info = []
        for w in weights:
            weight_val = w.get("Weight")
            if weight_val:
                weight_info.append(f"{weight_val}kg")
        if weight_info:
            info_parts.append(f"Weights: {', '.join(weight_info)}")

    gas_bottles_used = create_structured_gas_data(cylinders, events=events)

    return {
        "dive_date": dive_date,
        "dive_time": dive_time,
        "duration": duration_min,
        "model": model,
        "algorithm": algorithm,
        "o2_percent": o2_percent,
        "he_percent": he_percent,
        "max_depth": round(max_depth, 2),
        "average_depth": avg_depth,
        "latitude": latitude,
        "longitude": longitude,
        "cylinders": cylinders,
        "gas_bottles_used": gas_bottles_used,
        "dive_information": "\n".join(info_parts),
        "profile_data": {
            "samples": samples,
            "events": events,
            "cylinders": cylinders,
            "calculated_max_depth": round(max_depth, 2),
            "calculated_avg_depth": avg_depth,
            "calculated_duration_minutes": duration_min,
            "sample_count": len(samples),
            "temperature_range": {"min": min_temp, "max": max_temp},
            "avg_sac": avg_sac
        }
    }
