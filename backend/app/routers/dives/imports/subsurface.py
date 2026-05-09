from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import xml.etree.ElementTree as ET
import orjson

from ..dives_shared import router, get_db, get_current_user, User, Dive, AvailableTag
from app.schemas import DiveCreate
from app.models import DiveSite, DivingCenter
from app.physics import GasMix, calculate_real_volume
from .common import find_existing_dive, find_dive_site_by_import_id, convert_difficulty_to_code
from .gas_utils import create_structured_gas_data, match_tank_id

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

def parse_dive_profile_samples(computer_elem, cylinders=None):
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
        'cylinders': cylinders,
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
                return None
        else:
            # Format: "45" (just minutes)
            return int(duration_str)

    except (ValueError, AttributeError):
        return None

def parse_rating(rating):
    """Convert Subsurface rating (1-5) to Divemap rating (1-10)"""
    if not isinstance(rating, int) or rating < 1 or rating > 5:
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
    
    # 1. Check if first tank is smaller than second tank
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

    # 2. Look at gaschange events to find starting tank
    if events:
        for event in events:
            if event.get('type') == 'gaschange' and event.get('time_minutes') == 0:
                cyl_idx_str = event.get('cylinder')
                if cyl_idx_str is not None:
                    try:
                        back_gas_index = int(cyl_idx_str)
                        break
                    except (ValueError, TypeError):
                        pass
    
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
        
        start_p = int(float(start_str)) if start_str else None
        end_p = int(float(end_str)) if end_str else None
        
        tank_obj = {
            "tank": tank_id,
            "gas": {"o2": o2, "he": he},
            "index": i,
            "description": cyl.get('description'),
            "workpressure": cyl.get('workpressure'),
            "depth": cyl.get('depth')
        }
        
        if start_p is not None:
            tank_obj["start_pressure"] = start_p
        if end_p is not None:
            tank_obj["end_pressure"] = end_p
        
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

    parsed_date = None
    parsed_time = None

    if dive_date:
        try:
            parsed_date = datetime.strptime(dive_date, '%Y-%m-%d').date()
        except ValueError:
            pass

    if dive_time:
        try:
            parsed_time = datetime.strptime(dive_time, '%H:%M:%S').time()
        except ValueError:
            pass

    parsed_duration = None
    if duration:
        parsed_duration = parse_duration(duration)

    parsed_suit_type = None
    if suit:
        parsed_suit_type = parse_suit_type(suit)

    parsed_rating = None
    if rating:
        try:
            parsed_rating = parse_rating(int(rating))
        except ValueError:
            pass

    parsed_visibility = None
    if visibility:
        try:
            parsed_visibility = parse_rating(int(visibility))
        except ValueError:
            pass

    dive_info_parts = []
    if buddy:
        dive_info_parts.append(f"Buddy: {buddy}")
    if sac:
        dive_info_parts.append(f"SAC: {sac}")

    if parsed_duration and parsed_duration > 0 and cylinders:
        for cylinder in cylinders:
            try:
                size_str = cylinder.get('size', '').replace(' l', '').strip()
                vol = float(size_str) if size_str else 0
                start_str = cylinder.get('start', '').replace(' bar', '').strip()
                end_str = cylinder.get('end', '').replace(' bar', '').strip()
                start_p = float(start_str) if start_str else 0
                end_p = float(end_str) if end_str else 0
                o2_str = cylinder.get('o2', '21%').replace('%', '').strip()
                he_str = cylinder.get('he', '0%').replace('%', '').strip()
                o2 = float(o2_str) if o2_str else 21.0
                he = float(he_str) if he_str else 0.0
                
                if vol > 0 and start_p > end_p:
                    avg_depth = 0
                    if computer_data and computer_data.get('mean_depth'):
                        avg_depth = float(computer_data['mean_depth'].replace(' m', ''))
                    
                    if avg_depth > 0:
                        gas_mix = GasMix(o2=o2, he=he)
                        vol_start = calculate_real_volume(vol, start_p, gas_mix)
                        vol_end = calculate_real_volume(vol, end_p, gas_mix)
                        gas_used_liters = vol_start - vol_end
                        ata = (avg_depth / 10.0) + 1.0
                        real_sac = gas_used_liters / parsed_duration / ata
                        dive_info_parts.append(f"Real SAC (Z-Factor): {real_sac:.1f} L/min")
                        break
            except (ValueError, AttributeError):
                continue

    if otu:
        dive_info_parts.append(f"OTU: {otu}")
    if cns:
        dive_info_parts.append(f"CNS: {cns}")

    if computer_data:
        if computer_data.get('model'):
            dive_info_parts.append(f"Computer: {computer_data['model']}")
        for extradata in computer_data.get('extradata', []):
            if extradata.get('key') == 'Deco model':
                dive_info_parts.append(f"Deco Model: {extradata['value']}")

    for weight in weights:
        weight_info = []
        if weight.get('weight'):
            weight_info.append(weight['weight'])
        if weight.get('description'):
            weight_info.append(weight['description'])
        if weight_info:
            dive_info_parts.append(f"Weight: {' - '.join(weight_info)}")

    max_depth = 0.0
    average_depth = 0.0
    if computer_data:
        if computer_data.get('max_depth'):
            max_depth = float(computer_data['max_depth'].replace(' m', ''))
        if computer_data.get('mean_depth'):
            average_depth = float(computer_data['mean_depth'].replace(' m', ''))

    dive_site_id = None
    unmatched_dive_site = None
    proposed_sites = None
    
    if divesiteid and dive_sites.get(divesiteid):
        site_name = dive_sites[divesiteid]['name']
        match = None
        if site_match_cache and site_name in site_match_cache:
            match = site_match_cache[site_name]
        else:
            match = find_dive_site_by_import_id(site_name, db, site_name)
            
        if match:
            dive_site_id = match['id']
            if match.get('match_type') == 'similarity':
                proposed_sites = match.get('proposed_sites')
        else:
            unmatched_dive_site = {
                'name': site_name,
                'gps': dive_sites[divesiteid].get('gps')
            }

    gas_bottles_used = create_structured_gas_data(cylinders, events=events)

    return {
        "dive_site_id": dive_site_id,
        "name": f"Dive #{dive_number}" if dive_number else None,
        "is_private": False,
        "dive_information": "\n".join(dive_info_parts) if dive_info_parts else None,
        "max_depth": max_depth,
        "average_depth": average_depth,
        "gas_bottles_used": gas_bottles_used,
        "suit_type": parsed_suit_type,
        "user_rating": parsed_rating,
        "visibility_rating": parsed_visibility,
        "dive_date": parsed_date.isoformat() if parsed_date else None,
        "dive_time": parsed_time.isoformat() if parsed_time else None,
        "duration": parsed_duration,
        "unmatched_dive_site": unmatched_dive_site,
        "proposed_sites": proposed_sites
    }

def parse_dive_element(dive_elem, dive_sites, db, site_match_cache=None):
    """Parse individual dive element from XML"""
    try:
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

        buddy_elem = dive_elem.find('buddy')
        buddy = buddy_elem.text if buddy_elem is not None else None
        suit_elem = dive_elem.find('suit')
        suit = suit_elem.text if suit_elem is not None else None

        cylinders = []
        for cylinder_elem in dive_elem.findall('cylinder'):
            cylinders.append(parse_cylinder(cylinder_elem))

        weights = []
        for weights_elem in dive_elem.findall('weightsystem'):
            weights.append(parse_weightsystem(weights_elem))

        computer_data = None
        computer_elem = dive_elem.find('divecomputer')
        if computer_elem is not None:
            computer_data = parse_divecomputer(computer_elem)

        profile_data = None
        divecomputer_elem = dive_elem.find('divecomputer')
        if divecomputer_elem is not None:
            profile_data = parse_dive_profile_samples(divecomputer_elem, cylinders=cylinders)

        events = profile_data.get('events') if profile_data else None

        divemap_dive = convert_to_divemap_format(
            dive_number, rating, visibility, sac, otu, cns, tags,
            divesiteid, dive_date, dive_time, duration,
            buddy, suit, cylinders, weights, computer_data,
            dive_sites, db, events=events, site_match_cache=site_match_cache
        )

        if profile_data:
            divemap_dive['profile_data'] = profile_data

        return divemap_dive

    except Exception as e:
        print(f"Error parsing dive element: {e}")
        return None

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
        content = await file.read()
        root = ET.fromstring(content.decode('utf-8'))

        dive_sites = {}
        for site_elem in root.findall('.//divesites/site'):
            site_id = site_elem.get('uuid')
            site_name = site_elem.get('name')
            gps = site_elem.get('gps')
            if site_id and site_name:
                dive_sites[site_id] = {'name': site_name, 'gps': gps}

        parsed_dives = []
        dive_elements = []
        if root.tag == 'dives':
            dive_elements = root.findall('dive')
        elif root.tag == 'divelog':
            dives_container = root.find('dives')
            if dives_container is not None:
                dive_elements = dives_container.findall('dive')
            else:
                dive_elements = root.findall('dive')
        elif root.tag == 'dive':
            dive_elements = [root]
        else:
            dive_elements = root.findall('.//dive')
        
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()

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
            dive_data = parse_dive_element(dive_elem, dive_sites, db, site_match_cache=site_match_cache)
            if dive_data:
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
                        dive_data["skip"] = True
                
                parsed_dives.append(dive_data)

        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dives found in XML file"
            )

        dive_sites_for_selection = [
            {"id": site.id, "name": site.name, "country": site.country, "region": site.region}
            for site in all_sites
        ]

        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives",
            "dives": parsed_dives,
            "total_count": len(parsed_dives),
            "available_dive_sites": dive_sites_for_selection
        }

    except ET.ParseError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid XML format"
        )
    except Exception:
        import logging
        logging.exception("Error processing XML file")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing XML file"
        )
