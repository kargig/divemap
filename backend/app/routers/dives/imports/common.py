from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any, Tuple
from datetime import date, time, datetime
import orjson
from app.models import Dive, DiveSite, DivingCenter, User
from ..dives_shared import r2_storage
from ..dives_utils import find_dive_site_by_import_id, find_potential_matches, calculate_similarity
import re

# Helper function to convert old difficulty labels to new codes
def convert_difficulty_to_code(difficulty_input):
    """
    Convert old difficulty format (integer or string label) to new difficulty_code.
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
    
    return None

def semicircles_to_degrees(semicircles: Optional[int]) -> Optional[float]:
    """
    Convert Garmin semicircles to decimal degrees.
    Formula: degrees = semicircles * (180 / 2^31)
    """
    if semicircles is None:
        return None
    return float(semicircles) * (180.0 / 2**31)

def find_existing_dive(db: Session, user_id: int, dive_date: str, dive_time: Optional[str] = None, duration: Optional[int] = None, max_depth: Optional[float] = None, user_dives=None) -> Optional[Dive]:
    """
    Attempts to find an existing dive for a user to prevent duplicates.
    Matches by date + time (+/- 0.5m depth), or date + duration + depth if time is missing.
    """
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
        print(f"Spatial query failed: {e}")
        return []

def resolve_entity(db: Session, value: str, centers=None, users=None) -> Tuple[Optional[int], Optional[str]]:
    """
    Intelligently resolve a string to either a Diving Center or a User (Buddy).
    Returns (id, type) where type is 'center', 'buddy', or None.
    """
    if not value:
        return None, None
        
    search_val = value.strip()
    if not search_val:
        return None, None

    # 1. Try Diving Center Exact match
    if centers is not None:
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
        
    # 2. Try User (Buddy) match
    if users is not None:
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

    # 4. Try User Fuzzy match
    try:
        if users is None:
            users = db.query(User).all()
        for u in users:
            similarity = calculate_similarity(search_val, u.username)
            if similarity >= 0.8:
                return u.id, "buddy"
    except Exception:
        pass
        
    return None, None

def save_dive_profile_data(dive, profile_data, db):
    """Save dive profile data as JSON file and update dive record"""
    try:
        if dive.profile_xml_path and dive.profile_xml_path.endswith('.json'):
            filename = dive.profile_xml_path
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"dive_{dive.id}_profile_{timestamp}.json"
        
        json_content = orjson.dumps(profile_data, option=orjson.OPT_INDENT_2)
        stored_path = r2_storage.upload_profile(dive.user_id, filename, json_content)
        
        dive.profile_xml_path = stored_path
        dive.profile_sample_count = len(profile_data.get('samples', []))
        dive.profile_max_depth = profile_data.get('calculated_max_depth', 0)
        dive.profile_duration_minutes = profile_data.get('calculated_duration_minutes', 0)
    except Exception as e:
        raise e

from .gas_utils import create_structured_gas_data, match_tank_id

