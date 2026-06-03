from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import fitdecode
import io

from ..dives_shared import router, get_db, get_current_user, User, Dive
from app.schemas import GarminFITResponse
from app.models import DiveSite, DivingCenter
from .common import (
    find_existing_dive, 
    find_sites_by_coords, 
    semicircles_to_degrees
)
from .gas_utils import create_structured_gas_data


def get_fit_value(frame, field_name, default=None):
    """
    Safely get a value from a FIT frame. Returns default if field is missing.
    """
    try:
        if frame.has_field(field_name):
            return frame.get_value(field_name)
    except Exception:
        pass
    return default

# Maximum file size for FIT file uploads (15MB)
MAX_FIT_FILE_SIZE = 15 * 1024 * 1024
from app.services.deco_service import calculate_deco_ceiling


def parse_garmin_fit_file(content: bytes, db: Session, current_user_id: int, user_dives=None, all_sites=None):
    """
    Parse a Garmin FIT activity file and extract dive sessions and samples.
    """
    parsed_dives = []
    
    # Pre-parse all messages to categorize them
    messages = defaultdict(list)
    
    with fitdecode.FitReader(io.BytesIO(content)) as fit:
        for frame in fit:
            if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                messages[frame.name].append(frame)

    for session_frame in messages['session']:
        start_time = get_fit_value(session_frame, 'start_time')
        if not start_time:
            continue
            
        duration_secs = get_fit_value(session_frame, 'total_elapsed_time') or 0
        end_time = start_time + timedelta(seconds=duration_secs)
        
        # Categorize records, summaries and settings for this specific session
        session_records = [r for r in messages['record'] if get_fit_value(r, 'timestamp') and start_time <= get_fit_value(r, 'timestamp') <= end_time]
        session_summaries = [s for s in messages['dive_summary'] if get_fit_value(s, 'timestamp') and start_time <= get_fit_value(s, 'timestamp') <= end_time]
        session_settings = messages['dive_settings'][0] if messages['dive_settings'] else None
        # dive_gas messages usually aren't timestamped per session in the same way, but often there's only one set
        session_gases = messages['dive_gas']

        # 1. Depth Metrics - Priority: dive_summary > session > calculated
        max_d, avg_d = None, None
        
        if session_summaries:
            s = session_summaries[0]
            try:
                max_d = get_fit_value(s, 'max_depth')
                avg_d = get_fit_value(s, 'avg_depth')
            except Exception: pass

        if max_d is None:
            try:
                max_d = get_fit_value(session_frame, 'max_depth')
                avg_d = get_fit_value(session_frame, 'avg_depth')
            except Exception: pass
        
        if max_d is None and session_records:
            depths = [get_fit_value(r, 'depth') for r in session_records if get_fit_value(r, 'depth') is not None]
            if depths:
                max_d = max(depths)
                avg_d = sum(depths) / len(depths)
        
        dive_data = {
            "max_depth": round(max_d, 2) if max_d is not None else 0.0,
            "average_depth": round(avg_d, 2) if avg_d is not None else 0.0,
            "duration": int(duration_secs / 60) if duration_secs else 0,
            "dive_date": start_time.date().isoformat(),
            "dive_time": start_time.time().isoformat(),
            "is_private": False,
            "tags": [],
            "_raw_start_time": start_time.isoformat(),
            "profile_data": {"samples": []}
        }

        # 1.1 Parse Gas Data (Garmin specific)
        if session_gases:
            cylinders = []
            
            # Sort to put CCR diluents first (index 0)
            sorted_gases = sorted(
                session_gases, 
                key=lambda g: 0 if get_fit_value(g, 'mode') == 'closed_circuit_diluent' else 1
            )
            
            seen_mixes = set()
            for g in sorted_gases:
                if get_fit_value(g, 'status') != 'enabled':
                    continue
                    
                o2 = get_fit_value(g, 'oxygen_content') or 21
                he = get_fit_value(g, 'helium_content') or 0
                mix = (o2, he)
                
                if mix not in seen_mixes:
                    seen_mixes.add(mix)
                    cylinders.append({
                        "size": "12 l", # Assumption
                        "o2": f"{o2}%",
                        "he": f"{he}%",
                        "start": "200 bar",
                        "end": "50 bar"
                    })
            
            if cylinders:
                events = []
                # Filter events for this session
                session_events = [e for e in messages['event'] if get_fit_value(e, 'timestamp') and start_time <= get_fit_value(e, 'timestamp') <= end_time]
                
                for e in session_events:
                    ts = get_fit_value(e, 'timestamp')
                    time_mins = (ts - start_time).total_seconds() / 60.0
                    
                    event_type = None
                    try:
                        event_type = get_fit_value(e, 'event')
                    except Exception:
                        pass
                        
                    dive_alert = None
                    try:
                        dive_alert = get_fit_value(e, 'dive_alert')
                    except Exception:
                        pass
                    
                    if event_type == 'dive_gas_switched':
                        events.append({
                            "type": "gaschange",
                            "name": "gaschange",
                            "time_minutes": time_mins,
                            "cylinder": str(get_fit_value(e, 'data') if e.has_field('data') else "0")
                        })
                    elif dive_alert in ['ndl_reached', 'approaching_first_deco_stop', 'deco_ceiling_broken']:
                        events.append({
                            "type": "alert",
                            "name": dive_alert.replace('_', ' '),
                            "time_minutes": time_mins
                        })
                    elif dive_alert in ['setpoint_switch_auto_high', 'setpoint_switch_auto_low']:
                        events.append({
                            "type": "info",
                            "name": dive_alert.replace('_', ' '),
                            "time_minutes": time_mins
                        })

                dive_data["gas_bottles_used"] = create_structured_gas_data(cylinders, events=events)
                dive_data["profile_data"]["events"] = events
                dive_data["profile_data"]["cylinders"] = cylinders
        
        # 2. GPS Coordinates
        lat, lng = None, None
        try:
            lat = semicircles_to_degrees(get_fit_value(session_frame, 'start_position_lat'))
            lng = semicircles_to_degrees(get_fit_value(session_frame, 'start_position_long'))
        except Exception: pass
        
        if lat is None or lng is None:
            for r in session_records:
                try:
                    r_lat = semicircles_to_degrees(get_fit_value(r, 'position_lat'))
                    r_lng = semicircles_to_degrees(get_fit_value(r, 'position_long'))
                    if r_lat and r_lng:
                        lat, lng = r_lat, r_lng
                        break
                except Exception: continue

        if lat is not None and lng is not None:
            dive_data["latitude"] = lat
            dive_data["longitude"] = lng
            
            sites = find_sites_by_coords(db, lat, lng)
            if sites:
                best_match = sites[0]
                dive_data["dive_site_id"] = best_match.id
                if best_match.distance > 10:
                    dive_data["proposed_sites"] = [{"id": s.id, "name": s.name, "distance": s.distance} for s in sites]
            else:
                dive_data["unmatched_dive_site"] = {"name": "Unknown Site (Garmin GPS)", "latitude": lat, "longitude": lng}
        
        # 3. Enhanced Metadata
        info = []
        if messages['device_info']:
            d_info = messages['device_info'][0]
            manufacturer = get_fit_value(d_info, 'manufacturer')
            product = get_fit_value(d_info, 'garmin_product') or get_fit_value(d_info, 'product')
            product_name = get_fit_value(d_info, 'product_name')
            
            display_name = product_name or product
            if display_name:
                brand = str(manufacturer).capitalize() if manufacturer else "Device"
                info.append(f"Device: {brand} {display_name}")

        if session_settings:
            model = get_fit_value(session_settings, 'model')
            gf_low = get_fit_value(session_settings, 'gf_low')
            gf_high = get_fit_value(session_settings, 'gf_high')
            
            if model or (gf_low is not None and gf_high is not None):
                model_str = f"{model}" if model else "Bühlmann ZH-L16"
                gf_str = f" (GF {gf_low}/{gf_high})" if gf_low is not None and gf_high is not None else ""
                info.append(f"Deco Model: {model_str}{gf_str}")
            
            water = get_fit_value(session_settings, 'water_type')
            if water: info.append(f"Water: {water}")

        if session_summaries:
            s = session_summaries[0]
            cns_start = get_fit_value(s, 'start_cns')
            if cns_start is not None: info.append(f"Start CNS: {cns_start}%")
            cns_end = get_fit_value(s, 'end_cns')
            if cns_end is not None: info.append(f"End CNS: {cns_end}%")
            n2_start = get_fit_value(s, 'start_n2')
            if n2_start is not None: info.append(f"Start N2: {n2_start}%")
            n2_end = get_fit_value(s, 'end_n2')
            if n2_end is not None: info.append(f"End N2: {n2_end}%")
            o2_tox = get_fit_value(s, 'o2_toxicity')
            if o2_tox is not None: info.append(f"O2 Toxicity: {o2_tox} OTU")
            surface_int = get_fit_value(s, 'surface_interval')
            if surface_int is not None: 
                hrs = surface_int // 3600
                mins = (surface_int % 3600) // 60
                info.append(f"Surface Interval: {hrs}h {mins}m")
            
        try:
            avg_temp = get_fit_value(session_frame, 'avg_temperature')
            if avg_temp is not None: info.append(f"Avg Water Temp: {avg_temp}°C")
            
            avg_hr = get_fit_value(session_frame, 'avg_heart_rate')
            if avg_hr is not None: info.append(f"Avg HR: {avg_hr} bpm")
        except Exception: pass
            
        dive_data["dive_information"] = "\n".join(info) if info else None
        
        # 4. Profile samples
        for r in session_records:
            r_depth = get_fit_value(r, 'depth')
            r_ts = get_fit_value(r, 'timestamp')
            if r_depth is not None and r_ts:
                time_offset = (r_ts - start_time).total_seconds()
                temp = None
                try: temp = get_fit_value(r, 'temperature')
                except Exception: pass
                sample = {
                    "time_minutes": round(time_offset / 60.0, 2),
                    "depth": round(r_depth, 2),
                    "temperature": temp
                }
                
                try:
                    cns = get_fit_value(r, 'cns_load')
                    if cns is not None: sample['cns_percent'] = cns
                    
                    n2 = get_fit_value(r, 'n2_load')
                    if n2 is not None: sample['n2_percent'] = n2
                    
                    ndl = get_fit_value(r, 'ndl_time')
                    if ndl is not None:
                        sample['ndl_minutes'] = round(ndl / 60.0, 2)
                    
                    stop_depth = get_fit_value(r, 'next_stop_depth')
                    if stop_depth is not None:
                        sample['stopdepth'] = round(stop_depth, 2)
                        sample['in_deco'] = stop_depth > 0
                    
                    stop_time = get_fit_value(r, 'next_stop_time')
                    if stop_time is not None:
                        sample['stoptime_minutes'] = round(stop_time / 60.0, 2)
                        
                except Exception: pass
                
                dive_data["profile_data"]["samples"].append(sample)
        
        # 4.1 Calculate Missing Ceiling (Bühlmann ZH-L16)
        # If the file lacks deco data (e.g. Suunto), calculate it internally
        has_deco_in_profile = any(s.get('stopdepth') is not None for s in dive_data["profile_data"]["samples"])
        if not has_deco_in_profile and dive_data["profile_data"]["samples"]:
            try:
                gfl = get_fit_value(session_settings, 'gf_low') if session_settings else 30
                if gfl is None: gfl = 30
                gfh = get_fit_value(session_settings, 'gf_high') if session_settings else 70
                if gfh is None: gfh = 70
                
                calculated_ceilings, final_saturation, heatmap_data = calculate_deco_ceiling(
                    dive_data["profile_data"]["samples"], 
                    gf_low=gfl, 
                    gf_high=gfh
                )
                
                # Apply calculated ceilings to samples
                for i, sample in enumerate(dive_data["profile_data"]["samples"]):
                    if i < len(calculated_ceilings):
                        sample['stopdepth'] = calculated_ceilings[i]
                        sample['in_deco'] = calculated_ceilings[i] > 0
                        # Label as calculated for frontend awareness if needed
                        sample['calculated_deco'] = True
                
                # Store tissue loading metadata
                if final_saturation:
                    dive_data["profile_data"]["tissue_saturation"] = final_saturation
                if heatmap_data:
                    dive_data["profile_data"]["tissue_heatmap"] = heatmap_data
            except Exception as e:
                import logging
                logging.warning(f"Failed to calculate internal deco ceiling: {e}")

        # Duplicate detection
        existing = find_existing_dive(
            db, current_user_id, 
            dive_data["dive_date"], 
            dive_data["dive_time"], 
            dive_data["duration"], 
            dive_data["max_depth"],
            user_dives=user_dives
        )
        if existing:
            dive_data["existing_dive_id"] = existing.id
            dive_data["skip"] = True
            
        parsed_dives.append(dive_data)
                        
    return parsed_dives

@router.post("/import/garmin-fit", response_model=GarminFITResponse)
async def import_garmin_fit(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from Garmin FIT file.
    Automatically splits multi-session files and matches sites by GPS.
    """
    if not file.filename.lower().endswith('.fit'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .fit file"
        )

    # Check file size before reading
    if file.size and file.size > MAX_FIT_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size allowed is {MAX_FIT_FILE_SIZE // (1024 * 1024)}MB"
        )

    try:
        content = await file.read()
        
        # Double check content size if file.size was not available
        if len(content) > MAX_FIT_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content too large. Maximum size allowed is {MAX_FIT_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        all_centers = db.query(DivingCenter).all()
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()
        
        parsed_dives = parse_garmin_fit_file(content, db, current_user.id, user_dives=user_dives, all_sites=all_sites)

        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No dive sessions found in FIT file"
            )

        dive_sites_for_selection = [
            {"id": site.id, "name": site.name, "country": site.country, "region": site.region}
            for site in all_sites
        ]

        diving_centers_for_selection = [
            {"id": dc.id, "name": dc.name, "country": dc.country}
            for dc in all_centers
        ]

        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives from FIT file",
            "dives": parsed_dives,
            "available_dive_sites": dive_sites_for_selection,
            "available_diving_centers": diving_centers_for_selection
        }

    except Exception:
        import logging
        logging.exception("Error processing Garmin FIT file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing Garmin FIT file"
        )
