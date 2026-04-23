"""
Import operations for dives.

This module contains functionality for importing dive data:
- import_subsurface_xml: Import dives from Subsurface XML format
- confirm_import: Confirm and finalize imported dives
- parse_dive_profile_samples: Parse dive profile data from XML
- convert_to_divemap_format: Convert Subsurface data to Divemap format

The import functionality includes:
- XML parsing and validation
- Dive profile data extraction
- Data format conversion
- Dive site matching and creation
- Comprehensive error handling
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from collections import defaultdict
from datetime import date, time, datetime, timedelta
import orjson
import os
import re
import tempfile
import uuid
import xml.etree.ElementTree as ET
import nh3
import fitdecode

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse, CSVHeaderResponse, GarminFITResponse
from app.models import DiveSite, DiveSiteAlias, DivingCenter
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error
from .dives_utils import (
    has_deco_profile,
    generate_dive_name,
    get_or_create_deco_tag,
    find_dive_site_by_import_id,
    find_potential_matches
)
from app.physics import GasMix, calculate_real_volume


# Helper function to convert old difficulty labels to new codes
def convert_difficulty_to_code(difficulty_input):
    """
    Convert old difficulty format (integer or string label) to new difficulty_code.
    
    Args:
        difficulty_input: Can be:
            - New format: difficulty_code string (e.g., 'OPEN_WATER')
            - Old format: integer (1-4) or string label ('beginner', 'intermediate', etc.)
    
    Returns:
        difficulty_code string or None
    """
    if difficulty_input is None:
        return None
    
    # If already a valid code, return as-is
    valid_codes = ['OPEN_WATER', 'ADVANCED_OPEN_WATER', 'DEEP_NITROX', 'TECHNICAL_DIVING']
    if isinstance(difficulty_input, str) and difficulty_input.upper() in valid_codes:
        return difficulty_input.upper()
    
    # Map old integer values to new codes
    if isinstance(difficulty_input, int):
        mapping = {
            1: 'OPEN_WATER',
            2: 'ADVANCED_OPEN_WATER',
            3: 'DEEP_NITROX',
            4: 'TECHNICAL_DIVING'
        }
        return mapping.get(difficulty_input)
    
    # Map old string labels to new codes
    if isinstance(difficulty_input, str):
        label_mapping = {
            'beginner': 'OPEN_WATER',
            'intermediate': 'ADVANCED_OPEN_WATER',
            'advanced': 'DEEP_NITROX',
            'expert': 'TECHNICAL_DIVING'
        }
        return label_mapping.get(difficulty_input.lower())
    
    # Default to intermediate (ADVANCED_OPEN_WATER) if unknown

def semicircles_to_degrees(semicircles: Optional[int]) -> Optional[float]:
    """
    Convert Garmin semicircles to decimal degrees.
    Formula: degrees = semicircles * (180 / 2^31)
    """
    if semicircles is None:
        return None
    return float(semicircles) * (180.0 / 2**31)

def parse_garmin_fit_file(content: bytes, db: Session, current_user_id: int, user_dives=None, all_sites=None):
    """
    Parse a Garmin FIT activity file and extract dive sessions and samples.
    """
    import io
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
            # Garmin provides multiple dive_gas messages (diluents, bailouts, etc.)
            # We filter for 'enabled' gases and unique mixes to avoid duplicates.
            # We prioritize 'closed_circuit_diluent' as the back gas if multiple exist.
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
                # Try to extract events for better gas identification (back gas vs stages)
                # And also for profile display (gas switches, deco alerts)
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
                dive_data["profile_data"]["events"] = events # Store for profile chart
        
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
            
            # Match coordinates
            # Note: find_sites_by_coords currently uses a targeted SQL query.
            # This is efficient (hits a spatial index) so we keep it as-is for accuracy.
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
        # Device Info
        if messages['device_info']:
            d_info = messages['device_info'][0]
            product = d_info.get_value('garmin_product') or d_info.get_value('product')
            if product: info.append(f"Device: Garmin {product}")

        # Dive Settings
        if session_settings:
            model = session_settings.get_value('model')
            gf_low = session_settings.get_value('gf_low')
            gf_high = session_settings.get_value('gf_high')
            if model: info.append(f"Deco Model: {model} (GF {gf_low}/{gf_high})")
            
            water = session_settings.get_value('water_type')
            if water: info.append(f"Water: {water}")

        # Dive Summary Metrics
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
            
        # Session Metrics
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
                # Extract additional profile samples
                sample = {
                    "time_minutes": round(time_offset / 60.0, 2),
                    "depth": round(r_depth, 2),
                    "temperature": temp
                }
                
                try:
                    # CNS and N2
                    cns = r.get_value('cns_load')
                    if cns is not None: sample['cns_percent'] = cns # UI expects cns_percent
                    
                    n2 = r.get_value('n2_load')
                    if n2 is not None: sample['n2_percent'] = n2
                    
                    # NDL
                    ndl = r.get_value('ndl_time')
                    if ndl is not None:
                        sample['ndl_minutes'] = round(ndl / 60.0, 2)
                    
                    # Deco Stop Information
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
    return 'ADVANCED_OPEN_WATER'

def protect_csv_formula(value: str) -> Optional[str]:
    """
    Prevents CSV injection by escaping leading formula characters.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    if value.startswith(('=', '+', '-', '@')):
        return f"'{value}"
    return value

def sanitize_csv_cell(value: str) -> Optional[str]:
    """
    Strips HTML and protects against CSV formula injection.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    
    # Strip HTML tags
    clean_val = nh3.clean(value, tags=set())
    
    # Protect against formula injection
    return protect_csv_formula(clean_val)

def parse_csv_depth(value: str) -> Optional[float]:
    """
    Intelligently parse depth from CSV, handling units (m, ft).
    Always returns meters.
    """
    if not value:
        return None
    
    try:
        # Normalize: lower case, replace comma with dot
        val_clean = value.lower().replace(',', '.')
        
        # Extract numeric part
        numeric_match = re.search(r'(\d+\.?\d*)', val_clean)
        if not numeric_match:
            return None
            
        num = float(numeric_match.group(1))
        
        # Detect units
        # If 'ft' exists and is not after 'm' (to avoid "25.5 m (84 ft)" confusion)
        if 'ft' in val_clean and 'm' not in val_clean.split('ft')[0]:
            return round(num * 0.3048, 2)
        
        return num
    except (ValueError, TypeError):
        return None

def parse_csv_date_time(value: str) -> tuple[Optional[date], Optional[time]]:
    """
    Intelligently parse date and time from various CSV formats.
    """
    if not value:
        return None, None
        
    from dateutil import parser
    try:
        # dateutil.parser is very robust. dayfirst=True is safer for international formats.
        dt = parser.parse(value, dayfirst=True)
        return (dt.date(), dt.time())
    except (ValueError, TypeError, OverflowError):
        return (None, None)

def resolve_entity(db: Session, value: str, centers=None, users=None) -> tuple[Optional[int], Optional[str]]:
    """
    Intelligently resolve a string to either a Diving Center or a User (Buddy).
    Returns (id, type) where type is 'center', 'buddy', or None.
    """
    if not value:
        return None, None
        
    from app.models import DivingCenter, User
    
    # Clean value
    search_val = value.strip()
    if not search_val:
        return None, None

    # 1. Try Diving Center Exact match (case-insensitive)
    if centers is not None:
        # Search in pre-fetched list
        for c in centers:
            if c.name.lower() == search_val.lower():
                return c.id, "center"
    else:
        try:
            center = db.query(DivingCenter).filter(DivingCenter.name.ilike(search_val)).first()
            if center:
                return center.id, "center"
        except Exception:
            pass
        
    # 2. Try User (Buddy) match by username
    if users is not None:
        # Search in pre-fetched list
        for u in users:
            if u.username.lower() == search_val.lower():
                return u.id, "buddy"
    else:
        try:
            user = db.query(User).filter(User.username.ilike(search_val)).first()
            if user:
                return user.id, "buddy"
        except Exception:
            pass
    
    # 3. Try Diving Center Fuzzy match
    try:
        if centers is None:
            centers = db.query(DivingCenter).all()
        matches = find_potential_matches(search_val, centers, threshold=0.6)
        if matches:
            return matches[0]['id'], "center"
    except Exception:
        pass

    # 4. Try User Fuzzy match (only if no center matches)
    try:
        if users is None:
            users = db.query(User).all()
        from .dives_utils import calculate_similarity
        for u in users:
            similarity = calculate_similarity(search_val, u.username)
            if similarity >= 0.8: # Higher threshold for users to avoid false buddies
                return u.id, "buddy"
    except Exception:
        pass
        
    return None, None

def find_existing_dive(db: Session, user_id: int, dive_date: str, dive_time: Optional[str] = None, duration: Optional[int] = None, max_depth: Optional[float] = None, user_dives=None) -> Optional[Dive]:
    """
    Attempts to find an existing dive for a user to prevent duplicates.
    Matches by date + time (+/- 0.5m depth), or date + duration + depth if time is missing.
    """
    from datetime import datetime, date, time
    
    # Normalize inputs for comparison
    target_date = dive_date
    if isinstance(target_date, str):
        try: target_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except Exception: pass
        
    target_time_str = str(dive_time) if dive_time else None

    if user_dives is not None:
        # Search in pre-fetched list
        for d in user_dives:
            # Check date (mandatory)
            d_date = d.dive_date
            if isinstance(d_date, str):
                try: d_date = datetime.strptime(d_date, "%Y-%m-%d").date()
                except Exception: continue
            
            if d_date != target_date:
                continue
                
            # Date matched, now check specificity
            if target_time_str:
                d_time = d.dive_time
                if hasattr(d_time, 'strftime'): d_time = d_time.strftime("%H:%M:%S")
                if str(d_time) == target_time_str:
                    # Optional: check depth if provided for higher confidence
                    if max_depth is not None and d.max_depth:
                        if (max_depth - 0.5 <= float(d.max_depth) <= max_depth + 0.5):
                            return d
                    else:
                        return d
            
            # Fallback to duration/depth if time is missing or didn't match
            if duration is not None and max_depth is not None:
                if d.duration == duration and d.max_depth and (max_depth - 0.5 <= float(d.max_depth) <= max_depth + 0.5):
                    return d
        return None

    # Fallback to single query (kept for compatibility)
    query = db.query(Dive).filter(Dive.user_id == user_id, Dive.dive_date == dive_date)
    
    if dive_time:
        existing = query.filter(Dive.dive_time == dive_time).first()
        if existing: return existing
            
    if duration is not None and max_depth is not None:
        existing = query.filter(
            Dive.duration == duration,
            Dive.max_depth >= max_depth - 0.5,
            Dive.max_depth <= max_depth + 0.5
        ).first()
        if existing: return existing
            
    return None

def find_sites_by_coords(db: Session, lat: float, lng: float, radius_m: int = 500):
    """
    Find dive sites within a given radius using MySQL spatial functions.
    Returns sites sorted by distance.
    """
    from sqlalchemy import text
    from app.models import DiveSite
    
    # Check if we are on SQLite (tests) or MySQL (prod)
    # The existing project standards suggest ST_Distance_Sphere is for MySQL
    sql = text("""
        SELECT id, name, country, 
               ST_Distance_Sphere(location, ST_SRID(POINT(:lng, :lat), 4326)) as distance
        FROM dive_sites
        WHERE ST_Distance_Sphere(location, ST_SRID(POINT(:lng, :lat), 4326)) <= :radius
        ORDER BY distance ASC
        LIMIT 3
    """)
    
    try:
        result = db.execute(sql, {"lat": lat, "lng": lng, "radius": radius_m}).fetchall()
        return result
    except Exception as e:
        # Fallback for SQLite or errors
        print(f"Spatial query failed: {e}")
        return []
    return None


def parse_dive_information_text(dive_information):
    """Parse dive information text to extract individual fields like buddy, sac, otu, etc."""
    if not dive_information:
        return {}
    
    parsed_fields = {}
    
    # Parse buddy - handle multiline text
    buddy_match = re.search(r'Buddy:\s*([^\n]+?)(?=\nSAC:|$)', dive_information, re.MULTILINE)
    if buddy_match:
        parsed_fields['buddy'] = buddy_match.group(1).strip()
    
    # Parse SAC
    sac_match = re.search(r'SAC:\s*([^\n]+)', dive_information, re.MULTILINE)
    if sac_match:
        parsed_fields['sac'] = sac_match.group(1).strip()
    
    # Parse OTU
    otu_match = re.search(r'OTU:\s*([^\n]+)', dive_information, re.MULTILINE)
    if otu_match:
        parsed_fields['otu'] = otu_match.group(1).strip()
    
    # Parse CNS
    cns_match = re.search(r'CNS:\s*([^\n]+)', dive_information, re.MULTILINE)
    if cns_match:
        parsed_fields['cns'] = cns_match.group(1).strip()
    
    # Parse Water Temp
    water_temp_match = re.search(r'Water Temp:\s*([^\n]+)', dive_information, re.MULTILINE)
    if water_temp_match:
        parsed_fields['water_temperature'] = water_temp_match.group(1).strip()
    
    # Parse Deco Model
    deco_model_match = re.search(r'Deco Model:\s*([^\n]+?)(?=\nWeights:|$)', dive_information, re.MULTILINE)
    if deco_model_match:
        parsed_fields['deco_model'] = deco_model_match.group(1).strip()
    
    # Parse Weights
    weights_match = re.search(r'Weights:\s*([^\n]+)', dive_information, re.MULTILINE)
    if weights_match:
        weights_value = weights_match.group(1).strip()
        # Clean up weights value - remove extra "weight" text if present
        if weights_value.endswith(' weight'):
            weights_value = weights_value[:-7]  # Remove " weight" (7 characters)
        parsed_fields['weights'] = weights_value
    
    return parsed_fields

def parse_dive_profile_samples(computer_elem):
    import xml.etree.ElementTree as ET
    
    # Handle both XML element and XML string
    if isinstance(computer_elem, str):
        try:
            computer_elem = ET.fromstring(computer_elem)
        except ET.ParseError:
            return None
    """Parse dive profile samples and events from dive computer element"""
    samples = []
    events = []
    
    # Find all sample elements
    sample_elements = computer_elem.findall('sample')
    for sample in sample_elements:
        sample_data = {}
        
        # Parse time (convert to minutes)
        time_str = sample.get('time')
        if time_str:
            sample_data['time'] = time_str
            sample_data['time_minutes'] = parse_time_to_minutes(time_str)
        
        # Parse depth
        depth = sample.get('depth')
        if depth:
            sample_data['depth'] = parse_depth_value(depth)
        
        # Parse temperature
        temp = sample.get('temp')
        if temp:
            sample_data['temperature'] = parse_temperature_value(temp)
        
        # Parse NDL (No Decompression Limit)
        ndl = sample.get('ndl')
        if ndl:
            sample_data['ndl_minutes'] = parse_time_to_minutes(ndl)
        
        # Parse in_deco status
        in_deco = sample.get('in_deco')
        if in_deco is not None:
            sample_data['in_deco'] = in_deco == '1'
        
        # Parse CNS
        cns = sample.get('cns')
        if cns:
            sample_data['cns_percent'] = parse_cns_value(cns)
        
        # Parse decompression stop time
        stoptime = sample.get('stoptime')
        if stoptime:
            sample_data['stoptime_minutes'] = parse_time_to_minutes(stoptime)
        
        # Parse stop depth
        stopdepth = sample.get('stopdepth')
        if stopdepth:
            sample_data['stopdepth'] = parse_depth_value(stopdepth)
        
        # Only add sample if it has essential data
        if 'time_minutes' in sample_data and 'depth' in sample_data:
            samples.append(sample_data)
    
    # Parse events
    event_elements = computer_elem.findall('event')
    for event in event_elements:
        event_data = {
            'time': event.get('time'),
            'time_minutes': parse_time_to_minutes(event.get('time', '0:00 min')),
            'type': event.get('type'),
            'flags': event.get('flags'),
            'name': event.get('name'),
            'cylinder': event.get('cylinder'),
            'o2': event.get('o2')
        }
        events.append(event_data)
    
    if not samples:
        return None
    
    # Calculate derived metrics
    depths = [s['depth'] for s in samples if 'depth' in s]
    temperatures = [s['temperature'] for s in samples if 'temperature' in s]
    
    profile_data = {
        'samples': samples,
        'events': events,
        'sample_count': len(samples),
        'calculated_max_depth': max(depths) if depths else 0,
        'calculated_avg_depth': sum(depths) / len(depths) if depths else 0,
        'calculated_duration_minutes': samples[-1].get('time_minutes', 0) if samples else 0,
        'temperature_range': {
            'min': min(temperatures) if temperatures else None,
            'max': max(temperatures) if temperatures else None
        }
    }
    
    return profile_data

def parse_time_to_minutes(time_str):
    """Parse time string to minutes (float)"""
    if not time_str:
        return 0.0
    
    try:
        # Handle formats like "1:30 min", "30:00 min", "0:10 min", "54:30 min"
        time_str = time_str.replace('min', '').strip()
        
        if ':' in time_str:
            parts = time_str.split(':')
            if len(parts) == 2:
                # Format: MM:SS
                minutes = int(parts[0]) if parts[0] else 0
                seconds = int(parts[1]) if parts[1] else 0
                return minutes + (seconds / 60.0)
            elif len(parts) == 3:
                # Format: HH:MM:SS
                hours = int(parts[0]) if parts[0] else 0
                minutes = int(parts[1]) if parts[1] else 0
                seconds = int(parts[2]) if parts[2] else 0
                return hours * 60 + minutes + (seconds / 60.0)
        else:
            # If no colon, assume it's already in minutes
            return float(time_str)
    except (ValueError, AttributeError):
        return 0.0

def parse_depth_value(depth_str):
    """Parse depth string to float meters"""
    if not depth_str:
        return 0.0
    
    try:
        # Handle formats like "28.7 m", "0.0 m"
        depth_str = depth_str.replace(' m', '').strip()
        return float(depth_str)
    except (ValueError, AttributeError):
        return 0.0

def parse_temperature_value(temp_str):
    """Parse temperature string to float Celsius"""
    if not temp_str:
        return None
    
    try:
        # Handle formats like "19.0 C", "27.7 C"
        temp_str = temp_str.replace(' C', '').strip()
        return float(temp_str)
    except (ValueError, AttributeError):
        return None

def parse_cns_value(cns_str):
    """Parse CNS string to float percentage"""
    if not cns_str:
        return None
    
    try:
        # Handle formats like "3%", "0%"
        cns_str = cns_str.replace('%', '').strip()
        return float(cns_str)
    except (ValueError, AttributeError):
        return None

def save_dive_profile_data(dive, profile_data, db):
    """Save dive profile data as JSON file and update dive record"""
    try:
        # Reuse filename if it's already a JSON profile to update it instead of creating orphans
        if dive.profile_xml_path and dive.profile_xml_path.endswith('.json'):
            filename = dive.profile_xml_path
        else:
            # Generate unique filename for new profile
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"dive_{dive.id}_profile_{timestamp}.json"
        
        # Convert profile data to JSON bytes
        json_content = orjson.dumps(profile_data, option=orjson.OPT_INDENT_2)
        
        # Upload to R2 or local storage
        stored_path = r2_storage.upload_profile(dive.user_id, filename, json_content)
        
        # Update dive record with profile metadata
        dive.profile_xml_path = stored_path
        dive.profile_sample_count = len(profile_data.get('samples', []))
        dive.profile_max_depth = profile_data.get('calculated_max_depth', 0)
        dive.profile_duration_minutes = profile_data.get('calculated_duration_minutes', 0)
        
        # Commit the changes
        db.commit()
        
    except Exception as e:
        # Rollback on error
        db.rollback()
        raise e


@router.post("/import/subsurface-xml")
async def import_subsurface_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from Subsurface XML file.
    Returns parsed dive data for user review before import.
    """
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an XML file"
        )

    try:
        # Read and parse XML file
        content = await file.read()
        
        # Parse XML
        # Note: Standard xml.etree.ElementTree in modern Python (3.9+) is safe against
        # basic XXE and entity expansion (billion laughs) by default.
        root = ET.fromstring(content.decode('utf-8'))

        # Extract dive sites
        dive_sites = {}
        for site_elem in root.findall('.//divesites/site'):
            site_id = site_elem.get('uuid')
            site_name = site_elem.get('name')
            gps = site_elem.get('gps')

            if site_id and site_name:
                dive_sites[site_id] = {
                    'name': site_name,
                    'gps': gps
                }

        # Extract dives
        parsed_dives = []
        # Look for dives in different XML structures
        dive_elements = []
        if root.tag == 'dives':
            dive_elements = root.findall('dive')
        elif root.tag == 'divelog':
            # Check if there's a dives container inside divelog
            dives_container = root.find('dives')
            if dives_container is not None:
                dive_elements = dives_container.findall('dive')
            else:
                dive_elements = root.findall('dive')
        elif root.tag == 'dive':
            dive_elements = [root]
        else:
            # Try to find dives anywhere in the XML
            dive_elements = root.findall('.//dive')
        
        # Pre-fetch data for performance
        all_centers = db.query(DivingCenter).all()
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()

        # Build unique site match cache for XML (Memory-only matching against full list)
        xml_site_names = set()
        for site_info in dive_sites.values():
            if site_info.get('name'):
                xml_site_names.add(site_info['name'])
        
        site_match_cache = {}
        for site_name in xml_site_names:
            site_match_cache[site_name] = find_dive_site_by_import_id(
                site_name, db, site_name, sites=all_sites
            )

        for dive_elem in dive_elements:
            # Update parse_dive_element to use the cache
            dive_data = parse_dive_element(dive_elem, dive_sites, db, site_match_cache=site_match_cache)
            if dive_data:
                # Check for existing duplicates
                if dive_data.get("dive_date"):
                    existing = find_existing_dive(
                        db, current_user.id, 
                        dive_data["dive_date"], 
                        dive_data.get("dive_time"),
                        dive_data.get("duration"),
                        dive_data.get("max_depth"),
                        user_dives=user_dives
                    )
                    if existing:
                        dive_data["existing_dive_id"] = existing.id
                        dive_data["skip"] = True # Default to skip if it exists
                
                parsed_dives.append(dive_data)

        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dives found in XML file"
            )

        # Use pre-fetched data for selection (Full database list)
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
            for site in all_sites
        ]

        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives",
            "dives": parsed_dives,
            "total_count": len(parsed_dives),
            "available_dive_sites": dive_sites_for_selection
        }

    except ET.ParseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid XML format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing XML file: {str(e)}"
        )

@router.post("/import/csv-headers", response_model=CSVHeaderResponse)
async def get_csv_headers(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Parse CSV headers and provide a sample of the data.
    Limits file size to 5MB and row count to 5000.
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )

    # Limit file size (5MB)
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 5MB)"
        )

    import csv
    import io

    try:
        # Handle BOM if present
        text_content = content.decode('utf-8-sig')
        stream = io.StringIO(text_content)
        
        # Try to detect delimiter if not default
        sample = text_content[:1024]
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = 'excel' # Fallback

        reader = csv.DictReader(stream, dialect=dialect)
        
        headers = reader.fieldnames or []
        sample_data = []
        row_count = 0
        
        for row in reader:
            if row_count < 3:
                # Sanitize sample data for security
                sample_data.append({k: sanitize_csv_cell(v) for k, v in row.items()})
            row_count += 1
            if row_count >= 5000:
                break # Hard limit
            
        return {
            "headers": headers,
            "sample_data": sample_data,
            "total_rows": row_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}"
        )

@router.post("/import/process-csv")
async def process_csv_import(
    file: UploadFile = File(...),
    mapping: str = Query(..., description="JSON string of mapping {csv_column: divemap_field}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process CSV data using user-provided field mapping.
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )

    # Limit file size (5MB)
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 5MB)"
        )

    import csv
    import io
    import orjson

    try:
        field_map = orjson.loads(mapping)
    except Exception:
        raise HTTPException(400, "Invalid mapping JSON")

    try:
        # Handle BOM if present
        text_content = content.decode('utf-8-sig')
        stream = io.StringIO(text_content)
        
        # Try to detect delimiter
        sample = text_content[:1024]
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = 'excel'

        # 1. Read CSV rows into memory first (limited to 5000)
        rows = []
        unique_site_names = set()
        unique_entity_names = set()
        
        reader = csv.DictReader(stream, dialect=dialect)
        for row in reader:
            rows.append(row)
            # Extract unique names for pre-fetching
            for csv_col, val in row.items():
                field = field_map.get(csv_col)
                if val and val.strip():
                    if field == "dive_site_name":
                        unique_site_names.add(val.strip())
                    elif field == "mixed_entity":
                        unique_entity_names.add(val.strip())
            if len(rows) >= 5000: break

        parsed_dives = []
        
        # 2. Global Pre-fetching
        all_tags = db.query(AvailableTag).all()
        all_centers = db.query(DivingCenter).all()
        all_users = db.query(User).all()
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        
        # Optimization: Fetch ONLY essential columns for ALL sites.
        # This allows full fuzzy matching in memory against the entire database.
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()

        # 3. Targeted Fuzzy Matching for UNIQUE names (Memory-only against full list)
        site_match_cache = {}
        for site_name in unique_site_names:
            site_match_cache[site_name] = find_dive_site_by_import_id(
                site_name, db, site_name, sites=all_sites
            )

        tag_lookup = {t.name.lower(): t.id for t in all_tags}
        
        # Cache for entities
        entity_match_cache = {}

        for row in rows:
                
            dive_data = {
                "is_private": False,
                "dive_information": "",
                "tags": []
            }
            unmapped_info = []
            auto_tags = []
            
            for csv_col, val in row.items():
                if val is None:
                    continue
                
                field = field_map.get(csv_col)
                # Sanitize input
                val = sanitize_csv_cell(val)
                
                if field == "max_depth":
                    dive_data["max_depth"] = parse_csv_depth(val)
                elif field == "average_depth":
                    dive_data["average_depth"] = parse_csv_depth(val)
                elif field == "duration" and val:
                    # Simple integer extraction
                    match = re.search(r'(\d+)', val)
                    if match:
                        dive_data["duration"] = int(match.group(1))
                elif field == "dive_date":
                    d, t = parse_csv_date_time(val)
                    if d:
                        dive_data["dive_date"] = d.strftime("%Y-%m-%d")
                    if t:
                        dive_data["dive_time"] = t.strftime("%H:%M:%S")
                elif field == "dive_site_name":
                    match = site_match_cache.get(val) if val else None
                    if match:
                        dive_data["dive_site_id"] = match["id"]
                        if match.get("match_type") == "similarity":
                            dive_data["proposed_sites"] = match.get("proposed_sites")
                    else:
                        dive_data["unmatched_dive_site"] = {"name": val}

                elif field == "mixed_entity":
                    if val and val.strip():
                        if val not in entity_match_cache:
                            entity_match_cache[val] = resolve_entity(db, val, centers=all_centers, users=all_users)
                        
                        eid, etype = entity_match_cache[val]
                        if etype == "center":
                            dive_data["diving_center_id"] = eid
                            # Find name in pre-fetched list
                            center = next((c for c in all_centers if c.id == eid), None)
                            if center:
                                dive_data["diving_center_name"] = center.name
                        elif etype == "buddy":
                            dive_data["buddies"] = [eid]
                        else:
                            unmapped_info.append(f"Buddy/Center: {val}")
                elif field == "notes":
                    if val and val.strip():
                        dive_data["dive_information"] += f"{val}\n"
                elif field == "auto_tag":
                    if val and val.strip():
                        # Try to find a matching tag
                        tag_id = tag_lookup.get(val.lower().strip())
                        if tag_id:
                            auto_tags.append(tag_id)
                        else:
                            unmapped_info.append(f"{csv_col}: {val}")
                elif field == "ignore" or csv_col.lower() == "country":
                    continue
                else:
                    # Skip empty values for unmapped columns
                    if val and isinstance(val, str) and val.strip():
                        unmapped_info.append(f"{csv_col}: {val}")
            
            # Combine auto tags
            if auto_tags:
                dive_data["tags"] = list(set(auto_tags))
                
            # Append unmapped info to notes
            if unmapped_info:
                if dive_data["dive_information"]:
                    dive_data["dive_information"] += "\n"
                dive_data["dive_information"] += "Imported Details:\n" + "\n".join(unmapped_info)
            
            # Final cleanup of notes
            dive_data["dive_information"] = dive_data["dive_information"].strip() or None
            
            # Check for existing duplicates
            if dive_data.get("dive_date"):
                existing = find_existing_dive(
                    db, current_user.id, 
                    dive_data["dive_date"], 
                    dive_data.get("dive_time"),
                    dive_data.get("duration"),
                    dive_data.get("max_depth"),
                    user_dives=user_dives
                )
                if existing:
                    dive_data["existing_dive_id"] = existing.id
                    dive_data["skip"] = True # Default to skip if it exists
            
            parsed_dives.append(dive_data)

        # Use pre-fetched data for selection (Full database list)
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
            for site in all_sites
        ]

        diving_centers_for_selection = [
            {"id": dc.id, "name": dc.name, "country": dc.country}
            for dc in all_centers
        ]

        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives",
            "dives": parsed_dives,
            "available_dive_sites": dive_sites_for_selection,
            "available_diving_centers": diving_centers_for_selection
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV file: {str(e)}"
        )


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
        
        # Pre-fetch data for performance
        all_centers = db.query(DivingCenter).all()
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()
        
        # For Garmin FIT, site matching is primarily coordinate-based
        parsed_dives = parse_garmin_fit_file(content, db, current_user.id, user_dives=user_dives, all_sites=all_sites)

        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No dive sessions found in FIT file"
            )

        # Use pre-fetched data for manual selection in frontend review (Full list)
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
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

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing Garmin FIT file: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV file: {str(e)}"
        )


@router.post("/import/confirm")
async def confirm_import_dives(
    dives_data: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Confirm and import the selected dives after user review.
    """
    if not dives_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No dives to import"
        )

    imported_dives = []
    errors = []

    for i, dive_data in enumerate(dives_data):
        try:
            # Validate required fields
            if not dive_data.get('dive_date'):
                errors.append(f"Dive {i+1}: Missing dive date")
                continue

            # Check if this is an update of an existing dive
            existing_id = dive_data.get('id') or dive_data.get('existing_dive_id')
            existing_dive = None
            if existing_id:
                existing_dive = db.query(Dive).filter(Dive.id == existing_id, Dive.user_id == current_user.id).first()

            # Create/Update data
            dive_create = DiveCreate(
                dive_site_id=dive_data.get('dive_site_id'),
                diving_center_id=dive_data.get('diving_center_id'),
                name=dive_data.get('name'),
                is_private=dive_data.get('is_private', False),
                dive_information=dive_data.get('dive_information'),
                max_depth=dive_data.get('max_depth'),
                average_depth=dive_data.get('average_depth'),
                gas_bottles_used=dive_data.get('gas_bottles_used'),
                suit_type=dive_data.get('suit_type'),
                difficulty_code=convert_difficulty_to_code(dive_data.get('difficulty_level', 'intermediate')),
                visibility_rating=dive_data.get('visibility_rating'),
                user_rating=dive_data.get('user_rating'),
                dive_date=dive_data['dive_date'],
                dive_time=dive_data.get('dive_time'),
                duration=dive_data.get('duration')
            )

            # Parse date and time for SQLite compatibility (accept both str and date/time objects)
            raw_dive_date = dive_data['dive_date']
            if isinstance(raw_dive_date, date):
                dive_date = raw_dive_date
            else:
                dive_date = datetime.strptime(raw_dive_date, "%Y-%m-%d").date()

            dive_time = None
            raw_dive_time = dive_data.get('dive_time')
            if raw_dive_time is not None:
                if isinstance(raw_dive_time, time):
                    dive_time = raw_dive_time
                else:
                    dive_time = datetime.strptime(raw_dive_time, "%H:%M:%S").time()

            # Create/Update the dive
            dive_data_dict = dive_create.model_dump(exclude_unset=True)
            dive_data_dict['dive_date'] = dive_date  # Use parsed date object
            dive_data_dict['dive_time'] = dive_time  # Use parsed time object
            
            # Convert difficulty_code to difficulty_id if present
            difficulty_code = dive_data_dict.pop('difficulty_code', None)
            if difficulty_code:
                from app.models import get_difficulty_id_by_code
                difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
                if difficulty_id:
                    dive_data_dict['difficulty_id'] = difficulty_id
            
            if existing_dive:
                # Update existing dive
                for key, value in dive_data_dict.items():
                    setattr(existing_dive, key, value)
                dive = existing_dive
            else:
                # Create new dive
                dive = Dive(
                    user_id=current_user.id,
                    **dive_data_dict
                )
                db.add(dive)

            # Generate name using format: "divesite - date - original dive name from XML"
            # Store original name before generating new one
            # For updates, we keep the existing name if already present
            if not existing_dive or not existing_dive.name:
                original_dive_name = dive.name  # This is the name from XML (e.g., "Dive #351")
                
                if dive.dive_site_id:
                    dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                    if dive_site:
                        # Use date object directly when available
                        if isinstance(dive.dive_date, date):
                            dive_date_obj = dive.dive_date
                        else:
                            dive_date_obj = datetime.strptime(dive.dive_date, '%Y-%m-%d').date()
                        # Generate name with format: "divesite - date - original name"
                        dive.name = generate_dive_name(dive_site.name, dive_date_obj, original_dive_name)
                else:
                    # If no dive site, use fallback format
                    if original_dive_name:
                        dive.name = f"Dive - {dive.dive_date} - {original_dive_name}"
                    else:
                        dive.name = f"Dive - {dive.dive_date}"

            db.add(dive)
            db.flush()  # Get the dive ID

            # Check if dive has decompression profile and add deco tag
            if 'profile_data' in dive_data and dive_data['profile_data']:
                if has_deco_profile(dive_data['profile_data']):
                    try:
                        deco_tag = get_or_create_deco_tag(db)
                        dive_tag = DiveTag(dive_id=dive.id, tag_id=deco_tag.id)
                        db.add(dive_tag)
                    except Exception as e:
                        # Log error but don't fail the import
                        print(f"Warning: Failed to add deco tag for dive {dive.id}: {str(e)}")

            # Save dive profile data if available
            # Note: dive_data refers to the individual item from dives_data input
            if 'profile_data' in dive_data and dive_data['profile_data']:
                try:
                    profile_data = dive_data['profile_data']
                    # Ensure compatibility with frontend profile chart
                    if 'samples' in profile_data and profile_data['samples']:
                        samples = profile_data['samples']
                        depths = [s.get('depth', 0) for s in samples]
                        temps = [s.get('temperature') for s in samples if s.get('temperature') is not None]
                        
                        profile_data['calculated_max_depth'] = max(depths) if depths else 0
                        profile_data['calculated_avg_depth'] = round(sum(depths) / len(depths), 2) if depths else 0
                        profile_data['calculated_duration_minutes'] = dive.duration or 0
                        profile_data['sample_count'] = len(samples)
                        profile_data['temperature_range'] = {
                            "min": min(temps) if temps else None,
                            "max": max(temps) if temps else None
                        }
                        # Preserve events if they were extracted by the parser (Garmin)
                        if 'events' not in profile_data:
                            profile_data['events'] = [] # Required by chart
                    
                    save_dive_profile_data(dive, profile_data, db)
                except Exception as e:
                    # Log error but don't fail the import
                    print(f"Warning: Failed to save profile data for dive {dive.id}: {str(e)}")

            # Get dive site name for response
            dive_site_name = None
            if dive.dive_site_id:
                dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                if dive_site:
                    dive_site_name = dive_site.name
            
            imported_dives.append({
                "id": dive.id,
                "name": dive.name,
                "dive_date": dive.dive_date.isoformat() if dive.dive_date else None,
                "dive_site_id": dive.dive_site_id,
                "dive_site_name": dive_site_name
            })

        except Exception as e:
            error_msg = f"Dive {i+1}: {str(e)}"
            errors.append(error_msg)
            print(f"Error importing dive {i+1}: {str(e)}")
            import traceback
            traceback.print_exc()

    # Commit all changes
    db.commit()

    return {
        "message": f"Successfully imported {len(imported_dives)} dives",
        "imported_dives": imported_dives,
        "errors": errors,
        "total_imported": len(imported_dives),
        "total_errors": len(errors)
    }


def parse_dive_element(dive_elem, dive_sites, db, site_match_cache=None):
    """Parse individual dive element from XML"""
    try:
        # Extract basic dive information
        dive_number = dive_elem.get('number')
        rating = dive_elem.get('rating')
        visibility = dive_elem.get('visibility')
        sac = dive_elem.get('sac')
        otu = dive_elem.get('otu')
        cns = dive_elem.get('cns')
        tags = dive_elem.get('tags')
        divesiteid = dive_elem.get('divesiteid')
        dive_date = dive_elem.get('date')
        dive_time = dive_elem.get('time')
        duration = dive_elem.get('duration')

        # Parse buddy information
        buddy_elem = dive_elem.find('buddy')
        buddy = buddy_elem.text if buddy_elem is not None else None

        # Parse suit information
        suit_elem = dive_elem.find('suit')
        suit = suit_elem.text if suit_elem is not None else None

        # Parse cylinders
        cylinders = []
        for cylinder_elem in dive_elem.findall('cylinder'):
            cylinder_data = parse_cylinder(cylinder_elem)
            cylinders.append(cylinder_data)

        # Parse weight systems
        weights = []
        for weights_elem in dive_elem.findall('weightsystem'):
            weights_data = parse_weightsystem(weights_elem)
            weights.append(weights_data)

        # Parse dive computer
        computer_data = None
        computer_elem = dive_elem.find('divecomputer')
        if computer_elem is not None:
            computer_data = parse_divecomputer(computer_elem)

        # Parse dive profile samples - look for samples in divecomputer element (Subsurface format)
        profile_data = None
        divecomputer_elem = dive_elem.find('divecomputer')
        if divecomputer_elem is not None:
            profile_data = parse_dive_profile_samples(divecomputer_elem)

        # Extract events if available
        events = profile_data.get('events') if profile_data else None

        # Convert to Divemap format
        divemap_dive = convert_to_divemap_format(
            dive_number, rating, visibility, sac, otu, cns, tags,
            divesiteid, dive_date, dive_time, duration,
            buddy, suit, cylinders, weights, computer_data,
            dive_sites, db, events=events, site_match_cache=site_match_cache
        )

        # Add profile data to the dive
        if profile_data:
            divemap_dive['profile_data'] = profile_data

        return divemap_dive

    except Exception as e:
        print(f"Error parsing dive element: {e}")
        return None

def parse_cylinder(cylinder_elem):
    """Parse cylinder information from XML element"""
    cylinder_data = {}

    # Extract cylinder attributes
    cylinder_data['size'] = cylinder_elem.get('size')
    cylinder_data['workpressure'] = cylinder_elem.get('workpressure')
    cylinder_data['description'] = cylinder_elem.get('description')
    cylinder_data['o2'] = cylinder_elem.get('o2')
    cylinder_data['he'] = cylinder_elem.get('he')
    cylinder_data['start'] = cylinder_elem.get('start')
    cylinder_data['end'] = cylinder_elem.get('end')
    cylinder_data['depth'] = cylinder_elem.get('depth')

    return cylinder_data

def parse_weightsystem(weights_elem):
    """Parse weight system information from XML element"""
    weights_data = {}

    # Extract weight system attributes
    weights_data['weight'] = weights_elem.get('weight')
    weights_data['description'] = weights_elem.get('description')

    return weights_data

def parse_divecomputer(computer_elem):
    """Parse dive computer information from XML element"""
    computer_data = {}

    # Extract basic computer info
    computer_data['model'] = computer_elem.get('model')
    computer_data['deviceid'] = computer_elem.get('deviceid')
    computer_data['diveid'] = computer_elem.get('diveid')

    # Parse depth information
    depth_elem = computer_elem.find('depth')
    if depth_elem is not None:
        computer_data['max_depth'] = depth_elem.get('max')
        computer_data['mean_depth'] = depth_elem.get('mean')

    # Parse temperature information
    temp_elem = computer_elem.find('temperature')
    if temp_elem is not None:
        computer_data['water_temp'] = temp_elem.get('water')

    # Parse surface pressure
    surface_pressure_elem = computer_elem.find('surface pressure')
    if surface_pressure_elem is not None:
        computer_data['surface_pressure'] = surface_pressure_elem.get('surface pressure')

    # Parse water salinity
    salinity_elem = computer_elem.find('water salinity')
    if salinity_elem is not None:
        computer_data['water_salinity'] = salinity_elem.get('water salinity')

    # Parse extradata - only keep "Deco model"
    extradata_list = []
    for extradata_elem in computer_elem.findall('extradata'):
        key = extradata_elem.get('key')
        value = extradata_elem.get('value')
        if key == 'Deco model':
            extradata_list.append({'key': key, 'value': value})

    computer_data['extradata'] = extradata_list

    return computer_data

def parse_duration(duration_str):
    """Convert Subsurface duration format to minutes"""
    try:
        # Remove "min" and trim
        duration_str = duration_str.replace("min", "").strip()

        if ":" in duration_str:
            # Format: "42:30" (minutes:seconds)
            parts = duration_str.split(":")
            if len(parts) == 2:
                minutes = int(parts[0])
                seconds = int(parts[1])
                # Convert to total minutes (rounding up for partial minutes)
                total_minutes = minutes + (seconds / 60)
                return int(total_minutes)
            else:
                print(f"Invalid duration format: {duration_str}")
                return None
        else:
            # Format: "45" (just minutes)
            return int(duration_str)

    except (ValueError, AttributeError) as e:
        print(f"Error parsing duration '{duration_str}': {e}")
        return None

def parse_rating(rating):
    """Convert Subsurface rating (1-5) to Divemap rating (1-10)"""
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        print(f"Invalid rating value: {rating}, defaulting to 5")
        rating = 5

    # Convert 1-5 scale to 1-10 scale
    return rating * 2

def parse_suit_type(suit_str):
    """Parse suit type from Subsurface format"""
    if not suit_str:
        return None

    suit_mapping = {
        "wet": "wet_suit",
        "dry": "dry_suit",
        "shortie": "shortie",
        "aqualung": "wet_suit",
        "drysuit": "dry_suit",
        "shorty": "shortie",
        "wetsuit": "wet_suit",
        "wet suit": "wet_suit",
        "rofos": "dry_suit"
    }

    suit_lower = suit_str.lower()

    # Check for exact matches first
    for key, value in suit_mapping.items():
        if key in suit_lower:
            return value

    # If no match found, return None
    print(f"Unknown suit type: {suit_str}")
    return None

# Constants for tank matching (mirroring frontend/src/utils/diveConstants.js)
TANK_DEFINITIONS = [
    {'id': '3', 'size': 3.0},
    {'id': 'al40', 'size': 5.7},
    {'id': 'alu7', 'size': 7.0},
    {'id': '7', 'size': 7.0},
    {'id': '8.5', 'size': 8.5},
    {'id': '10', 'size': 10.0},
    {'id': 'al80', 'size': 11.1},
    {'id': '12', 'size': 12.0},
    {'id': '14', 'size': 14.0}, # Double 7
    {'id': '15', 'size': 15.0},
    {'id': '18', 'size': 18.0},
    {'id': 'double_al80', 'size': 22.2},
    {'id': '24', 'size': 24.0}, # Double 12
]

def match_tank_id(vol_liters):
    """Find closest matching tank ID for a given volume"""
    if not vol_liters:
        return '12' # Default
    
    best_id = '12'
    min_diff = float('inf')
    
    for tank in TANK_DEFINITIONS:
        diff = abs(tank['size'] - vol_liters)
        if diff < min_diff:
            min_diff = diff
            best_id = tank['id']
            
    return best_id

def create_structured_gas_data(cylinders, events=None):
    """Convert cylinder list to structured JSON string for GasTanksInput"""
    if not cylinders:
        return None
    
    # Filter out invalid/ghost cylinders
    # A cylinder is valid if it has size, pressure data, gas data, or a known description
    valid_cylinders = []
    for cyl in cylinders:
        has_size = bool(cyl.get('size'))
        has_pressure = bool(cyl.get('start') or cyl.get('end'))
        has_gas = bool(cyl.get('o2') or cyl.get('he'))
        has_desc = bool(cyl.get('description') and cyl.get('description') != 'unknown')
        
        if has_size or has_pressure or has_gas or has_desc:
            valid_cylinders.append(cyl)
    
    cylinders = valid_cylinders

    if not cylinders:
        return None
        
    # Determine back gas index (default to 0)
    back_gas_index = 0
    
    # 1. Check if first tank is smaller than second tank (typical for stage/backgas listing)
    if len(cylinders) >= 2:
        try:
            size0_str = cylinders[0].get('size', '0').replace(' l', '').strip()
            size1_str = cylinders[1].get('size', '0').replace(' l', '').strip()
            size0 = float(size0_str) if size0_str else 0.0
            size1 = float(size1_str) if size1_str else 0.0
            
            if size0 > 0 and size1 > 0 and size0 < size1:
                back_gas_index = 1
        except (ValueError, TypeError, AttributeError):
            pass

    # 2. Look at gaschange events to find starting tank (more accurate)
    if events:
        for event in events:
            # Gas change at time 0 indicates the starting tank
            if event.get('type') == 'gaschange' and event.get('time_minutes') == 0:
                cyl_idx_str = event.get('cylinder')
                if cyl_idx_str is not None:
                    try:
                        back_gas_index = int(cyl_idx_str)
                        break
                    except (ValueError, TypeError):
                        pass
    
    # Ensure back_gas_index is valid
    if back_gas_index >= len(cylinders):
        back_gas_index = 0

    structured = {
        "mode": "structured",
        "back_gas": {
            "tank": "12",
            "start_pressure": 200,
            "end_pressure": 50,
            "gas": {"o2": 21, "he": 0}
        },
        "stages": []
    }
    
    for i, cyl in enumerate(cylinders):
        # Parse size
        size_val = cyl.get('size')
        size_str = size_val.replace(' l', '').strip() if size_val else ''
        vol = float(size_str) if size_str else 0.0
        tank_id = match_tank_id(vol)
        
        # Parse pressures
        start_val = cyl.get('start')
        start_str = start_val.replace(' bar', '').strip() if start_val else ''
        
        end_val = cyl.get('end')
        end_str = end_val.replace(' bar', '').strip() if end_val else ''
        
        # Parse gas
        o2_val = cyl.get('o2')
        o2_str = o2_val.replace('%', '').strip() if o2_val else ''
        
        he_val = cyl.get('he')
        he_str = he_val.replace('%', '').strip() if he_val else ''
        
        o2 = int(float(o2_str)) if o2_str else 21
        he = int(float(he_str)) if he_str else 0
        
        # Default pressures if missing
        start_p = int(float(start_str)) if start_str else 200
        end_p = int(float(end_str)) if end_str else 50
        
        tank_obj = {
            "tank": tank_id,
            "start_pressure": start_p,
            "end_pressure": end_p,
            "gas": {"o2": o2, "he": he},
            "index": i
        }
        
        if i == back_gas_index:
            structured["back_gas"] = tank_obj
        else:
            structured["stages"].append(tank_obj)
            
    return orjson.dumps(structured).decode('utf-8')

def convert_to_divemap_format(dive_number, rating, visibility, sac, otu, cns, tags,
                             divesiteid, dive_date, dive_time, duration,
                             buddy, suit, cylinders, weights, computer_data,
                             dive_sites, db, events=None, site_match_cache=None):
    """Convert Subsurface dive data to Divemap format"""

    # Parse date and time
    parsed_date = None
    parsed_time = None

    if dive_date:
        try:
            parsed_date = datetime.strptime(dive_date, '%Y-%m-%d').date()
        except ValueError:
            print(f"Invalid date format: {dive_date}")

    if dive_time:
        try:
            parsed_time = datetime.strptime(dive_time, '%H:%M:%S').time()
        except ValueError:
            print(f"Invalid time format: {dive_time}")

    # Parse duration
    parsed_duration = None
    if duration:
        parsed_duration = parse_duration(duration)

    # Parse suit type
    parsed_suit_type = None
    if suit:
        parsed_suit_type = parse_suit_type(suit)

    # Parse ratings
    parsed_rating = None
    if rating:
        try:
            parsed_rating = parse_rating(int(rating))
        except ValueError:
            print(f"Invalid rating: {rating}")

    parsed_visibility = None
    if visibility:
        try:
            parsed_visibility = parse_rating(int(visibility))
        except ValueError:
            print(f"Invalid visibility rating: {visibility}")

    # Build dive information text
    dive_info_parts = []

    if buddy:
        dive_info_parts.append(f"Buddy: {buddy}")

    if sac:
        dive_info_parts.append(f"SAC: {sac}")

    # Calculate Real SAC (Z-Factor) using Physics Engine
    if parsed_duration and parsed_duration > 0 and cylinders:
        # Use first cylinder with valid pressure drop
        for cylinder in cylinders:
            try:
                # Extract volume (e.g. "15.0 l")
                size_str = cylinder.get('size', '').replace(' l', '').strip()
                vol = float(size_str) if size_str else 0
                
                # Extract pressures (e.g. "200.0 bar")
                start_str = cylinder.get('start', '').replace(' bar', '').strip()
                end_str = cylinder.get('end', '').replace(' bar', '').strip()
                start_p = float(start_str) if start_str else 0
                end_p = float(end_str) if end_str else 0
                
                # Extract gas mix
                o2_str = cylinder.get('o2', '21%').replace('%', '').strip()
                he_str = cylinder.get('he', '0%').replace('%', '').strip()
                o2 = float(o2_str) if o2_str else 21.0
                he = float(he_str) if he_str else 0.0
                
                if vol > 0 and start_p > end_p:
                    # Get average depth from computer data if available
                    avg_depth = 0
                    if computer_data and computer_data.get('mean_depth'):
                        avg_depth = float(computer_data['mean_depth'].replace(' m', ''))
                    
                    if avg_depth > 0:
                        gas_mix = GasMix(o2=o2, he=he)
                        
                        # Calculate Real Volume used (Surface Equivalent)
                        vol_start = calculate_real_volume(vol, start_p, gas_mix)
                        vol_end = calculate_real_volume(vol, end_p, gas_mix)
                        gas_used_liters = vol_start - vol_end
                        
                        # Calculate SAC (L/min/atm)
                        # ATA = Depth/10 + 1 (Approx for SAC)
                        ata = (avg_depth / 10.0) + 1.0
                        real_sac = gas_used_liters / parsed_duration / ata
                        
                        dive_info_parts.append(f"Real SAC (Z-Factor): {real_sac:.1f} L/min")
                        break # Only calculate for primary cylinder
            except (ValueError, AttributeError):
                continue

    if otu:
        dive_info_parts.append(f"OTU: {otu}")

    if cns:
        dive_info_parts.append(f"CNS: {cns}")

    if computer_data:
        if computer_data.get('max_depth'):
            dive_info_parts.append(f"Max Depth: {computer_data['max_depth']}")
        if computer_data.get('mean_depth'):
            dive_info_parts.append(f"Avg Depth: {computer_data['mean_depth']}")
        if computer_data.get('water_temp'):
            dive_info_parts.append(f"Water Temp: {computer_data['water_temp']}")
        if computer_data.get('surface_pressure'):
            dive_info_parts.append(f"Surface Pressure: {computer_data['surface_pressure']}")
        if computer_data.get('water_salinity'):
            dive_info_parts.append(f"Salinity: {computer_data['water_salinity']}")

        # Add deco model from extradata
        for extradata in computer_data.get('extradata', []):
            if extradata['key'] == 'Deco model':
                dive_info_parts.append(f"Deco Model: {extradata['value']}")

    # Add weight system information
    for weight in weights:
        weight_info = []
        if weight.get('weight'):
            weight_info.append(weight['weight'])
        if weight.get('description'):
            weight_info.append(weight['description'])
        if weight_info:
            dive_info_parts.append(f"Weights: {' '.join(weight_info)}")

    dive_information = "\n".join(dive_info_parts) if dive_info_parts else None

    # Build gas bottles information (Structured JSON)
    gas_bottles_used = create_structured_gas_data(cylinders, events)

    # Find dive site
    dive_site_id = None
    unmatched_dive_site = None
    proposed_dive_sites = None
    if divesiteid and divesiteid in dive_sites:
        site_data = dive_sites[divesiteid]
        site_name = site_data['name']
        
        # 1. Try cache first
        match_result = None
        if site_match_cache and site_name in site_match_cache:
            match_result = site_match_cache[site_name]
        else:
            # 2. Fallback to targeted query
            match_result = find_dive_site_by_import_id(divesiteid, db, site_name)
            
        if match_result:
            if isinstance(match_result, dict):
                dive_site_id = match_result['id']
                if match_result.get('match_type') == 'similarity':
                    proposed_dive_sites = match_result.get('proposed_sites')
            else:
                dive_site_id = match_result
        else:
            unmatched_dive_site = {
                'import_id': divesiteid,
                'name': site_name,
                'gps': site_data.get('gps')
            }

    # Build Divemap dive data
    divemap_dive = {
        'dive_site_id': dive_site_id,
        'name': f"Dive #{dive_number}" if dive_number else None,
        'is_private': False,
        'dive_information': dive_information,
        'max_depth': None,  # Will be set from computer data if available
        'average_depth': None,  # Will be set from computer data if available
        'gas_bottles_used': gas_bottles_used,
        'suit_type': parsed_suit_type,
        'difficulty_code': 'ADVANCED_OPEN_WATER',  # Default to Advanced Open Water (was 'intermediate')
        'visibility_rating': parsed_visibility,
        'user_rating': parsed_rating,
        'dive_date': parsed_date.strftime('%Y-%m-%d') if parsed_date else None,
        'dive_time': parsed_time.strftime('%H:%M:%S') if parsed_time else None,
        'duration': parsed_duration,
        'unmatched_dive_site': unmatched_dive_site,
        'proposed_dive_sites': proposed_dive_sites
    }

    # Set depths from computer data
    if computer_data:
        if computer_data.get('max_depth'):
            try:
                # Extract numeric value from "28.7 m"
                max_depth_str = computer_data['max_depth'].replace(' m', '')
                divemap_dive['max_depth'] = float(max_depth_str)
            except ValueError:
                print(f"Invalid max depth: {computer_data['max_depth']}")

        if computer_data.get('mean_depth'):
            try:
                # Extract numeric value from "16.849 m"
                mean_depth_str = computer_data['mean_depth'].replace(' m', '')
                divemap_dive['average_depth'] = float(mean_depth_str)
            except ValueError:
                print(f"Invalid mean depth: {computer_data['mean_depth']}")

    return divemap_dive
