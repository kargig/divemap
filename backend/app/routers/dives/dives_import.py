"""
Dives Import.Py operations for dives.

This module contains functions moved from the original dives.py file.
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import re
import tempfile
import uuid
import xml.etree.ElementTree as ET

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias, get_difficulty_value
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error
from .dives_utils import has_deco_profile, generate_dive_name, get_or_create_deco_tag


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
        
        for dive_elem in dive_elements:
            dive_data = parse_dive_element(dive_elem, dive_sites, db)
            if dive_data:
                parsed_dives.append(dive_data)

        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dives found in XML file"
            )

        # Get all available dive sites for selection
        available_dive_sites = db.query(DiveSite).all()
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
            for site in available_dive_sites
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

            # Create dive
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
                difficulty_level=get_difficulty_value(dive_data.get('difficulty_level', 'intermediate')),
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

            # Create the dive
            dive_data_dict = dive_create.model_dump(exclude_unset=True)
            dive_data_dict['dive_date'] = dive_date  # Use parsed date object
            dive_data_dict['dive_time'] = dive_time  # Use parsed time object
            
            dive = Dive(
                user_id=current_user.id,
                **dive_data_dict
            )

            # Generate name if not provided
            if not dive.name:
                if dive.dive_site_id:
                    dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                    if dive_site:
                        # Use date object directly when available
                        if isinstance(dive.dive_date, date):
                            dive_date_obj = dive.dive_date
                        else:
                            dive_date_obj = datetime.strptime(dive.dive_date, '%Y-%m-%d').date()
                        dive.name = generate_dive_name(dive_site.name, dive_date_obj)
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
            if 'profile_data' in dive_data and dive_data['profile_data']:
                try:
                    save_dive_profile_data(dive, dive_data['profile_data'], db)
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


def parse_dive_element(dive_elem, dive_sites, db):
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

        # Convert to Divemap format
        divemap_dive = convert_to_divemap_format(
            dive_number, rating, visibility, sac, otu, cns, tags,
            divesiteid, dive_date, dive_time, duration,
            buddy, suit, cylinders, weights, computer_data,
            dive_sites, db
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

def convert_to_divemap_format(dive_number, rating, visibility, sac, otu, cns, tags,
                             divesiteid, dive_date, dive_time, duration,
                             buddy, suit, cylinders, weights, computer_data,
                             dive_sites, db):
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

    # Build gas bottles information
    gas_bottles_parts = []
    for cylinder in cylinders:
        cylinder_info = []

        # Format: size + workpressure (e.g., "15.0l 232 bar")
        size = cylinder.get('size', '').replace(' l', 'l')  # Remove space before 'l'
        workpressure = cylinder.get('workpressure', '')

        if size and workpressure:
            # Extract numeric value from workpressure (e.g., "232.0 bar" -> "232")
            wp_value = workpressure.replace(' bar', '').strip()
            try:
                wp_float = float(wp_value)
                if wp_float.is_integer():
                    wp_value = str(int(wp_float))
                else:
                    wp_value = str(wp_float)
            except ValueError:
                wp_value = workpressure

            cylinder_info.append(f"{size} {wp_value} bar")
        elif size:
            cylinder_info.append(size)

        # Add O2 percentage
        if cylinder.get('o2'):
            cylinder_info.append(f"O2: {cylinder['o2']}")

        # Add pressure range
        if cylinder.get('start') and cylinder.get('end'):
            start_pressure = cylinder['start'].replace(' bar', '').strip()
            end_pressure = cylinder['end'].replace(' bar', '').strip()
            cylinder_info.append(f"{start_pressure} bar→{end_pressure} bar")

        if cylinder_info:
            gas_bottles_parts.append(" | ".join(cylinder_info))

    gas_bottles_used = "\n".join(gas_bottles_parts) if gas_bottles_parts else None

    # Find dive site
    dive_site_id = None
    unmatched_dive_site = None
    proposed_dive_sites = None
    if divesiteid and divesiteid in dive_sites:
        site_data = dive_sites[divesiteid]
        match_result = find_dive_site_by_import_id(divesiteid, db, site_data['name'])
        if match_result:
            if isinstance(match_result, dict):
                dive_site_id = match_result['id']
                if match_result['match_type'] == 'similarity':
                    proposed_dive_sites = match_result['proposed_sites']
            else:
                # Backward compatibility for old format
                dive_site_id = match_result
        else:
            # Store information about unmatched dive site
            unmatched_dive_site = {
                'import_id': divesiteid,
                'name': site_data['name'],
                'gps': site_data.get('gps')
            }
            print(f"Dive site not found: {site_data['name']} (ID: {divesiteid})")

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
        'difficulty_level': get_difficulty_value('intermediate'),  # Default
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
