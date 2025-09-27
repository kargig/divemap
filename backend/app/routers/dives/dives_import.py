"""
Import functionality for dives.

This module contains import operations for dives:
- import_subsurface_xml
- confirm_import_dives
- parse_dive_information_text
- parse_dive_profile_samples
- parse_time_to_minutes
- parse_depth_value
- parse_temperature_value
- parse_cns_value
- save_dive_profile_data
- parse_dive_element
- parse_cylinder
- parse_weightsystem
- parse_divecomputer
- find_dive_site_by_import_id
- parse_duration
- parse_rating
- parse_suit_type
- convert_to_divemap_format
"""

from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET
from io import BytesIO
import re
from datetime import datetime, date, time

from .dives_shared import router, get_db, get_current_user, User, Dive, DiveSite, DiveSiteAlias, AvailableTag, DivingCenter, get_difficulty_label, get_difficulty_value
from .dives_db_utils import get_or_create_deco_tag
from .dives_errors import raise_validation_error, raise_internal_error
from .dives_logging import log_import_operation, log_error
from ..schemas import DiveCreate


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


def has_deco_profile(profile_data: dict) -> bool:
    """Check if dive profile contains any samples with in_deco=True."""
    if not profile_data or 'samples' not in profile_data:
        return False
    
    for sample in profile_data['samples']:
        if sample.get('in_deco') is True:
            return True
    return False


def save_dive_profile_data(dive, profile_data, db):
    """Save dive profile data as JSON file and update dive record"""
    try:
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dive_{dive.id}_profile_{timestamp}.json"
        
        # Convert profile data to JSON bytes
        json_content = json.dumps(profile_data, indent=2).encode('utf-8')
        
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


def parse_cylinder(cylinder_elem) -> Dict[str, Any]:
    """Parse cylinder information from Subsurface XML"""
    cylinder = {}
    
    if cylinder_elem is None:
        return cylinder
    
    # Parse cylinder attributes
    cylinder['type'] = cylinder_elem.get('type', '')
    cylinder['size'] = cylinder_elem.get('size', '')
    cylinder['workingpressure'] = cylinder_elem.get('workingpressure', '')
    cylinder['start'] = cylinder_elem.get('start', '')
    cylinder['end'] = cylinder_elem.get('end', '')
    
    return cylinder


def parse_weightsystem(weightsystem_elem) -> Dict[str, Any]:
    """Parse weightsystem information from Subsurface XML"""
    weightsystem = {}
    
    if weightsystem_elem is None:
        return weightsystem
    
    # Parse weightsystem attributes
    weightsystem['weight'] = weightsystem_elem.get('weight', '')
    weightsystem['description'] = weightsystem_elem.get('description', '')
    
    return weightsystem


def parse_divecomputer(divecomputer_elem) -> Dict[str, Any]:
    """Parse divecomputer information from Subsurface XML"""
    divecomputer = {}
    
    if divecomputer_elem is None:
        return divecomputer
    
    # Parse divecomputer attributes
    divecomputer['model'] = divecomputer_elem.get('model', '')
    divecomputer['deviceid'] = divecomputer_elem.get('deviceid', '')
    divecomputer['nickname'] = divecomputer_elem.get('nickname', '')
    
    return divecomputer


def find_dive_site_by_import_id(import_id: str, db: Session) -> Optional[DiveSite]:
    """Find dive site by import ID"""
    if not import_id:
        return None
    
    # First try to find by exact import_id match
    dive_site = db.query(DiveSite).filter(DiveSite.import_id == import_id).first()
    if dive_site:
        return dive_site
    
    # Then try to find by alias
    alias = db.query(DiveSiteAlias).filter(DiveSiteAlias.alias == import_id).first()
    if alias:
        return alias.dive_site
    
    return None


def parse_duration(duration_str: str) -> Optional[int]:
    """Parse duration string to seconds"""
    if not duration_str:
        return None
    
    # Handle format like "1:23" or "83" (minutes)
    if ':' in duration_str:
        parts = duration_str.split(':')
        if len(parts) == 2:
            try:
                hours = int(parts[0])
                minutes = int(parts[1])
                return hours * 3600 + minutes * 60
            except ValueError:
                return None
    else:
        try:
            # Assume minutes
            return int(duration_str) * 60
        except ValueError:
            return None
    
    return None


def parse_rating(rating_str: str) -> Optional[int]:
    """Parse rating string to integer"""
    if not rating_str:
        return None
    
    try:
        rating = int(rating_str)
        if 1 <= rating <= 5:
            return rating
    except ValueError:
        pass
    
    return None


def parse_suit_type(suit_str: str) -> Optional[str]:
    """Parse suit type from string"""
    if not suit_str:
        return None
    
    # Map common suit types
    suit_mapping = {
        'wetsuit': 'wetsuit',
        'dry suit': 'drysuit',
        'drysuit': 'drysuit',
        'swimsuit': 'swimsuit',
        'rashguard': 'rashguard'
    }
    
    suit_lower = suit_str.lower()
    for key, value in suit_mapping.items():
        if key in suit_lower:
            return value
    
    return suit_str


def convert_to_divemap_format(dive_elem, db: Session) -> Optional[DiveCreate]:
    """Convert Subsurface dive element to Divemap format"""
    try:
        # Parse basic dive information
        dive_data = {}
        
        # Parse date
        date_str = dive_elem.get('date')
        if date_str:
            try:
                dive_data['dive_date'] = datetime.fromisoformat(date_str).date()
            except ValueError:
                return None
        
        # Parse time
        time_str = dive_elem.get('time')
        if time_str:
            try:
                dive_data['dive_time'] = datetime.fromisoformat(time_str).time()
            except ValueError:
                pass
        
        # Parse dive site
        site_name = dive_elem.get('location', '')
        if site_name:
            # Try to find existing dive site
            dive_site = find_dive_site_by_import_id(site_name, db)
            if dive_site:
                dive_data['dive_site_id'] = dive_site.id
            else:
                # Create new dive site
                new_site = DiveSite(
                    name=site_name,
                    import_id=site_name,
                    difficulty_level=1  # Default difficulty
                )
                db.add(new_site)
                db.commit()
                db.refresh(new_site)
                dive_data['dive_site_id'] = new_site.id
        
        # Parse depth
        depth_str = dive_elem.get('maxdepth')
        if depth_str:
            depth = parse_depth_value(depth_str)
            if depth:
                dive_data['depth'] = depth
        
        # Parse duration
        duration_str = dive_elem.get('duration')
        if duration_str:
            duration = parse_duration(duration_str)
            if duration:
                dive_data['duration'] = duration
        
        # Parse rating
        rating_str = dive_elem.get('rating')
        if rating_str:
            rating = parse_rating(rating_str)
            if rating:
                dive_data['rating'] = rating
        
        # Parse suit type
        suit_str = dive_elem.get('suit')
        if suit_str:
            suit_type = parse_suit_type(suit_str)
            if suit_type:
                dive_data['suit_type'] = suit_type
        
        # Parse notes
        notes = dive_elem.get('notes', '')
        if notes:
            dive_data['notes'] = notes
        
        # Parse buddy
        buddy = dive_elem.get('buddy', '')
        if buddy:
            dive_data['buddy'] = buddy
        
        # Parse temperature
        temp_str = dive_elem.get('watertemp')
        if temp_str:
            temp = parse_temperature_value(temp_str)
            if temp:
                dive_data['temperature'] = temp
        
        # Parse visibility
        vis_str = dive_elem.get('visibility')
        if vis_str:
            vis = parse_depth_value(vis_str)
            if vis:
                dive_data['visibility'] = vis
        
        # Check if dive has decompression profile
        profile_elem = dive_elem.find('profile')
        if profile_elem is not None:
            profile_data = parse_dive_profile_samples(profile_elem.text or '')
            if has_deco_profile({'samples': profile_data}):
                # Add deco tag
                deco_tag = get_or_create_deco_tag(db)
                dive_data['tags'] = [deco_tag.id]
        
        # Create DiveCreate object
        return DiveCreate(**dive_data)
        
    except Exception as e:
        log_error("convert_to_divemap_format", e, dive_elem=dive_elem.tag)
        return None


@router.post("/import/subsurface-xml")
async def import_subsurface_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import dives from Subsurface XML file"""
    try:
        # Validate file type
        if not file.filename.endswith('.xml'):
            raise_validation_error("File must be an XML file")
        
        # Read file content
        content = await file.read()
        
        # Parse XML
        try:
            root = ET.fromstring(content)
        except ET.ParseError as e:
            raise_validation_error(f"Invalid XML file: {str(e)}")
        
        # Find all dive elements
        dives = root.findall('.//dive')
        
        if not dives:
            raise_validation_error("No dives found in XML file")
        
        # Convert dives to Divemap format
        converted_dives = []
        for dive_elem in dives:
            dive_data = convert_to_divemap_format(dive_elem, db)
            if dive_data:
                converted_dives.append(dive_data)
        
        if not converted_dives:
            raise_validation_error("No valid dives found in XML file")
        
        # Store converted dives in session for confirmation
        # This is a simplified implementation - in reality you'd store this in Redis or similar
        import_session = {
            'user_id': current_user.id,
            'dives': converted_dives,
            'filename': file.filename,
            'imported_at': datetime.now().isoformat()
        }
        
        log_import_operation("xml_upload", current_user.id, len(converted_dives), filename=file.filename)
        
        return {
            "message": f"Successfully parsed {len(converted_dives)} dives from {file.filename}",
            "dive_count": len(converted_dives),
            "dives": converted_dives[:5]  # Return first 5 dives as preview
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("import_subsurface_xml", e, current_user.id, filename=file.filename)
        raise_internal_error("Failed to import XML file")


@router.post("/import/confirm")
async def confirm_import_dives(
    import_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm and save imported dives"""
    try:
        # This is a simplified implementation
        # In reality, you'd retrieve the import session data and create the dives
        
        dive_count = import_data.get('dive_count', 0)
        if dive_count == 0:
            raise_validation_error("No dives to import")
        
        # Create dives
        created_dives = []
        for dive_data in import_data.get('dives', []):
            try:
                # Create dive
                dive = Dive(
                    user_id=current_user.id,
                    dive_site_id=dive_data['dive_site_id'],
                    dive_date=dive_data['dive_date'],
                    dive_time=dive_data.get('dive_time'),
                    depth=dive_data.get('depth'),
                    duration=dive_data.get('duration'),
                    rating=dive_data.get('rating'),
                    visibility=dive_data.get('visibility'),
                    temperature=dive_data.get('temperature'),
                    notes=dive_data.get('notes'),
                    buddy=dive_data.get('buddy'),
                    suit_type=dive_data.get('suit_type'),
                    weight=dive_data.get('weight'),
                    is_private=dive_data.get('is_private', False)
                )
                
                # Generate dive name
                from .dives_crud import generate_dive_name
                from .dives_db_utils import get_dive_site_by_id
                dive_site = get_dive_site_by_id(db, dive.dive_site_id)
                if dive_site:
                    dive.name = generate_dive_name(dive_site.name, dive.dive_date)
                
                db.add(dive)
                db.commit()
                db.refresh(dive)
                
                created_dives.append(dive)
                
            except Exception as e:
                log_error("create_imported_dive", e, current_user.id, dive_data=dive_data)
                continue
        
        log_import_operation("confirm_import", current_user.id, len(created_dives))
        
        return {
            "message": f"Successfully imported {len(created_dives)} dives",
            "imported_count": len(created_dives),
            "dives": created_dives
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("confirm_import_dives", e, current_user.id)
        raise_internal_error("Failed to confirm import")
