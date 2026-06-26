import sqlite3
import gzip
import struct
import json
import logging
import tempfile
import os
from pathlib import Path
from datetime import datetime
from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Tuple

from ..dives_shared import router, get_db, get_current_user, User, Dive
from app.schemas import GarminFITResponse
from app.models import DiveSite, DivingCenter
from .common import find_existing_dive, find_sites_by_coords
from .gas_utils import create_structured_gas_data
from ..dives_utils import find_dive_site_by_import_id

logger = logging.getLogger(__name__)

BLOCK_SIZE = 32
SAMPLE_INTERVAL_SEC = 10

# Bit flags in the per-sample status byte (block[12])
STATUS_GASSWITCH     = 0x01
STATUS_PPO2_EXTERNAL = 0x02
STATUS_SETPOINT_HIGH = 0x04
STATUS_SC            = 0x08
STATUS_OC            = 0x10

_DIVE_MODE_LABELS = [
    "CC / BO",          # 0  M_CC
    "OC Technical",     # 1  M_OC_TEC
    "Gauge",            # 2  M_GAUGE
    "PPO2 Display",     # 3  M_PPO2
    "SC / BO",          # 4  M_SC
    "CC / BO 2",        # 5  M_CC2
    "OC Rec",           # 6  M_OC_REC
    "Freedive",         # 7  M_FREEDIVE
]

def decompress_sw_pnf(blob: bytes) -> Optional[bytes]:
    if len(blob) < 8:
        return None
    try:
        # Strip 4-byte LE size prefix and gunzip
        return gzip.decompress(blob[4:])
    except Exception as e:
        logger.error(f"Failed to decompress Shearwater PNF blob: {e}")
        return None

def parse_pnf_samples(decompressed_data: bytes) -> List[Dict[str, Any]]:
    samples = []
    sample_index = 0
    
    for i in range(0, len(decompressed_data), BLOCK_SIZE):
        block = decompressed_data[i:i+BLOCK_SIZE]
        if len(block) != BLOCK_SIZE:
            break
        tag = block[0]
        if tag == 0x01:
            # Parse scuba sample
            time_sec = sample_index * SAMPLE_INTERVAL_SEC
            depth_be = struct.unpack_from(">H", block, 1)[0]
            first_stop_m = block[4]
            tts = block[6]
            ppo2_cg = block[7]
            o2_pct = block[8]
            he_pct = block[9]
            ndl_or_fs = block[10]
            water_temp = struct.unpack_from("b", block, 14)[0]
            status_byte = block[12]
            cns_cg = block[23]
            
            # Guardrails for raw values
            depth = max(0.0, round(depth_be / 10.0, 2))
            
            # Unplugged or broken temperature probe values on Shearwater/Petrel typically read -128 or 127
            temp = float(water_temp)
            if temp < -5.0 or temp > 50.0:
                temp = 0.0
                
            # Clamp gas fractions
            o2_clamped = max(0.0, min(100.0, float(o2_pct)))
            he_clamped = max(0.0, min(100.0, float(he_pct)))
            
            # Form standard sample structure
            samples.append({
                "time_minutes": round(time_sec / 60.0, 3),
                "depth": depth,
                "temperature": temp,
                "ndl_minutes": float(ndl_or_fs) if first_stop_m == 0 else 0.0,
                "stopdepth": float(first_stop_m) if first_stop_m > 0 else None,
                "in_deco": first_stop_m > 0,
                "tts_minutes": float(tts),
                "cns_percent": max(0.0, min(250.0, round(cns_cg, 1))),
                "fraction_o2": o2_clamped / 100.0,
                "fraction_he": he_clamped / 100.0
            })
            sample_index += 1
            
    return samples

def extract_gf_from_pnf(decompressed_data: bytes) -> Tuple[Optional[int], Optional[int]]:
    if not decompressed_data:
        return None, None
    for i in range(0, len(decompressed_data), BLOCK_SIZE):
        block = decompressed_data[i:i+BLOCK_SIZE]
        if len(block) != BLOCK_SIZE:
            break
        tag = block[0]
        if tag == 0x10:
            gf_min = block[4]
            gf_max = block[5]
            if 0 < gf_min <= 100 and 0 < gf_max <= 100:
                return gf_min, gf_max
    return None, None

def parse_tank_size(size_str: Optional[str]) -> float:
    if not size_str:
        return 12.0
    clean = size_str.upper().strip()
    if not clean:
        return 12.0
    if "AL80" in clean:
        return 11.1
    if clean.startswith("D"):
        try:
            num_part = "".join(c for c in clean[1:] if c.isdigit() or c == ".")
            if num_part:
                return float(num_part) * 2.0
        except Exception:
            pass
    try:
        num_part = ""
        for c in clean:
            if c.isdigit() or c == ".":
                num_part += c
            elif num_part:
                break
        if num_part:
            val = float(num_part)
            return val if val >= 1.0 else 12.0
    except Exception:
        pass
    return 12.0

def parse_shearwater_sqlite(db_path: str, db: Session, all_sites: List = None) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if necessary tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dive_details'")
    if not cursor.fetchone():
        conn.close()
        raise ValueError("Database missing 'dive_details' table")
        
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='log_data'")
    if not cursor.fetchone():
        conn.close()
        raise ValueError("Database missing 'log_data' table")
        
    query = """
        SELECT 
            d.DiveId, d.DiveDate, d.Depth, d.DiveLengthTime, d.Location, d.Site, d.Buddy, d.Notes,
            d.GnssEntryLocation, d.GnssExitLocation, d.TankSize,
            l.data_bytes_1, l.calculated_values_from_samples, l.data_bytes_3
        FROM dive_details AS d
        LEFT JOIN log_data AS l ON d.DiveId = l.log_id
        ORDER BY d.DiveDate ASC
    """
    
    rows = cursor.execute(query).fetchall()
    parsed_dives = []
    
    for row in rows:
        dive_id = row['DiveId']
        dive_date_raw = row['DiveDate']
        max_depth = float(row['Depth']) if row['Depth'] else 0.0
        duration_sec = int(row['DiveLengthTime']) if row['DiveLengthTime'] else 0
        location = row['Location'] or ""
        site = row['Site'] or ""
        buddy = row['Buddy'] or ""
        notes = row['Notes'] or ""
        tank_size_raw = row['TankSize'] or ""
        primary_tank_size = parse_tank_size(tank_size_raw)
        
        # Parse start date & time from raw timestamp/string
        # Shearwater uses formats like "2021-10-10 11:57:21"
        dive_date = ""
        dive_time = ""
        if dive_date_raw:
            try:
                dt = datetime.strptime(dive_date_raw, "%Y-%m-%d %H:%M:%S")
                dive_date = dt.date().isoformat()
                dive_time = dt.strftime("%H:%M:%S")
            except Exception:
                try:
                    dt = datetime.strptime(dive_date_raw, "%Y-%m-%d %H-%M-%S")
                    dive_date = dt.date().isoformat()
                    dive_time = dt.strftime("%H:%M:%S")
                except Exception:
                    pass
                    
        # Fallback to timestamps from metadata in data_bytes_3
        b3_data = {}
        if row['data_bytes_3']:
            try:
                b3_data = json.loads(row['data_bytes_3'].decode('utf-8'))
            except Exception:
                pass
                
        if not dive_date and b3_data.get('StartTime'):
            try:
                dt = datetime.utcfromtimestamp(b3_data['StartTime'])
                dive_date = dt.date().isoformat()
                dive_time = dt.strftime("%H:%M:%S")
            except Exception:
                pass
                
        # Parse calculated summary values (temps, average depth)
        avg_depth = 0.0
        min_temp = None
        max_temp = None
        if row['calculated_values_from_samples']:
            try:
                calc_val = json.loads(row['calculated_values_from_samples'])
                avg_depth = calc_val.get('AverageDepth', 0.0)
                min_temp = calc_val.get('MinTemp')
                max_temp = calc_val.get('MaxTemp')
            except Exception:
                pass
                
        # Parse PNF binary samples
        samples = []
        gf_low, gf_high = None, None
        if row['data_bytes_1']:
            decompressed = decompress_sw_pnf(row['data_bytes_1'])
            if decompressed:
                samples = parse_pnf_samples(decompressed)
                gf_low, gf_high = extract_gf_from_pnf(decompressed)
                
        # Estimate duration, max depth, average depth from samples if missing or zero from summary
        if not duration_sec and samples:
            duration_sec = int(samples[-1]["time_minutes"] * 60)
        if not max_depth and samples:
            max_depth = max(s["depth"] for s in samples)
        if not avg_depth and samples:
            depths = [s["depth"] for s in samples]
            avg_depth = sum(depths) / len(depths) if depths else 0.0

        # Guardrails for metadata values (clamping to fit Pydantic limits safely)
        duration_min = int(duration_sec // 60) if duration_sec else 0
        duration_min = max(1, min(1440, duration_min))
        max_depth = max(0.0, min(1000.0, max_depth))
        avg_depth = max(0.0, min(1000.0, avg_depth))
                
        # Parse Cylinders / GasMixes
        # By default, extract first cylinder O2/He from samples or fallback to 21% air
        o2_percent = 21
        he_percent = 0
        cylinders = []
        
        # Parse cylinders from TankProfileData if available
        # It has a standard layout with GasProfiles and TankData
        # We can reconstruct cylinder sizes and gas compositions from it
        # We parse the first gas mix as primary
        try:
            cursor.execute("SELECT TankProfileData FROM dive_details WHERE DiveId = ?", (dive_id,))
            tprofile = cursor.fetchone()
            if tprofile and tprofile[0]:
                tp_data = json.loads(tprofile[0])
                gas_p = tp_data.get("GasProfiles", [])
                if gas_p:
                    o2_percent = gas_p[0].get("O2Percent", 21)
                    he_percent = gas_p[0].get("HePercent", 0)
                
                # Check for tanks with active transmitters, pressure data, or distinct gases
                tanks = tp_data.get("TankData", [])
                for i, t in enumerate(tanks):
                    g = t.get("GasProfile", {})
                    o2 = g.get("O2Percent", 21)
                    he = g.get("HePercent", 0)
                    start_p = t.get("StartPressurePSI")
                    end_p = t.get("EndPressurePSI")
                    is_on = t.get("DiveTransmitter", {}).get("IsOn") if t.get("DiveTransmitter") else False
                    
                    # Deduplication filter:
                    # Skip if not the first tank, has no pressure, has no transmitter,
                    # and its gas mixture is identical to an already added tank.
                    if i > 0 and not start_p and not end_p and not is_on:
                        is_duplicate = False
                        for existing_cyl in cylinders:
                            if existing_cyl["o2"] == o2 and existing_cyl["he"] == he:
                                is_duplicate = True
                                break
                        if is_duplicate:
                            continue
                            
                    # Convert start/end pressure from PSI to Bar (1 PSI = 0.0689476 Bar)
                    start_bar = None
                    if start_p:
                        try:
                            start_bar = round(float(start_p) * 0.0689476, 1)
                        except Exception:
                            pass
                            
                    end_bar = None
                    if end_p:
                        try:
                            end_bar = round(float(end_p) * 0.0689476, 1)
                        except Exception:
                            pass
                            
                    cylinders.append({
                        "size": primary_tank_size if len(cylinders) == 0 else 12.0,
                        "o2": o2,
                        "he": he,
                        "start": start_bar,
                        "end": end_bar,
                        "index": len(cylinders),
                        "parsed": bool(tank_size_raw) if len(cylinders) == 0 else False
                    })
        except Exception:
            pass
            
        if not cylinders:
            cylinders.append({
                "size": primary_tank_size,
                "o2": o2_percent,
                "he": he_percent,
                "start": None,
                "end": None,
                "index": 0,
                "parsed": bool(tank_size_raw)
            })
            
        # Build gas change events from GasProfiles if available
        events = []
        try:
            if tprofile and tprofile[0]:
                tp_data = json.loads(tprofile[0])
                gas_profiles = tp_data.get("GasProfiles", [])
                for switch in gas_profiles:
                    o2 = switch.get("O2Percent", 21)
                    he = switch.get("HePercent", 0)
                    start_sec = switch.get("StartTimeInSeconds", 0.0)
                    
                    # Find matching cylinder index in cylinders
                    cyl_idx = 0
                    for c in cylinders:
                        if c["o2"] == o2 and c["he"] == he:
                            cyl_idx = c["index"]
                            break
                            
                    events.append({
                        "time_minutes": round(start_sec / 60.0, 3),
                        "type": "gaschange",
                        "name": "gaschange",
                        "cylinder": cyl_idx
                    })
        except Exception:
            pass
            
        gas_bottles_used = create_structured_gas_data(cylinders, events=events)
        
        # Build dive info text description
        info_parts = []
        info_parts.append(f"Source: Shearwater Database")
        if gf_low is not None and gf_high is not None:
            info_parts.append(f"Gradient Factors: {gf_low}/{gf_high}")
        if avg_depth:
            info_parts.append(f"Avg Depth: {round(avg_depth, 2)} m")
        if min_temp:
            info_parts.append(f"Water Temp: {min_temp} C")
        info_parts.append(f"Max Depth: {round(max_depth, 2)} m")
        
        # Resolve GPS coordinates and match dive site
        lat, lng = None, None
        gps_raw = row['GnssEntryLocation'] or row['GnssExitLocation']
        if gps_raw:
            try:
                parts = gps_raw.split(',')
                if len(parts) == 2:
                    lat = float(parts[0].strip())
                    lng = float(parts[1].strip())
            except Exception:
                pass
                
        dive_site_id = None
        unmatched_dive_site = None
        proposed_sites = None
        
        if lat is not None and lng is not None:
            sites = find_sites_by_coords(db, lat, lng)
            if sites:
                best_match = sites[0]
                dive_site_id = best_match.id
                if best_match.distance > 10:
                    proposed_sites = [{"id": s.id, "name": s.name, "distance": s.distance} for s in sites]
            else:
                unmatched_dive_site = {"name": site or "Unknown Site (GPS)", "latitude": lat, "longitude": lng}
        elif site:
            match = find_dive_site_by_import_id(site, db, site, sites=all_sites)
            if match:
                dive_site_id = match['id']
                if match.get('match_type') == 'similarity':
                    proposed_sites = match.get('proposed_sites')
            else:
                unmatched_dive_site = {"name": site}
                
        dive_dict = {
            "dive_site_id": dive_site_id,
            "unmatched_dive_site": unmatched_dive_site,
            "proposed_sites": proposed_sites,
            "latitude": lat,
            "longitude": lng,
            "dive_date": dive_date,
            "dive_time": dive_time,
            "duration": duration_min,
            "max_depth": round(max_depth, 2),
            "average_depth": round(avg_depth, 2),
            "location": location,
            "site": site,
            "notes": notes,
            "o2_percent": o2_percent,
            "he_percent": he_percent,
            "cylinders": cylinders,
            "gas_bottles_used": gas_bottles_used,
            "dive_information": "\n".join(info_parts),
            "profile_data": {
                "samples": samples,
                "events": events,
                "cylinders": cylinders,
                "calculated_max_depth": round(max_depth, 2),
                "calculated_avg_depth": round(avg_depth, 2),
                "calculated_duration_minutes": round(duration_min, 1),
                "sample_count": len(samples),
                "temperature_range": {"min": min_temp, "max": max_temp}
            }
        }
        parsed_dives.append(dive_dict)
        
    conn.close()
    return parsed_dives

@router.post("/import/shearwater-db", response_model=GarminFITResponse)
async def import_shearwater_db(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from a Shearwater Cloud SQLite database file.
    """
    if not file.filename.lower().endswith('.db') and not file.filename.lower().endswith('.sqlite'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a SQLite .db or .sqlite database file"
        )
        
    # Pre-fetch list of user dives for duplicate detection and sites/centers
    user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
    all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()
    all_centers = db.query(DivingCenter).all()
        
    # Save UploadFile to a temporary file
    temp_fd, temp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(temp_fd, 'wb') as tmp:
            tmp.write(await file.read())
            
        # Parse Shearwater DB
        try:
            parsed_dives = parse_shearwater_sqlite(temp_path, db, all_sites)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error parsing Shearwater database: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse Shearwater database: {e}"
            )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    for dive in parsed_dives:
        # Check for duplicates using common utility
        if dive.get("dive_date"):
            existing = find_existing_dive(
                db, current_user.id,
                dive["dive_date"],
                dive.get("dive_time"),
                dive.get("duration"),
                dive.get("max_depth"),
                user_dives=user_dives
            )
            if existing:
                dive["existing_dive_id"] = existing.id
                dive["skip"] = True
                
    # Format and return the standard response
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
        "message": f"Successfully parsed {len(parsed_dives)} dives from Shearwater database",
        "dives": parsed_dives,
        "available_dive_sites": dive_sites_for_selection,
        "available_diving_centers": diving_centers_for_selection
    }
