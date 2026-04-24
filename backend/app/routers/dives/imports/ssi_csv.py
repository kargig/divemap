from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import orjson
import csv
import io
import re

from ..dives_shared import router, get_db, get_current_user, User, Dive, AvailableTag
from app.schemas import CSVHeaderResponse
from app.models import DiveSite, DivingCenter
from .common import (
    find_existing_dive, 
    find_dive_site_by_import_id, 
    resolve_entity
)
from .csv_utils import (
    sanitize_csv_cell, 
    parse_csv_depth, 
    parse_csv_date_time
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
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()

        # 3. Targeted Fuzzy Matching for UNIQUE names (Memory-only against full list)
        site_match_cache = {}
        for site_name in unique_site_names:
            site_match_cache[site_name] = find_dive_site_by_import_id(
                site_name, db, site_name, sites=all_sites
            )

        tag_lookup = {t.name.lower(): t.id for t in all_tags}
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
                val = sanitize_csv_cell(val)
                
                if field == "max_depth":
                    dive_data["max_depth"] = parse_csv_depth(val)
                elif field == "average_depth":
                    dive_data["average_depth"] = parse_csv_depth(val)
                elif field == "duration" and val:
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
                        tag_id = tag_lookup.get(val.lower().strip())
                        if tag_id:
                            auto_tags.append(tag_id)
                        else:
                            unmapped_info.append(f"{csv_col}: {val}")
                elif field == "ignore" or csv_col.lower() == "country":
                    continue
                else:
                    if val and isinstance(val, str) and val.strip():
                        unmapped_info.append(f"{csv_col}: {val}")
            
            if auto_tags:
                dive_data["tags"] = list(set(auto_tags))
                
            if unmapped_info:
                if dive_data["dive_information"]:
                    dive_data["dive_information"] += "\n"
                dive_data["dive_information"] += "Imported Details:\n" + "\n".join(unmapped_info)
            
            dive_data["dive_information"] = dive_data["dive_information"].strip() or None
            
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

        dive_sites_for_selection = [
            {"id": site.id, "name": site.name, "country": site.country, "region": site.region}
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

    except Exception:
        import logging
        logging.exception("Error processing CSV file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing CSV file"
        )
