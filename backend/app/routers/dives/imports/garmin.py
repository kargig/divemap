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
        start_time = session_frame.get_value('start_time')
        if not start_time:
            continue
            
        duration_secs = session_frame.get_value('total_elapsed_time') or 0
        end_time = start_time + timedelta(seconds=duration_secs)
        
        # Categorize records, summaries and settings for this specific session
        session_records = [r for r in messages['record'] if r.get_value('timestamp') and start_time <= r.get_value('timestamp') <= end_time]
        session_summaries = [s for s in messages['dive_summary'] if s.get_value('timestamp') and start_time <= s.get_value('timestamp') <= end_time]
        session_settings = messages['dive_settings'][0] if messages['dive_settings'] else None
        # dive_gas messages usually aren't timestamped per session in the same way, but often there's only one set
        session_gases = messages['dive_gas']

        # 1. Depth Metrics - Priority: dive_summary > session > calculated
        max_d, avg_d = None, None
        
        if session_summaries:
            s = session_summaries[0]
            try:
                max_d = s.get_value('max_depth')
                avg_d = s.get_value('avg_depth')
            except Exception: pass

        if max_d is None:
            try:
                max_d = session_frame.get_value('max_depth')
                avg_d = session_frame.get_value('avg_depth')
            except Exception: pass
        
        if max_d is None and session_records:
            depths = [r.get_value('depth') for r in session_records if r.get_value('depth') is not None]
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
                key=lambda g: 0 if g.get_value('mode') == 'closed_circuit_diluent' else 1
            )
            
            seen_mixes = set()
            for g in sorted_gases:
                if g.get_value('status') != 'enabled':
                    continue
                    
                o2 = g.get_value('oxygen_content') or 21
                he = g.get_value('helium_content') or 0
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
                session_events = [e for e in messages['event'] if e.get_value('timestamp') and start_time <= e.get_value('timestamp') <= end_time]
                
                for e in session_events:
                    ts = e.get_value('timestamp')
                    time_mins = (ts - start_time).total_seconds() / 60.0
                    
                    event_type = None
                    try:
                        event_type = e.get_value('event')
                    except Exception:
                        pass
                        
                    dive_alert = None
                    try:
                        dive_alert = e.get_value('dive_alert')
                    except Exception:
                        pass
                    
                    if event_type == 'dive_gas_switched':
                        events.append({
                            "type": "gaschange",
                            "name": "gaschange",
                            "time_minutes": time_mins,
                            "cylinder": str(e.get_value('data') if e.has_field('data') else "0")
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
            lat = semicircles_to_degrees(session_frame.get_value('start_position_lat'))
            lng = semicircles_to_degrees(session_frame.get_value('start_position_long'))
        except Exception: pass
        
        if lat is None or lng is None:
            for r in session_records:
                try:
                    r_lat = semicircles_to_degrees(r.get_value('position_lat'))
                    r_lng = semicircles_to_degrees(r.get_value('position_long'))
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
            product = d_info.get_value('garmin_product') or d_info.get_value('product')
            if product: info.append(f"Device: Garmin {product}")

        if session_settings:
            model = session_settings.get_value('model')
            gf_low = session_settings.get_value('gf_low')
            gf_high = session_settings.get_value('gf_high')
            if model: info.append(f"Deco Model: {model} (GF {gf_low}/{gf_high})")
            
            water = session_settings.get_value('water_type')
            if water: info.append(f"Water: {water}")

        if session_summaries:
            s = session_summaries[0]
            cns_start = s.get_value('start_cns')
            if cns_start is not None: info.append(f"Start CNS: {cns_start}%")
            cns_end = s.get_value('end_cns')
            if cns_end is not None: info.append(f"End CNS: {cns_end}%")
            n2_start = s.get_value('start_n2')
            if n2_start is not None: info.append(f"Start N2: {n2_start}%")
            n2_end = s.get_value('end_n2')
            if n2_end is not None: info.append(f"End N2: {n2_end}%")
            o2_tox = s.get_value('o2_toxicity')
            if o2_tox is not None: info.append(f"O2 Toxicity: {o2_tox} OTU")
            surface_int = s.get_value('surface_interval')
            if surface_int is not None: 
                hrs = surface_int // 3600
                mins = (surface_int % 3600) // 60
                info.append(f"Surface Interval: {hrs}h {mins}m")
            
        try:
            avg_temp = session_frame.get_value('avg_temperature')
            if avg_temp is not None: info.append(f"Avg Water Temp: {avg_temp}°C")
            
            avg_hr = session_frame.get_value('avg_heart_rate')
            if avg_hr is not None: info.append(f"Avg HR: {avg_hr} bpm")
        except Exception: pass
            
        dive_data["dive_information"] = "\n".join(info) if info else None
        
        # 4. Profile samples
        for r in session_records:
            r_depth = r.get_value('depth')
            r_ts = r.get_value('timestamp')
            if r_depth is not None and r_ts:
                time_offset = (r_ts - start_time).total_seconds()
                temp = None
                try: temp = r.get_value('temperature')
                except Exception: pass
                sample = {
                    "time_minutes": round(time_offset / 60.0, 2),
                    "depth": round(r_depth, 2),
                    "temperature": temp
                }
                
                try:
                    cns = r.get_value('cns_load')
                    if cns is not None: sample['cns_percent'] = cns
                    
                    n2 = r.get_value('n2_load')
                    if n2 is not None: sample['n2_percent'] = n2
                    
                    ndl = r.get_value('ndl_time')
                    if ndl is not None:
                        sample['ndl_minutes'] = round(ndl / 60.0, 2)
                    
                    stop_depth = r.get_value('next_stop_depth')
                    if stop_depth is not None:
                        sample['stopdepth'] = round(stop_depth, 2)
                        sample['in_deco'] = stop_depth > 0
                    
                    stop_time = r.get_value('next_stop_time')
                    if stop_time is not None:
                        sample['stoptime_minutes'] = round(stop_time / 60.0, 2)
                        
                except Exception: pass
                
                dive_data["profile_data"]["samples"].append(sample)
        
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

    try:
        content = await file.read()
        
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
