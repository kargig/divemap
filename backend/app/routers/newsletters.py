from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, desc, asc
from typing import List, Optional
from datetime import datetime, date, time, timedelta
import re
import json
import os
import requests
import math
from app.database import get_db
from app.models import Newsletter, ParsedDiveTrip, DivingCenter, DiveSite, User, TripStatus, ParsedDive, DifficultyLevel, get_difficulty_id_by_code
from app.auth import get_current_user, get_current_user_optional, is_admin_or_moderator
from app.schemas import ParsedDiveTripResponse, NewsletterUploadResponse, NewsletterResponse, NewsletterUpdateRequest, NewsletterDeleteRequest, NewsletterDeleteResponse, ParsedDiveTripCreate, ParsedDiveTripUpdate, ParsedDiveResponse, NewsletterParseTextRequest
import logging
import openai
import quopri
from email import message_from_bytes
from difflib import SequenceMatcher

# Configure logging level for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Also set the root logger level if LOG_LEVEL environment variable is set
log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
numeric_level = getattr(logging, log_level, logging.WARNING)
logging.getLogger().setLevel(numeric_level)

router = APIRouter()

def clean_diving_terminology(dive_site_name: str) -> str:
    """
    Clean common diving terminology from dive site names to improve database matching.
    
    Args:
        dive_site_name: The dive site name that may contain diving terminology
        
    Returns:
        Cleaned dive site name with diving terminology removed
    """
    if not dive_site_name:
        return dive_site_name
    
    # Define diving terminology patterns (case insensitive)
    diving_patterns = [
        # Wreck terminology
        r'\bναυάγιο\b',      # Greek: ναυάγιο
        r'\bΝΑΥΑΓΙΟ\b',      # Greek: ΝΑΥΑΓΙΟ
        r'\bΝαυάγιο\b',      # Greek: Ναυάγιο
        r'\bwreck\b',        # English: wreck
        r'\bWRECK\b',        # English: WRECK
        r'\bWreck\b',        # English: Wreck
        
        # Reef terminology
        r'\bύφαλος\b',       # Greek: ύφαλος
        r'\bΥΦΑΛΟΣ\b',       # Greek: ΥΦΑΛΟΣ
        r'\bΎφαλος\b',       # Greek: Ύφαλος
        r'\breef\b',         # English: reef
        r'\bREEF\b',         # English: REEF
        r'\bReef\b',         # English: Reef
        
        # Cave terminology
        r'\bσπήλαιο\b',      # Greek: σπήλαιο
        r'\bΣΠΗΛΑΙΟ\b',      # Greek: ΣΠΗΛΑΙΟ
        r'\bΣπήλαιο\b',      # Greek: Σπήλαιο
        r'\bcave\b',         # English: cave
        r'\bCAVE\b',         # English: CAVE
        r'\bCave\b',         # English: Cave
        
        # Wall terminology
        r'\bτοίχος\b',       # Greek: τοίχος
        r'\bΤΟΙΧΟΣ\b',       # Greek: ΤΟΙΧΟΣ
        r'\bΤοίχος\b',       # Greek: Τοίχος
        r'\bwall\b',         # English: wall
        r'\bWALL\b',         # English: WALL
        r'\bWall\b',         # English: Wall
        
        # Island terminology
        r'\bνησί\b',         # Greek: νησί
        r'\bΝΗΣΙ\b',         # Greek: ΝΗΣΙ
        r'\bΝησί\b',         # Greek: Νησί
        r'\bisland\b',       # English: island
        r'\bISLAND\b',       # English: ISLAND
        r'\bIsland\b',       # English: Island
        
        # Cape/Point terminology
        r'\bάκρα\b',         # Greek: άκρα
        r'\bΑΚΡΑ\b',         # Greek: ΑΚΡΑ
        r'\bΆκρα\b',         # Greek: Άκρα
        r'\bcape\b',         # English: cape
        r'\bCAPE\b',         # English: CAPE
        r'\bCape\b',         # English: Cape
        r'\bpoint\b',        # English: point
        r'\bPOINT\b',        # English: POINT
        r'\bPoint\b',        # English: Point
    ]
    
    cleaned_name = dive_site_name
    
    # Remove each diving pattern
    for pattern in diving_patterns:
        cleaned_name = re.sub(pattern, '', cleaned_name, flags=re.IGNORECASE)
    
    # Clean up extra whitespace and trim
    cleaned_name = re.sub(r'\s+', ' ', cleaned_name).strip()
    
    logger.info(f"🧹 Cleaned dive site name: '{dive_site_name}' -> '{cleaned_name}'")
    
    return cleaned_name

def search_dive_trips_with_fuzzy(query: str, exact_results: List[ParsedDiveTrip], db: Session, similarity_threshold: float = 0.2, max_fuzzy_results: int = 10):
    """
    Enhance search results with fuzzy matching when exact results are insufficient.
    
    Args:
        query: The search query string
        exact_results: List of dive trips from exact search
        db: Database session
        similarity_threshold: Minimum similarity score (0.0 to 1.0)
        max_fuzzy_results: Maximum number of fuzzy results to return
    
    Returns:
        List of dive trips with exact results first, followed by fuzzy matches
    """
    # If we have enough exact results, return them with match type info
    if len(exact_results) >= 10:
        # Convert exact results to the expected format
        final_results = []
        for trip in exact_results:
            final_results.append({
                'trip': trip,
                'match_type': 'exact',
                'score': 1.0,
                'trip_description_contains': query.lower() in (trip.trip_description or '').lower(),
                'special_requirements_contains': trip.special_requirements and query.lower() in trip.special_requirements.lower(),
                'diving_center_name_contains': trip.diving_center and query.lower() in trip.diving_center.name.lower(),
                'dive_site_name_contains': any(query.lower() in dive.dive_site.name.lower() for dive in trip.dives if dive.dive_site) if trip.dives else False
            })
        return final_results
    
    # Get all dive trips for fuzzy matching (with related data)
    all_trips = db.query(ParsedDiveTrip).options(
        joinedload(ParsedDiveTrip.diving_center),
        joinedload(ParsedDiveTrip.dives).joinedload(ParsedDive.dive_site)
    ).all()
    
    # Create a set of exact result IDs to avoid duplicates
    exact_ids = {trip.id for trip in exact_results}
    
    # Perform fuzzy matching on all dive trips (case-insensitive)
    fuzzy_matches = []
    query_lower = query.lower()  # Convert query to lowercase for case-insensitive comparison
    
    for trip in all_trips:
        # Skip if already in exact results
        if trip.id in exact_ids:
            continue
            
        # Calculate similarity scores for different fields
        trip_description_similarity = SequenceMatcher(None, query_lower, (trip.trip_description or '').lower()).ratio()
        special_requirements_similarity = SequenceMatcher(None, query_lower, (trip.special_requirements or '').lower()).ratio()
        diving_center_name_similarity = SequenceMatcher(None, query_lower, trip.diving_center.name.lower()).ratio() if trip.diving_center else 0
        
        # Calculate dive site name similarities
        dive_site_similarities = []
        if trip.dives:
            for dive in trip.dives:
                if dive.dive_site:
                    dive_site_similarities.append(SequenceMatcher(None, query_lower, dive.dive_site.name.lower()).ratio())
        
        # Use the best dive site similarity score
        best_dive_site_similarity = max(dive_site_similarities) if dive_site_similarities else 0
        
        # Check for partial matches (substring matches)
        trip_description_contains = query_lower in (trip.trip_description or '').lower()
        special_requirements_contains = trip.special_requirements and query_lower in trip.special_requirements.lower()
        diving_center_name_contains = trip.diving_center and query_lower in trip.diving_center.name.lower()
        dive_site_name_contains = any(query_lower in dive.dive_site.name.lower() for dive in trip.dives if dive.dive_site) if trip.dives else False
        
        # Calculate weighted similarity score
        # Give higher weight to trip description, then dive site names, then diving center name
        weighted_score = (
            trip_description_similarity * 0.4 +
            best_dive_site_similarity * 0.4 +
            diving_center_name_similarity * 0.2
        )
        
        # Boost score for partial matches
        if trip_description_contains:
            weighted_score += 0.3
        if dive_site_name_contains:
            weighted_score += 0.3
        if diving_center_name_contains:
            weighted_score += 0.2
        if special_requirements_contains:
            weighted_score += 0.1
        
        # Include if similarity above threshold
        if weighted_score > similarity_threshold:
            # Determine match type
            if weighted_score >= 0.8:
                match_type = 'close'
            elif weighted_score >= 0.6:
                match_type = 'partial'
            else:
                match_type = 'fuzzy'
            
            fuzzy_matches.append({
                'trip': trip,
                'match_type': match_type,
                'score': weighted_score,
                'trip_description_contains': trip_description_contains,
                'special_requirements_contains': special_requirements_contains,
                'diving_center_name_contains': diving_center_name_contains,
                'dive_site_name_contains': dive_site_name_contains
            })
    
    # Sort by score (highest first)
    fuzzy_matches.sort(key=lambda x: x['score'], reverse=True)
    
    # Limit results
    fuzzy_matches = fuzzy_matches[:max_fuzzy_results]
    
    # Combine exact and fuzzy results
    final_results = []
    
    # Add exact results first
    for trip in exact_results:
        final_results.append({
            'trip': trip,
            'match_type': 'exact',
            'score': 1.0,
            'trip_description_contains': query.lower() in (trip.trip_description or '').lower(),
            'special_requirements_contains': trip.special_requirements and query.lower() in trip.special_requirements.lower(),
            'diving_center_name_contains': trip.diving_center and query.lower() in trip.diving_center.name.lower(),
            'dive_site_name_contains': any(query.lower() in dive.dive_site.name.lower() for dive in trip.dives if dive.dive_site) if trip.dives else False
        })
    
    # Add fuzzy results
    final_results.extend(fuzzy_matches)
    
    return final_results

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points using the Haversine formula.
    Returns distance in kilometers.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r

def similarity_ratio(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def parse_greek_date(day: str, month: str, year: str = None) -> date:
    """Parse Greek date format to Python date object"""
    month_map = {
        'Ιανουαρίου': 1, 'Φεβρουαρίου': 2, 'Μαρτίου': 3, 'Απριλίου': 4,
        'Μαΐου': 5, 'Ιουνίου': 6, 'Ιουλίου': 7, 'Αυγούστου': 8,
        'Σεπτεμβρίου': 9, 'Οκτωβρίου': 10, 'Νοεμβρίου': 11, 'Δεκεμβρίου': 12
    }

    month_num = month_map.get(month)
    if not month_num:
        return date.today()

    day_num = int(day)
    year_num = int(year) if year else date.today().year

    return date(year_num, month_num, day_num)

def find_matching_dive_site(db: Session, site_name: str) -> Optional[int]:
    """Find matching dive site in database by name similarity"""
    if not site_name:
        return None

    # Clean the site name
    site_name = site_name.strip()
    logger.info(f"🔍 Looking for dive site match for: '{site_name}'")

    # First try exact match (case insensitive) on dive site names
    exact_match = db.query(DiveSite).filter(
        DiveSite.name.ilike(site_name)
    ).first()
    if exact_match:
        logger.info(f"✅ Exact match found on dive site name: '{site_name}' -> ID: {exact_match.id}")
        return exact_match.id

    # Try exact match on aliases
    from app.models import DiveSiteAlias
    alias_match = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.alias.ilike(site_name)
    ).first()
    if alias_match:
        logger.info(f"✅ Exact match found on alias: '{site_name}' -> Dive Site ID: {alias_match.dive_site_id}")
        return alias_match.dive_site_id

    # Try partial matches on dive site names
    partial_matches = db.query(DiveSite).filter(
        DiveSite.name.ilike(f"%{site_name}%")
    ).all()

    if partial_matches:
        # Return the first match (most likely)
        logger.info(f"✅ Partial match found on dive site name: '{site_name}' -> ID: {partial_matches[0].id}")
        return partial_matches[0].id

    # Try partial matches on aliases
    alias_partial_matches = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.alias.ilike(f"%{site_name}%")
    ).all()

    if alias_partial_matches:
        # Return the first match (most likely)
        logger.info(f"✅ Partial match found on alias: '{site_name}' -> Dive Site ID: {alias_partial_matches[0].dive_site_id}")
        return alias_partial_matches[0].dive_site_id

    # Try reverse partial match (site_name contains dive site name)
    for dive_site in db.query(DiveSite).all():
        if dive_site.name.lower() in site_name.lower():
            logger.info(f"✅ Reverse partial match found: '{site_name}' contains '{dive_site.name}' -> ID: {dive_site.id}")
            return dive_site.id

    # Try reverse partial match on aliases
    for alias in db.query(DiveSiteAlias).all():
        if alias.alias.lower() in site_name.lower():
            logger.info(f"✅ Reverse partial match found on alias: '{site_name}' contains '{alias.alias}' -> Dive Site ID: {alias.dive_site_id}")
            return alias.dive_site_id

    # Try similarity matching with threshold on dive site names
    best_match = None
    best_ratio = 0.0
    threshold = 0.6  # Minimum similarity threshold

    for dive_site in db.query(DiveSite).all():
        ratio = similarity_ratio(site_name, dive_site.name)
        if ratio > best_ratio and ratio >= threshold:
            best_ratio = ratio
            best_match = dive_site

    # Try similarity matching on aliases
    for alias in db.query(DiveSiteAlias).all():
        ratio = similarity_ratio(site_name, alias.alias)
        if ratio > best_ratio and ratio >= threshold:
            best_ratio = ratio
            best_match = alias.dive_site_id
            logger.info(f"✅ Similarity match found on alias: '{site_name}' ~ '{alias.alias}' (ratio: {ratio:.2f}) -> Dive Site ID: {best_match}")
            return best_match

    if best_match:
        if hasattr(best_match, 'id'):
            logger.info(f"✅ Similarity match found on dive site name: '{site_name}' ~ '{best_match.name}' (ratio: {best_ratio:.2f}) -> ID: {best_match.id}")
            return best_match.id
        else:
            logger.info(f"✅ Similarity match found via alias: '{site_name}' -> dive site ID {best_match} (ratio: {best_ratio:.2f})")
            return best_match

    logger.info(f"❌ No match found for dive site: '{site_name}'")
    return None

def extract_diving_center_from_headers(raw_email: str) -> Optional[str]:
    """Extract diving center name from email headers"""
    try:
        # Parse email headers
        email_message = message_from_bytes(raw_email.encode('utf-8'))

        # Check From header
        from_header = email_message.get('From', '')
        if from_header:
            # Extract name from "Name <email>" format
            if '<' in from_header:
                name_part = from_header.split('<')[0].strip()
                if name_part:
                    return name_part

        # Check Reply-To header
        reply_to = email_message.get('Reply-To', '')
        if reply_to:
            if '<' in reply_to:
                name_part = reply_to.split('<')[0].strip()
                if name_part:
                    return name_part

        # Check Subject for diving center name patterns
        subject = email_message.get('Subject', '')
        if subject:
            # Look for common diving center patterns
            patterns = [
                r'from\s+([A-Za-z\s]+)\s+Dive',
                r'([A-Za-z\s]+)\s+Dive\s+Adventures',
                r'([A-Za-z\s]+)\s+Diving\s+Center',
                r'([A-Za-z\s]+)\s+Dive\s+Club'
            ]
            for pattern in patterns:
                match = re.search(pattern, subject, re.IGNORECASE)
                if match:
                    return match.group(1).strip()

        return None
    except Exception as e:
        logger.error(f"Error extracting diving center from headers: {e}")
        return None

def extract_diving_center_from_metadata(content: str) -> Optional[int]:
    """
    Extract diving center ID from newsletter metadata embedded in content.
    Looks for format: <!-- DIVEMAP_METADATA: diving_center_id=123 -->
    """
    try:
        import re
        pattern = r'<!--\s*DIVEMAP_METADATA:\s*diving_center_id=(\d+)\s*-->'
        match = re.search(pattern, content)
        if match:
            return int(match.group(1))
    except Exception as e:
        logger.warning(f"Error extracting diving center from metadata: {e}")
    return None

def remove_metadata_from_content(content: str) -> str:
    """
    Remove metadata markers from newsletter content before parsing.
    This ensures the metadata doesn't interfere with parsing logic.
    """
    try:
        import re
        # Remove metadata markers
        content = re.sub(r'<!--\s*DIVEMAP_METADATA:.*?-->\s*', '', content, flags=re.DOTALL)
        # Remove any leading/trailing whitespace
        return content.strip()
    except Exception as e:
        logger.warning(f"Error removing metadata from content: {e}")
        return content

def add_diving_center_metadata(content: str, diving_center_id: Optional[int]) -> str:
    """
    Add diving center metadata to newsletter content.
    Prepends metadata in a format that can be extracted later but won't interfere with parsing.
    """
    if diving_center_id is None:
        return content
    
    metadata = f"<!-- DIVEMAP_METADATA: diving_center_id={diving_center_id} -->\n"
    # Check if metadata already exists
    if extract_diving_center_from_metadata(content) is not None:
        # Replace existing metadata
        import re
        content = re.sub(r'<!--\s*DIVEMAP_METADATA:.*?-->\s*', metadata, content, flags=re.DOTALL)
        return content
    else:
        # Add new metadata at the beginning
        return metadata + content

def find_matching_diving_center(db: Session, center_name: str) -> Optional[int]:
    """Find matching diving center in database by name similarity"""
    if not center_name:
        return None

    # Clean the center name
    center_name = center_name.strip()

    # First try exact match
    exact_match = db.query(DivingCenter).filter(
        DivingCenter.name.ilike(center_name)
    ).first()
    if exact_match:
        return exact_match.id

    # Try partial matches
    partial_matches = db.query(DivingCenter).filter(
        DivingCenter.name.ilike(f"%{center_name}%")
    ).all()

    if partial_matches:
        # Return the first match (most likely)
        return partial_matches[0].id

    # Try reverse partial match (center_name contains diving center name)
    for diving_center in db.query(DivingCenter).all():
        if diving_center.name.lower() in center_name.lower():
            return diving_center.id

    return None

def parse_newsletter_with_openai(content: str, db: Session, diving_center_id_override: Optional[int] = None) -> List[dict]:
    """Parse newsletter content using OpenAI API"""
    try:
        # Extract diving center from metadata if not provided as override
        extracted_diving_center_id = extract_diving_center_from_metadata(content) if diving_center_id_override is None else None
        diving_center_id_from_metadata = diving_center_id_override or extracted_diving_center_id
        
        # Remove metadata from content before parsing
        content_without_metadata = remove_metadata_from_content(content)
        
        # Check if content is already decoded text or needs email parsing
        clean_content = content_without_metadata
        
        # If content contains email headers, try to extract the text content
        if content_without_metadata.startswith('Delivered-To:') or 'From:' in content_without_metadata or 'Subject:' in content_without_metadata:
            try:
                # Try to parse as email
                email_message = message_from_bytes(content_without_metadata.encode('utf-8'))
                subject = email_message.get('Subject', '')
                
                # Get the text content
                if email_message.is_multipart():
                    for part in email_message.walk():
                        if part.get_content_type() == "text/plain":
                            payload = part.get_payload(decode=True)
                            if payload:
                                clean_content = payload.decode('utf-8', errors='ignore')
                                break
                else:
                    payload = email_message.get_payload(decode=True)
                    if payload:
                        clean_content = payload.decode('utf-8', errors='ignore')
                
                # Decode quoted-printable if necessary
                if '=3D' in clean_content or '=20' in clean_content:
                    try:
                        clean_content = quopri.decodestring(clean_content).decode('utf-8', errors='ignore')
                    except:
                        pass
            except Exception as e:
                logger.warning(f"Failed to parse as email, treating as plain text: {e}")
                subject = ""
                clean_content = content_without_metadata
        else:
            # Content is already plain text
            subject = ""
            clean_content = content

        # Extract diving center from headers if available
        diving_center_name = extract_diving_center_from_headers(content)
        diving_center_id = None
        if diving_center_name:
            diving_center_id = find_matching_diving_center(db, diving_center_name)
            logger.info(f"Extracted diving center: {diving_center_name} -> ID: {diving_center_id}")

        # Prepare prompt for OpenAI
        prompt = f"""
Parse the following newsletter content and extract dive trip information. Return a JSON array of dive trips.

⚠️ CRITICAL: This newsletter is probably in Greek. You MUST parse Greek date formats correctly!
⚠️ NEVER default to today's date when a Greek date is clearly specified in the text!

⚠️ IMPORTANT: Handle "Διπλή βουτιά" (double dive) scenarios correctly:
⚠️ - "διπλή βουτιά στην Μακρόνησο" = 2 dives at same location (Makronisos)
⚠️ - "διπλή βουτιά στον Ποθητό και στο Ποντικονήσι" = 2 dives at different locations
⚠️ - "βουτιά στον Ποθητό και στο Ποντικονήσι" = 2 dives at different locations (TWO distinct dive site names)
⚠️ - DEFAULT TO 1 DIVE unless "διπλή βουτιά" is mentioned OR two DISTINCT dive site names are specified
⚠️ - "στον Πατροκλο" after a dive site name means "near Patroklos" - it's a location descriptor, NOT a separate dive site

Newsletter Subject: {subject}
Diving Center: {diving_center_name if diving_center_name else 'Unknown'}

Content:
{clean_content}

Extract the following information for each dive trip and return EXACTLY in this JSON format:

[
  {{
    "trip_date": "YYYY-MM-DD",
    "trip_time": "HH:MM",
    "trip_duration": null,
    "trip_description": "Description of the dive trip",
    "trip_price": null,
    "trip_currency": "EUR",
    "group_size_limit": null,
    "special_requirements": "Any special requirements",
    "dives": [
      {{
        "dive_number": 1,
        "dive_site_name": "Name of dive site",
        "dive_time": "HH:MM",
        "dive_duration": null,
        "dive_description": "Description of this specific dive"
      }},
      {{
        "dive_number": 2,
        "dive_site_name": "Name of second dive site",
        "dive_time": "HH:MM",
        "dive_duration": null,
        "dive_description": "Description of second dive"
      }}
    ]
  }}
]

CRITICAL RULES:
- ONLY extract information that is EXPLICITLY mentioned in the newsletter content
- DO NOT invent, guess, or hallucinate any information
- If a field is not mentioned in the text, set it to null
- If no price is mentioned, set trip_price to null
- If no time is mentioned, set trip_time to null
- If no duration is mentioned, set trip_duration to null
- If no group size limit is mentioned, set group_size_limit to null
- If no special requirements are mentioned, set special_requirements to null

DATE EXTRACTION RULES - THIS IS THE MOST IMPORTANT PART:
- You MUST parse Greek date formats correctly. This is critical!
- Look for these exact patterns in the text:
  * "Σάββατο 2 Αυγούστου" = "2025-08-02" (Saturday August 2nd)
  * "Κυριακή 3 Αυγούστου" = "2025-08-03" (Sunday August 3rd)
  * "Σάββατο 23 Αυγούστου" = "2025-08-23" (Saturday August 23rd)
  * "Κυριακή 24 Αυγούστου" = "2025-08-24" (Sunday August 24th)
  * "Δευτέρα 25 Αυγούστου" = "2025-08-25" (Monday August 25th)
  * "Τρίτη 26 Αυγούστου" = "2025-08-26" (Tuesday August 26th)
  * "Τετάρτη 27 Αυγούστου" = "2025-08-27" (Wednesday August 27th)
  * "Πέμπτη 28 Αυγούστου" = "2025-08-28" (Thursday August 28th)
  * "Παρασκευή 29 Αυγούστου" = "2025-08-29" (Friday August 29th)
- Greek month names: Ιανουαρίου(January), Φεβρουαρίου(February), Μαρτίου(March), Απριλίου(April), Μαΐου(May), Ιουνίου(June), Ιουλίου(July), Αυγούστου(August), Σεπτεμβρίου(September), Οκτωβρίου(October), Νοεμβρίου(November), Δεκεμβρίου(December)
- Greek day names: Δευτέρα(Monday), Τρίτη(Tuesday), Τετάρτη(Wednesday), Πέμπτη(Thursday), Παρασκευή(Friday), Σάββατο(Saturday), Κυριακή(Sunday)
- If the content mentions "today", use today's date: {date.today().strftime('%Y-%m-%d')}
- If the content mentions "tomorrow", use tomorrow's date: {(date.today() + timedelta(days=1)).strftime('%Y-%m-%d')}
- If the content mentions "next week", add 7 days to today's date
- NEVER use placeholder dates like "YYYY-MM-DD"
- NEVER default to today's date unless explicitly mentioned
- ALWAYS parse the actual Greek date format when present in the text
- If you see "Σάββατο 2 Αυγούστου" in the text, the trip_date MUST be "2025-08-02"
- If you see "Κυριακή 3 Αυγούστου" in the text, the trip_date MUST be "2025-08-03"
- If you see "Σάββατο 23 Αυγούστου" in the text, the trip_date MUST be "2025-08-23"
- If you see "Κυριακή 24 Αυγούστου" in the text, the trip_date MUST be "2025-08-24"

TRIP STRUCTURE RULES:
- A single dive trip can have 1 or 2 dives
- IMPORTANT: When you see "Διπλή βουτιά" or "double dive" in the text, this means there are exactly 2 dives that day
- If "Διπλή βουτιά" is mentioned but only ONE dive site is specified, both dives happen at the same location
- If "Διπλή βουτιά" is mentioned and TWO different dive sites are specified, each dive happens at a different location
- CRITICAL: When you see different dates mentioned (e.g., "Σάββατο 23 Αυγούστου" and "Κυριακή 24 Αυγούστου"), create SEPARATE trip objects for each date
- CRITICAL: Each date section has its own unique dive sites! NEVER copy dive sites from one date to another!
- CRITICAL: Look for dive sites that are mentioned NEAR each specific date, not globally in the newsletter
- Examples:
  * "διπλή βουτιά στην Μακρόνησο" = 2 dives at Makronisos (same location)
  * "διπλή βουτιά στον Ποθητό και στο Ποντικονήσι" = 2 dives at different locations (Pothitos, then Pontikonisi)
  * "βουτιά στον Ποθητό και στο Ποντικονήσι" = 2 dives at different locations (Pothitos, then Pontikonisi)
- If the text mentions "Δεύτερη βουτιά" (second dive) or similar, create 2 dives in the same trip
- If the text mentions different dates/times for different trips, create separate trip objects
- Each dive within a trip should have a dive_number (1 for first dive, 2 for second dive)
- Each dive can have its own dive site, time, duration, and description

CRITICAL: SINGLE DIVE vs DOUBLE DIVE DETECTION:
- DEFAULT TO 1 DIVE unless explicitly indicated otherwise
- Only create 2 dives when:
  * "Διπλή βουτιά" (double dive) is explicitly mentioned
  * "βουτιά στον X και στον Y" (dive at X and at Y) - where X and Y are clearly TWO SEPARATE dive site names
  * "Δεύτερη βουτιά" (second dive) is mentioned
  * Two distinct dive sites with different times are mentioned (e.g., "9:00 at Site A, 12:00 at Site B")
- DO NOT create 2 dives when:
  * Location descriptors are mentioned (e.g., "στον Πατροκλο" means "near Patroklos" - NOT a separate dive site)
  * A single dive site with descriptive text (e.g., "ναυάγιο Πατρις στον Πατροκλο" = Patris wreck near Patroklos = 1 dive site)
  * Geographic references like "near", "in the area of", "στον" (meaning "at/near" when describing a location)
  * Technical details or depth information are mentioned (these don't indicate multiple dives)

CONCRETE EXAMPLES - FOLLOW THESE EXACTLY:
1. "ΚΥΡ, 17 Αυγ στις 9:00" with "9:00 Άκρα Καταφυγή" and "12:00 ν. Κουδούνια, ύφαλος"
   → Create 1 trip with 2 dives: trip_date = "2025-08-17", trip_time = "09:00"
   → Dive 1: dive_site_name = "Άκρα Καταφυγή", dive_time = "09:00"
   → Dive 2: dive_site_name = "ν. Κουδούνια, ύφαλος", dive_time = "12:00"

2. "Tο Σάββατο με ραντεβού στις 0930 πάμε για διπλή βουτιά στην Μακρόνησο."
   → Create 1 trip with 2 dives, both at "Μακρόνησο", trip_time = "09:30"

3. "Tην Κυριακή με ραντεβού στις 0930 πάμε για διπλή βουτιά στον Ποθητό και στο Ποντικονήσι."
   → Create 1 trip with 2 dives: dive 1 at "Ποθητό", dive 2 at "Ποντικονήσι", trip_time = "09:30"

4. "Tην Δευτέρα με ραντεβού στις 1030 πάμε για βουτιά στον Ποθητό και στο Ποντικονήσι."
   → Create 1 trip with 2 dives: dive 1 at "Ποθητό", dive 2 at "Ποντικονήσι", trip_time = "10:30"

5. "Tην Τρίτη με ραντεβού στις 1130 πάμε για βουτιά στον Ποθητό και στις 13:30 στο Ποντικονήσι."
   → Create 1 trip with 2 dives: dive 1 at "Ποθητό" (dive_time = "11:30"), dive 2 at "Ποντικονήσι" (dive_time = "13:30")

6. Newsletter with multiple dates (like newsletter 104):
   Content mentions "Σάββατο 23 Αυγούστου" and "Κυριακή 24 Αυγούστου"
   → Create 2 separate trips:
   → Trip 1: trip_date = "2025-08-23" (Saturday August 23rd) with 2 dives
   → Trip 2: trip_date = "2025-08-24" (Sunday August 24th) with 2 dives
   
   CRITICAL: Each date has DIFFERENT dive sites! Do NOT copy the same dive sites to both dates!
   - August 23rd: Look for dive sites mentioned near "Σάββατο 23 Αυγούστου"
   - August 24th: Look for dive sites mentioned near "Κυριακή 24 Αυγούστου"
   - Each date section will have its own unique dive sites and times

7. Wreck diving examples:
   - "Ναυάγιο ORIA" and "Ναυάγιο ΚΥΡΑ ΛΕΝΗ" mentioned in the same trip description
     → Extract as 2 dives: dive 1 at "Ναυάγιο ORIA", dive 2 at "Ναυάγιο ΚΥΡΑ ΛΕΝΗ"
   - "Τεχνική κατάδυση στο βαθύ ναυάγιο Πατρις στον Πατροκλο"
     → Extract as 1 dive ONLY: dive_site_name = "ναυάγιο Πατρις"
     → "στον Πατροκλο" means "near Patroklos" - it's a location descriptor, NOT a separate dive site

8. Newsletter specific example:
   Content structure:
   ```
   Σάββατο 23 Αυγούστου
   9:00 ν. Ποθητός
   12:00 Άκρα Καταφυγή
   
   Κυριακή 24 Αυγούστου  
   9:00 Ναυάγιο ORIA
   12:00 Ναυάγιο ΚΥΡΑ ΛΕΝΗ
   ```
   → Create 2 separate trips:
   → Trip 1 (Aug 23): dive 1 at "ν. Ποθητός" (9:00), dive 2 at "Άκρα Καταφυγή" (12:00)
   → Trip 2 (Aug 24): dive 1 at "Ναυάγιο ORIA" (9:00), dive 2 at "Ναυάγιο ΚΥΡΑ ΛΕΝΗ" (12:00)
   
   CRITICAL: Each date has COMPLETELY DIFFERENT dive sites! Never copy dive sites between dates!

DIVE SITE EXTRACTION RULES:
- ALWAYS extract dive site names from the content when mentioned
- Look for dive site names in the text and extract them for dive_site_name
- CRITICAL: Extract dive sites in CONTEXT with their specific dates!
- When you see "Σάββατο 23 Αυγούστου", only look for dive sites mentioned near that date
- When you see "Κυριακή 24 Αυγούστου", only look for dive sites mentioned near that date
- Do NOT extract dive sites globally from the entire newsletter
- IMPORTANT: Recognize various diving terminology:
  * Wreck terminology: "Ναυάγιο ORIA" = Oria wreck, "Ναυάγιο ΚΥΡΑ ΛΕΝΗ" = Kyra Leni wreck
  * Reef terminology: "ν. Κουδούνια, ύφαλος" = Koudounia reef, "ύφαλος" = reef
  * Cave terminology: "σπήλαιο" = cave
  * Wall terminology: "τοίχος" = wall
  * Island terminology: "νησί" = island
  * Cape/Point terminology: "άκρα" = cape/point
- Common Greek dive sites include: Άκρα Καταφυγή (Akra Katafygi), ν. Κουδούνια (Koudounia), Kyra Leni, Arzentá, Pothitos, Makronisos, Koundouros, Patris, Avantis, Petrokaravo, etc.
- If a dive site is mentioned in the text, extract it as dive_site_name
- If no specific dive site is mentioned for a dive, set dive_site_name to null
- Pay attention to both English and Greek names for dive sites
- Pay special attention to sites with diving terminology as they are popular diving destinations
- The system will automatically clean terminology before database searching

ADDITIONAL INFORMATION EXTRACTION:
- Extract "Διάρκεια: ~5 ώρες" as trip_duration (convert to minutes: 300)
- Extract "Διαθεσιμότητα: 3 θέσεις" as group_size_limit (3)
- Extract "Ελάχ. Πιστοποίηση OWD" as special_requirements
- Extract "Check-in: 8:00" as additional information in trip_description
- Extract "Περιλαμβάνει: Φιάλη 12/15L με Αέρα, βάρη" as included items in trip_description
- Extract "Με χρέωση: EAN32, εκμίσθωση εξοπλισμού" as extra charges in trip_description

DIVING TERMINOLOGY RECOGNITION:
- IMPORTANT: Recognize various diving terminology for proper dive site matching
- Wreck terminology: "Ναυάγιο ORIA" = Oria wreck, "Ναυάγιο ΚΥΡΑ ΛΕΝΗ" = Kyra Leni wreck
- Reef terminology: "ν. Κουδούνια, ύφαλος" = Koudounia reef, "ύφαλος" = reef
- Cave terminology: "σπήλαιο" = cave
- Wall terminology: "τοίχος" = wall
- Island terminology: "νησί" = island
- Cape/Point terminology: "άκρα" = cape/point
- Always extract the full name including terminology prefixes for proper matching
- The system will automatically clean these terms before database searching

Field descriptions:
- trip_date: Date of the dive trip (YYYY-MM-DD format, required - use today's date if not specified)
- trip_time: Time of departure (HH:MM format, optional - can be null if not mentioned)
- trip_duration: Total duration in minutes (optional - can be null if not mentioned)
- trip_description: Description of the entire dive trip (required)
- trip_price: Price in euros (optional - can be null if not mentioned)
- trip_currency: Currency code (default: EUR)
- group_size_limit: Maximum number of participants (optional - can be null if not mentioned)
- special_requirements: Any special requirements (optional - can be null if not mentioned)
- dives: Array of dives in this trip
  - dive_number: Number of the dive (1 for first, 2 for second)
  - dive_site_name: Extract the specific dive site name mentioned for this dive. Look for names like "Άκρα Καταφυγή", "ν. Κουδούνια", "Ναυάγιο ORIA", "Ναυάγιο ΚΥΡΑ ΛΕΝΗ", "Kyra Leni", "Arzentá", "Pothitos", "Makronisos", "Koundouros", "Patris", "Avantis", "Petrokaravo", etc. (required if mentioned in text)
  - dive_time: Time for this specific dive (HH:MM format, optional - can be null if not mentioned)
  - dive_duration: Duration for this specific dive in minutes (optional - can be null if not mentioned)
  - dive_description: Description for this specific dive (optional - can be null if not mentioned)

IMPORTANT: For dive_site_name, extract the specific dive site name from the trip description. Common Greek dive sites mentioned include: Άκρα Καταφυγή (Akra Katafygi), ν. Κουδούνια (Koudounia), Ναυάγιο ORIA (Oria wreck), Ναυάγιο ΚΥΡΑ ΛΕΝΗ (Kyra Leni wreck), Kyra Leni, Arzentá, Pothitos, Makronisos, Koundouros, Patris, Avantis, Petrokaravo.

Return ONLY the JSON array, no markdown formatting, no explanations.
"""

        # Call OpenAI API
        openai.api_key = os.getenv("OPENAI_API_KEY")
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts dive trip information from newsletters. Always return valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        if response:
            content = response.choices[0].message.content

            # Log the OpenAI response for debugging
            logger.info(f"OpenAI response: {content}")

            # Try to parse the JSON response
            try:
                # Remove markdown code blocks if present
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                elif content.startswith('```'):
                    content = content.replace('```', '').strip()

                trips = json.loads(content)
                if isinstance(trips, list):
                    # Add diving center ID to each trip if found
                    for trip in trips:
                        if diving_center_id:
                            trip['diving_center_id'] = diving_center_id
                            trip['diving_center_name'] = diving_center_name

                        # Try to match dive site if name is provided
                        if trip.get('dives'):
                            for dive in trip['dives']:
                                if dive.get('dive_site_name'):
                                    original_name = dive['dive_site_name']
                                    cleaned_name = clean_diving_terminology(original_name)
                                    logger.info(f"🔍 Attempting to match dive site: '{original_name}' (cleaned to: '{cleaned_name}')")
                                    
                                    # Try with cleaned name first
                                    dive_site_id = find_matching_dive_site(db, cleaned_name)
                                    if dive_site_id:
                                        dive['dive_site_id'] = dive_site_id
                                        logger.info(f"✅ Matched dive site: '{cleaned_name}' -> ID: {dive_site_id}")
                                    else:
                                        # Fallback to original name if cleaning didn't help
                                        dive_site_id = find_matching_dive_site(db, original_name)
                                        if dive_site_id:
                                            dive['dive_site_id'] = dive_site_id
                                            logger.info(f"✅ Matched dive site with original name: '{original_name}' -> ID: {dive_site_id}")
                                        else:
                                            logger.info(f"❌ No dive site match found for: '{original_name}' (cleaned: '{cleaned_name}')")
                                else:
                                    logger.info(f"⚠️ No dive_site_name found in dive")

                    logger.info(f"Successfully parsed {len(trips)} trips from OpenAI")
                    return trips
                else:
                    logger.error(f"OpenAI returned invalid format (not a list): {type(trips)}")
                    return parse_newsletter_content(clean_content, db)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OpenAI response as JSON: {e}")
                logger.error(f"Raw OpenAI response: {content}")
                return parse_newsletter_content(clean_content, db)
        else:
            logger.error(f"OpenAI API error: {response}")
            return parse_newsletter_content(clean_content, db)

    except Exception as e:
        logger.error(f"Error in OpenAI parsing: {e}")
        return parse_newsletter_content(clean_content, db)

def parse_newsletter_content(content: str, db: Session, diving_center_id_override: Optional[int] = None) -> List[dict]:
    """Parse newsletter content using basic regex patterns"""
    try:
        # Extract diving center from metadata if not provided as override
        extracted_diving_center_id = extract_diving_center_from_metadata(content) if diving_center_id_override is None else None
        diving_center_id_from_metadata = diving_center_id_override or extracted_diving_center_id
        
        # Remove metadata from content before parsing
        content_without_metadata = remove_metadata_from_content(content)
        
        # Extract subject and clean content from raw email
        email_message = message_from_bytes(content_without_metadata.encode('utf-8'))
        subject = email_message.get('Subject', '')

        # Get the text content
        clean_content = ""
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        clean_content = payload.decode('utf-8', errors='ignore')
                        break
        else:
            payload = email_message.get_payload(decode=True)
            if payload:
                clean_content = payload.decode('utf-8', errors='ignore')

        # Decode quoted-printable if necessary
        if '=3D' in clean_content or '=20' in clean_content:
            try:
                clean_content = quopri.decodestring(clean_content).decode('utf-8', errors='ignore')
            except:
                pass

        # Extract diving center from headers
        diving_center_name = extract_diving_center_from_headers(content)
        diving_center_id = None
        if diving_center_name:
            diving_center_id = find_matching_diving_center(db, diving_center_name)
            logger.info(f"Extracted diving center: {diving_center_name} -> ID: {diving_center_id}")

        # Improved regex patterns for Greek dates and times
        date_patterns = [
            r'(\d{1,2})\s+(Ιανουαρίου|Φεβρουαρίου|Μαρτίου|Απριλίου|Μαΐου|Ιουνίου|Ιουλίου|Αυγούστου|Σεπτεμβρίου|Οκτωβρίου|Νοεμβρίου|Δεκεμβρίου)(?:\s+(\d{4}))?',
            r'(\d{1,2})/(\d{1,2})/(\d{4})',
            r'(\d{1,2})-(\d{1,2})-(\d{4})',
            r'(\d{1,2})\.(\d{1,2})\.(\d{4})'
        ]

        time_patterns = [
            r'(\d{1,2}):(\d{2})',
            r'(\d{1,2})\.(\d{2})',
            r'(\d{1,2}) (\d{2})'
        ]

        # Keywords that indicate dive trips
        dive_keywords = [
            'βουτάμε', 'βουτιά', 'καταδύσεις', 'dive', 'diving', 'snorkel', 'snorkeling',
            'ραντεβού', 'ραντεβού', 'departure', 'meeting', 'rendezvous'
        ]

        trips = []

        # Look for date patterns in the content
        for date_pattern in date_patterns:
            matches = re.finditer(date_pattern, clean_content, re.IGNORECASE)
            for match in matches:
                # Check if there are dive keywords near this date
                start_pos = max(0, match.start() - 200)
                end_pos = min(len(clean_content), match.end() + 200)
                context = clean_content[start_pos:end_pos]

                has_dive_keywords = any(keyword.lower() in context.lower() for keyword in dive_keywords)

                if has_dive_keywords:
                    # Parse the date
                    groups = match.groups()
                    trip_date = date.today()  # Default

                    if len(groups) >= 2:
                        if len(groups) == 3 and groups[2]:  # Has year
                            trip_date = parse_greek_date(groups[0], groups[1], groups[2])
                        else:  # No year, use current year
                            trip_date = parse_greek_date(groups[0], groups[1])

                    # Extract time if available
                    time_match = re.search(r'(\d{1,2}):(\d{2})', context)
                    trip_time = None
                    if time_match:
                        hour, minute = time_match.groups()
                        trip_time = time(int(hour), int(minute))

                    # Extract dive site names from context
                    dive_site_names = []
                    # Common Greek dive site patterns
                    dive_site_patterns = [
                        r'στο\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'στην\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'στον\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'στην\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'βουτάμε\s+στο\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'βουτάμε\s+στην\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        r'βουτάμε\s+στον\s+([Α-Ωα-ω\s]+?)(?:\s+του|\s+στη|\s+στον|\s+στην|\s+στο\s+|\s*[,\n]|\s*\.)',
                        # English patterns
                        r'at\s+([A-Za-z\s]+?)(?:\s+of|\s+in|\s+at|\s*[,\n]|\s*\.)',
                        r'dive\s+at\s+([A-Za-z\s]+?)(?:\s+of|\s+in|\s+at|\s*[,\n]|\s*\.)',
                        r'wreck\s+of\s+([A-Za-z\s]+?)(?:\s+of|\s+in|\s+at|\s*[,\n]|\s*\.)',
                    ]

                    for pattern in dive_site_patterns:
                        matches = re.findall(pattern, context, re.IGNORECASE)
                        for match in matches:
                            site_name = match.strip()
                            if len(site_name) > 2:  # Filter out very short matches
                                dive_site_names.append(site_name)

                    # Try to match dive sites
                    dive_site_id = None
                    dive_site_name = None
                    if dive_site_names:
                        for site_name in dive_site_names:
                            # Clean diving terminology before searching
                            cleaned_site_name = clean_diving_terminology(site_name)
                            
                            # Try with cleaned name first
                            matched_id = find_matching_dive_site(db, cleaned_site_name)
                            if matched_id:
                                dive_site_id = matched_id
                                dive_site_name = site_name  # Keep original name for display
                                logger.info(f"✅ Basic parsing matched dive site: '{cleaned_site_name}' -> ID: {matched_id}")
                                break
                            else:
                                # Fallback to original name
                                matched_id = find_matching_dive_site(db, site_name)
                                if matched_id:
                                    dive_site_id = matched_id
                                    dive_site_name = site_name
                                    logger.info(f"✅ Basic parsing matched dive site with original name: '{site_name}' -> ID: {matched_id}")
                                    break

                    # Create trip dictionary
                    trip = {
                        'trip_date': trip_date,
                        'trip_time': trip_time,
                        'trip_description': context[:100] + '...' if len(context) > 100 else context,
                        'diving_center_id': diving_center_id,
                        'diving_center_name': diving_center_name,
                        'dive_site_id': dive_site_id,
                        'dive_site_name': dive_site_name
                    }

                    trips.append(trip)

        logger.info(f"Basic parsing found {len(trips)} trips")
        return trips

    except Exception as e:
        logger.error(f"Error in basic parsing: {e}")
        return []

@router.post("/upload", response_model=NewsletterUploadResponse)
async def upload_newsletter(
    file: UploadFile = File(...),
    use_openai: str = Form("true"),
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """
    Upload a newsletter file and parse it for dive trip information.
    """
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are supported")

    try:
        content = await file.read()
        content_str = content.decode('utf-8')

        # Create newsletter record
        newsletter = Newsletter(
            content=content_str
        )
        db.add(newsletter)
        db.commit()
        db.refresh(newsletter)

        # Extract diving center from metadata if present (for file uploads, metadata might be added later)
        diving_center_id_from_metadata = extract_diving_center_from_metadata(content_str)
        
        # Parse the newsletter content
        try:
            if use_openai.lower() == 'true':
                parsed_trips = parse_newsletter_with_openai(content_str, db, diving_center_id_from_metadata)
            else:
                parsed_trips = parse_newsletter_content(content_str, db, diving_center_id_from_metadata)
            
            # Ensure diving_center_id is set from metadata if available
            if diving_center_id_from_metadata is not None:
                for trip_data in parsed_trips:
                    trip_data['diving_center_id'] = diving_center_id_from_metadata

            created_trips = []

            # Create ParsedDiveTrip records
            for trip_data in parsed_trips:
                # Handle date parsing with better error handling
                trip_date = None
                if trip_data.get('trip_date'):
                    trip_date_str = trip_data['trip_date']
                    if isinstance(trip_date_str, str):
                        # Skip placeholder dates like "YYYY-MM-DD"
                        if trip_date_str == "YYYY-MM-DD" or "YYYY" in trip_date_str:
                            logger.warning(f"Skipping placeholder date: {trip_date_str}")
                            continue
                        try:
                            trip_date = datetime.strptime(trip_date_str, '%Y-%m-%d').date()
                        except ValueError as e:
                            logger.error(f"Invalid date format '{trip_date_str}': {e}")
                            continue
                    else:
                        trip_date = trip_date_str
                else:
                    logger.warning("No trip_date provided, skipping trip")
                    continue

                # Validate and convert difficulty_code if provided
                trip_difficulty_code = trip_data.get('trip_difficulty_code')
                trip_difficulty_id = None
                if trip_difficulty_code:
                    trip_difficulty_id = get_difficulty_id_by_code(db, trip_difficulty_code)
                    if trip_difficulty_id is None:
                        logger.warning(f"Invalid difficulty_code: {trip_difficulty_code} for trip, skipping this trip")
                        continue  # Skip this trip rather than fail entire import

                trip = ParsedDiveTrip(
                    source_newsletter_id=newsletter.id,
                    diving_center_id=trip_data.get('diving_center_id'),
                    trip_date=trip_date,
                    trip_time=trip_data.get('trip_time'),
                    trip_duration=trip_data.get('trip_duration'),
                    trip_difficulty_id=trip_difficulty_id,
                    trip_price=trip_data.get('trip_price'),
                    trip_currency=trip_data.get('trip_currency', 'EUR'),
                    group_size_limit=trip_data.get('group_size_limit'),
                    current_bookings=trip_data.get('current_bookings', 0),
                    trip_description=trip_data.get('trip_description'),
                    special_requirements=trip_data.get('special_requirements'),
                    trip_status=trip_data.get('trip_status', 'scheduled')
                )
                db.add(trip)
                db.flush()  # Get the trip ID

                # Create ParsedDive records for each dive in the trip
                if trip_data.get('dives'):
                    for dive_data in trip_data['dives']:
                        dive = ParsedDive(
                            trip_id=trip.id,
                            dive_site_id=dive_data.get('dive_site_id'),
                            dive_number=dive_data.get('dive_number', 1),
                            dive_time=dive_data.get('dive_time'),
                            dive_duration=dive_data.get('dive_duration'),
                            dive_description=dive_data.get('dive_description')
                        )
                        db.add(dive)

                created_trips.append(trip)

            db.commit()

            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=len(created_trips),
                message="Newsletter uploaded and parsed successfully"
            )

        except Exception as e:
            logger.error(f"Error parsing newsletter: {e}")
            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=0,
                message=f"Newsletter uploaded but parsing failed: {str(e)}"
            )

    except Exception as e:
        logger.error(f"Error uploading newsletter: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading newsletter: {str(e)}")

@router.post("/parse-text", response_model=NewsletterUploadResponse)
async def parse_newsletter_text(
    request: NewsletterParseTextRequest,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """
    Parse newsletter text content directly and extract dive trip information.
    Similar to upload but accepts text content directly instead of a file.
    """
    try:
        content_str = request.content
        diving_center_id_override = request.diving_center_id
        use_openai = request.use_openai

        # Validate diving center if provided
        diving_center_name = None
        if diving_center_id_override is not None:
            diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id_override).first()
            if not diving_center:
                raise HTTPException(status_code=400, detail=f"Diving center with ID {diving_center_id_override} not found")
            diving_center_name = diving_center.name
        
        # Add diving center metadata to content before saving
        content_with_metadata = add_diving_center_metadata(content_str, diving_center_id_override)

        # Create newsletter record with metadata embedded
        newsletter = Newsletter(
            content=content_with_metadata
        )
        db.add(newsletter)
        db.commit()
        db.refresh(newsletter)

        # Parse the newsletter content (metadata will be extracted automatically)
        try:
            if use_openai:
                parsed_trips = parse_newsletter_with_openai(content_with_metadata, db, diving_center_id_override)
            else:
                parsed_trips = parse_newsletter_content(content_with_metadata, db, diving_center_id_override)

            # Ensure diving_center_id is set if provided or found in metadata
            final_diving_center_id = diving_center_id_override
            if final_diving_center_id is not None:
                for trip_data in parsed_trips:
                    trip_data['diving_center_id'] = final_diving_center_id

            created_trips = []

            # Create ParsedDiveTrip records
            for trip_data in parsed_trips:
                # Handle date parsing with better error handling
                trip_date = None
                if trip_data.get('trip_date'):
                    trip_date_str = trip_data['trip_date']
                    if isinstance(trip_date_str, str):
                        # Skip placeholder dates like "YYYY-MM-DD"
                        if trip_date_str == "YYYY-MM-DD" or "YYYY" in trip_date_str:
                            logger.warning(f"Skipping placeholder date: {trip_date_str}")
                            continue
                        try:
                            trip_date = datetime.strptime(trip_date_str, '%Y-%m-%d').date()
                        except ValueError as e:
                            logger.error(f"Invalid date format '{trip_date_str}': {e}")
                            continue
                    else:
                        trip_date = trip_date_str
                else:
                    logger.warning("No trip_date provided, skipping trip")
                    continue

                # Validate and convert difficulty_code if provided
                trip_difficulty_code = trip_data.get('trip_difficulty_code')
                trip_difficulty_id = None
                if trip_difficulty_code:
                    trip_difficulty_id = get_difficulty_id_by_code(db, trip_difficulty_code)
                    if trip_difficulty_id is None:
                        logger.warning(f"Invalid difficulty_code: {trip_difficulty_code} for trip, skipping this trip")
                        continue  # Skip this trip rather than fail entire import

                trip = ParsedDiveTrip(
                    source_newsletter_id=newsletter.id,
                    diving_center_id=trip_data.get('diving_center_id'),
                    trip_date=trip_date,
                    trip_time=trip_data.get('trip_time'),
                    trip_duration=trip_data.get('trip_duration'),
                    trip_difficulty_id=trip_difficulty_id,
                    trip_price=trip_data.get('trip_price'),
                    trip_currency=trip_data.get('trip_currency', 'EUR'),
                    group_size_limit=trip_data.get('group_size_limit'),
                    current_bookings=trip_data.get('current_bookings', 0),
                    trip_description=trip_data.get('trip_description'),
                    special_requirements=trip_data.get('special_requirements'),
                    trip_status=trip_data.get('trip_status', 'scheduled')
                )
                db.add(trip)
                db.flush()  # Get the trip ID

                # Create ParsedDive records for each dive in the trip
                if trip_data.get('dives'):
                    for dive_data in trip_data['dives']:
                        dive = ParsedDive(
                            trip_id=trip.id,
                            dive_site_id=dive_data.get('dive_site_id'),
                            dive_number=dive_data.get('dive_number', 1),
                            dive_time=dive_data.get('dive_time'),
                            dive_duration=dive_data.get('dive_duration'),
                            dive_description=dive_data.get('dive_description')
                        )
                        db.add(dive)

                created_trips.append(trip)

            db.commit()

            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=len(created_trips),
                message="Newsletter text parsed successfully"
            )

        except Exception as e:
            logger.error(f"Error parsing newsletter text: {e}")
            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=0,
                message=f"Newsletter text parsed but parsing failed: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing newsletter text: {e}")
        raise HTTPException(status_code=500, detail=f"Error parsing newsletter text: {str(e)}")

@router.get("/", response_model=List[NewsletterResponse])
async def get_newsletters(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """
    Get all newsletters with optional pagination.
    """

    newsletters = db.query(Newsletter).offset(offset).limit(limit).all()

    # Add trip count for each newsletter
    result = []
    for newsletter in newsletters:
        trip_count = db.query(ParsedDiveTrip).filter(
            ParsedDiveTrip.source_newsletter_id == newsletter.id
        ).count()

        result.append({
            "id": newsletter.id,
            "content": newsletter.content,
            "received_at": newsletter.received_at,
            "trips_count": trip_count
        })

    return result

@router.get("/trips", response_model=List[ParsedDiveTripResponse])
async def get_parsed_trips(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    diving_center_id: Optional[int] = None,
    dive_site_id: Optional[int] = None,
    trip_status: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_duration: Optional[int] = None,
    max_duration: Optional[int] = None,
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    exclude_unspecified_difficulty: bool = Query(False, description="Exclude trips with unspecified difficulty"),
    search_query: Optional[str] = None,
    location_query: Optional[str] = None,
    sort_by: Optional[str] = "trip_date",
    sort_order: Optional[str] = "desc",
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get parsed dive trips with advanced filtering, search, and sorting.
    
    Sort options:
    - trip_date: Sort by trip date
    - trip_price: Sort by trip price
    - trip_duration: Sort by trip duration
    - difficulty_level: Sort by difficulty level
    - popularity: Sort by dive site popularity (view count)
    - distance: Sort by distance from user location (requires user_lat and user_lon)
    - created_at: Sort by creation date
    
    Sort order: "asc" or "desc"
    
    Distance sorting requires user_lat and user_lon coordinates.
    """
    # Eager load difficulty relationship for efficient access
    query = db.query(ParsedDiveTrip).options(joinedload(ParsedDiveTrip.difficulty))

    # Date filtering
    if start_date:
        query = query.filter(ParsedDiveTrip.trip_date >= start_date)

    if end_date:
        query = query.filter(ParsedDiveTrip.trip_date <= end_date)

    # Diving center filtering
    if diving_center_id:
        query = query.filter(ParsedDiveTrip.diving_center_id == diving_center_id)

    # Dive site filtering
    if dive_site_id:
        # Filter through the dives relationship to find trips with the specified dive site
        query = query.filter(ParsedDiveTrip.dives.any(ParsedDive.dive_site_id == dive_site_id))

            # Status filtering
        if trip_status:
            try:
                trip_status_enum = TripStatus(trip_status)
                query = query.filter(ParsedDiveTrip.trip_status == trip_status_enum)
            except:
                pass  # Invalid status, ignore filter

    # Price filtering
    if min_price is not None:
        query = query.filter(ParsedDiveTrip.trip_price >= min_price)

    if max_price is not None:
        query = query.filter(ParsedDiveTrip.trip_price <= max_price)

    # Duration filtering
    if min_duration is not None:
        query = query.filter(ParsedDiveTrip.trip_duration >= min_duration)

    if max_duration is not None:
        query = query.filter(ParsedDiveTrip.trip_duration <= max_duration)

    # Difficulty level filtering
    if difficulty_code:
        difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
        if difficulty_id:
            query = query.filter(ParsedDiveTrip.trip_difficulty_id == difficulty_id)
        elif exclude_unspecified_difficulty:
            query = query.filter(False)
    elif exclude_unspecified_difficulty:
        query = query.filter(ParsedDiveTrip.trip_difficulty_id.isnot(None))

    # Full-text search across multiple fields (only for authenticated users)
    if current_user and search_query and search_query.strip():
        search_term = f"%{search_query.strip()}%"
        query = query.filter(
            or_(
                ParsedDiveTrip.trip_description.ilike(search_term),
                ParsedDiveTrip.special_requirements.ilike(search_term),
                ParsedDiveTrip.diving_center.has(DivingCenter.name.ilike(search_term)),
                # Search in dive site names through the dives relationship
                ParsedDiveTrip.dives.any(ParsedDive.dive_site.has(DiveSite.name.ilike(search_term))),
                # Search in dive descriptions
                ParsedDiveTrip.dives.any(ParsedDive.dive_description.ilike(search_term))
            )
        )

    # Location-based search (only for authenticated users)
    if current_user and location_query and location_query.strip():
        location_term = f"%{location_query.strip()}%"
        query = query.filter(
            or_(
                # Search in dive site location fields through the dives relationship
                ParsedDiveTrip.dives.any(ParsedDive.dive_site.has(DiveSite.country.ilike(location_term))),
                ParsedDiveTrip.dives.any(ParsedDive.dive_site.has(DiveSite.region.ilike(location_term))),
                ParsedDiveTrip.dives.any(ParsedDive.dive_site.has(DiveSite.address.ilike(location_term))),
                ParsedDiveTrip.diving_center.has(DivingCenter.name.ilike(location_term))
            )
        )

    # Sorting
    if sort_by == "popularity":
        # Only admin users can sort by popularity (view count)
        if not current_user or not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sorting by popularity is only available for admin users"
            )
        # Sort by dive site popularity (view count)
        # Join through dives to get dive site information
        if sort_order.lower() == "desc":
            query = query.join(ParsedDive, ParsedDiveTrip.dives).join(DiveSite, ParsedDive.dive_site_id == DiveSite.id).order_by(DiveSite.view_count.desc())
        else:
            query = query.join(ParsedDive, ParsedDiveTrip.dives).join(DiveSite, ParsedDive.dive_site_id == DiveSite.id).order_by(DiveSite.view_count.asc())
    elif sort_by == "distance":
        # Sort by distance from user location
        if user_lat is not None and user_lon is not None:
            # Join through dives to get dive site coordinates
            query = query.join(ParsedDive, ParsedDiveTrip.dives).join(DiveSite, ParsedDive.dive_site_id == DiveSite.id)
            # We'll sort by distance after fetching the results
            # For now, just ensure we have the dive site data
        else:
            # If no user coordinates provided, fall back to trip_date
            sort_by = "trip_date"
            sort_field = getattr(ParsedDiveTrip, sort_by, ParsedDiveTrip.trip_date)
            if sort_order.lower() == "desc":
                query = query.order_by(sort_field.desc())
            else:
                query = query.order_by(sort_field.asc())
    elif sort_by == "difficulty_level":
        # Sort by difficulty order_index via LEFT JOIN
        query = query.outerjoin(DifficultyLevel, ParsedDiveTrip.trip_difficulty_id == DifficultyLevel.id)
        if sort_order.lower() == "desc":
            query = query.order_by(DifficultyLevel.order_index.desc())
        else:
            query = query.order_by(DifficultyLevel.order_index.asc())
    else:
        sort_field = getattr(ParsedDiveTrip, sort_by, ParsedDiveTrip.trip_date)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())

    # Apply pagination
    if skip > 0:
        query = query.offset(skip)
    if limit > 0:
        query = query.limit(limit)

    trips = query.all()
    
    # Restrict unauthenticated users to only the 2 most recent trips per diving center
    if not current_user:
        # Group trips by diving_center_id and get only the 2 most recent (latest trip_date) per center
        from collections import defaultdict
        trips_by_center = defaultdict(list)
        
        for trip in trips:
            if trip.diving_center_id:  # Only include trips with a diving center
                trips_by_center[trip.diving_center_id].append(trip)
        
        # For each center, sort by trip_date (descending = newest first) and take only 2
        restricted_trips = []
        for center_id, center_trips in trips_by_center.items():
            # Sort by trip_date descending (newest first) to match frontend sorting
            sorted_center_trips = sorted(center_trips, key=lambda t: t.trip_date or date.min, reverse=True)
            # Take only the 2 most recent
            restricted_trips.extend(sorted_center_trips[:2])
        
        trips = restricted_trips
    
    # Apply fuzzy search if we have a search query and insufficient results (only for authenticated users)
    match_types = {}
    if current_user and search_query and len(trips) < 5:
        # Get the search query for fuzzy search
        search_query_for_fuzzy = search_query.strip()[:200]
        
        # Perform fuzzy search to enhance results
        enhanced_results = search_dive_trips_with_fuzzy(
            search_query_for_fuzzy, 
            trips, 
            db, 
            similarity_threshold=0.2, 
            max_fuzzy_results=10
        )
        
        # Update trips with enhanced results
        trips = [result['trip'] for result in enhanced_results]
        
        # Create match types mapping for frontend
        for result in enhanced_results:
            match_types[result['trip'].id] = {
                'type': result['match_type'],
                'score': result['score']
            }
        
        # Re-query with the enhanced results to get proper pagination
        if len(trips) > len(query.all()):
            # We have more results now, need to get all enhanced results
            enhanced_query = db.query(ParsedDiveTrip).filter(
                ParsedDiveTrip.id.in_([trip.id for trip in trips])
            )
            
            # Re-apply the same logic for all filters and sorting
            # This is a simplified approach - in production you might want to optimize this
            trips = enhanced_query.all()

    # Process trips and add distance information if needed
    trip_data = []
    for trip in trips:
        distance = None
        if sort_by == "distance" and user_lat is not None and user_lon is not None:
            # Calculate distance from user to dive site through the dives relationship
            distance = None
            for dive in trip.dives:
                if dive.dive_site and dive.dive_site.latitude and dive.dive_site.longitude:
                    distance = calculate_distance(
                        user_lat, user_lon,
                        float(dive.dive_site.latitude), float(dive.dive_site.longitude)
                    )
                    break  # Use the first dive site with coordinates
            
            # If no dive site coordinates, check diving center coordinates as fallback
            if distance is None and trip.diving_center and trip.diving_center.latitude and trip.diving_center.longitude:
                distance = calculate_distance(
                    user_lat, user_lon,
                    float(trip.diving_center.latitude), float(trip.diving_center.longitude)
                )
        
        trip_data.append({
            'trip': trip,
            'distance': distance
        })

    # Sort by distance if requested
    if sort_by == "distance" and user_lat is not None and user_lon is not None:
        # Filter out trips without distance information
        trip_data = [td for td in trip_data if td['distance'] is not None]
        
        if sort_order.lower() == "desc":
            trip_data.sort(key=lambda x: x['distance'], reverse=True)
        else:
            trip_data.sort(key=lambda x: x['distance'])

    # Build the response
    response_data = [
        ParsedDiveTripResponse(
            id=td['trip'].id,
            diving_center_id=td['trip'].diving_center_id,
            trip_date=td['trip'].trip_date,
            trip_time=td['trip'].trip_time,
            trip_duration=td['trip'].trip_duration,
            trip_difficulty_code=td['trip'].difficulty.code if td['trip'].difficulty else None,
            trip_difficulty_label=td['trip'].difficulty.label if td['trip'].difficulty else None,
            trip_price=float(td['trip'].trip_price) if td['trip'].trip_price else None,
            trip_currency=td['trip'].trip_currency,
            group_size_limit=td['trip'].group_size_limit,
            current_bookings=td['trip'].current_bookings,
            trip_description=td['trip'].trip_description,
            special_requirements=td['trip'].special_requirements,
            trip_status=td['trip'].trip_status.value,
            diving_center_name=td['trip'].diving_center.name if td['trip'].diving_center else None,
            distance=td['distance'],
            dives=[
                ParsedDiveResponse(
                    id=dive.id,
                    trip_id=dive.trip_id,
                    dive_site_id=dive.dive_site_id,
                    dive_number=dive.dive_number,
                    dive_time=dive.dive_time,
                    dive_duration=dive.dive_duration,
                    dive_description=dive.dive_description,
                    dive_site_name=dive.dive_site.name if dive.dive_site else None,
                    created_at=dive.created_at,
                    updated_at=dive.updated_at
                )
                for dive in td['trip'].dives
            ],
            source_newsletter_id=td['trip'].source_newsletter_id,
            newsletter_content=td['trip'].newsletter_content if hasattr(td['trip'], 'newsletter_content') else None,
            extracted_at=td['trip'].extracted_at,
            created_at=td['trip'].created_at,
            updated_at=td['trip'].updated_at
        )
        for td in trip_data
    ]

    # Return response with match type headers if available
    from fastapi.responses import Response
    import json
    
    # Create response with custom headers if match types are available
    if match_types:
        # Optimize match_types to prevent extremely large headers
        # Only include essential match information and limit size
        optimized_match_types = {}
        for trip_id, match_info in match_types.items():
            # Include only essential fields to reduce header size
            optimized_match_types[trip_id] = {
                'type': match_info.get('type', 'unknown'),
                'score': round(match_info.get('score', 0), 2) if match_info.get('score') else 0
            }
        
        # Convert to JSON and check size
        match_types_json = json.dumps(optimized_match_types)
        
        # If header is still too large, truncate or omit it
        if len(match_types_json) > 8000:  # 8KB limit for headers
            # Log warning about large header
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"X-Match-Types header too large ({len(match_types_json)} chars), omitting to prevent nginx errors")
            # Return response without the header
            return Response(
                content=json.dumps(serialized_trips),
                media_type="application/json"
            )
        
        # Properly serialize the Pydantic models to handle datetime fields
        serialized_trips = []
        for trip in response_data:
            trip_dict = trip.model_dump()
            # Recursively handle date and datetime serialization
            def serialize_datetime(obj):
                if isinstance(obj, dict):
                    return {key: serialize_datetime(value) for key, value in obj.items()}
                elif isinstance(obj, list):
                    return [serialize_datetime(item) for item in obj]
                elif hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                else:
                    return obj
            
            # Apply serialization to the entire trip dictionary
            trip_dict = serialize_datetime(trip_dict)
            serialized_trips.append(trip_dict)
        
        response = Response(
            content=json.dumps(serialized_trips),
            media_type="application/json",
            headers={"X-Match-Types": match_types_json}
        )
        return response
    
    return response_data

@router.get("/{newsletter_id}", response_model=NewsletterResponse)
async def get_newsletter(
    newsletter_id: int,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """
    Get a specific newsletter by ID.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can view newsletters")

    newsletter = db.query(Newsletter).filter(Newsletter.id == newsletter_id).first()
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")

    trip_count = db.query(ParsedDiveTrip).filter(
        ParsedDiveTrip.source_newsletter_id == newsletter.id
    ).count()

    return {
        "id": newsletter.id,
        "content": newsletter.content,
        "received_at": newsletter.received_at,
        "trips_count": trip_count
    }

@router.put("/{newsletter_id}", response_model=NewsletterResponse)
async def update_newsletter(
    newsletter_id: int,
    newsletter_data: NewsletterUpdateRequest,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can update newsletters")
    """
    Update a newsletter's content.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can update newsletters")

    newsletter = db.query(Newsletter).filter(Newsletter.id == newsletter_id).first()
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")

    if newsletter_data.content is not None:
        newsletter.content = newsletter_data.content

    db.commit()
    db.refresh(newsletter)

    trip_count = db.query(ParsedDiveTrip).filter(
        ParsedDiveTrip.source_newsletter_id == newsletter.id
    ).count()

    return {
        "id": newsletter.id,
        "content": newsletter.content,
        "received_at": newsletter.received_at,
        "trips_count": trip_count
    }

@router.delete("/{newsletter_id}")
async def delete_newsletter(
    newsletter_id: int,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete newsletters")
    """
    Delete a newsletter and all its associated trips.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete newsletters")

    newsletter = db.query(Newsletter).filter(Newsletter.id == newsletter_id).first()
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")

    # Delete associated trips first
    trips = db.query(ParsedDiveTrip).filter(
        ParsedDiveTrip.source_newsletter_id == newsletter_id
    ).all()

    for trip in trips:
        db.delete(trip)

    # Delete the newsletter
    db.delete(newsletter)
    db.commit()

    return {"message": f"Newsletter and {len(trips)} associated trips deleted successfully"}

@router.delete("/", response_model=NewsletterDeleteResponse)
async def delete_newsletters(
    delete_request: NewsletterDeleteRequest,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete newsletters")
    """
    Mass delete multiple newsletters and their associated trips.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete newsletters")

    deleted_count = 0
    total_trips_deleted = 0

    for newsletter_id in delete_request.newsletter_ids:
        newsletter = db.query(Newsletter).filter(Newsletter.id == newsletter_id).first()
        if newsletter:
            # Delete associated trips first
            trips = db.query(ParsedDiveTrip).filter(
                ParsedDiveTrip.source_newsletter_id == newsletter_id
            ).all()

            for trip in trips:
                db.delete(trip)

            total_trips_deleted += len(trips)

            # Delete the newsletter
            db.delete(newsletter)
            deleted_count += 1

    db.commit()

    return NewsletterDeleteResponse(
        deleted_count=deleted_count,
        message=f"Deleted {deleted_count} newsletters and {total_trips_deleted} associated trips"
    )

@router.delete("/trips/{trip_id}")
async def delete_parsed_trip(
    trip_id: int,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete dive trips")
    """
    Delete a parsed dive trip. Only admins and moderators can delete trips.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can delete trips")

    trip = db.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    db.delete(trip)
    db.commit()

    return {"message": "Trip deleted successfully"}

@router.post("/{newsletter_id}/reparse")
async def reparse_newsletter(
    newsletter_id: int,
    use_openai: str = Form("true"),
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can reparse newsletters")
    """
    Re-parse a previously uploaded newsletter for dive trip information.
    This will delete existing parsed trips and create new ones.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can reparse newsletters")

    newsletter = db.query(Newsletter).filter(Newsletter.id == newsletter_id).first()
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")

    try:
        # Delete existing parsed trips for this newsletter
        existing_trips = db.query(ParsedDiveTrip).filter(
            ParsedDiveTrip.source_newsletter_id == newsletter_id
        ).all()

        for trip in existing_trips:
            db.delete(trip)

        db.commit()

        # Parse the newsletter content again (metadata will be extracted automatically)
        try:
            # Extract diving center from metadata if present
            diving_center_id_from_metadata = extract_diving_center_from_metadata(newsletter.content)
            
            if use_openai.lower() == 'true':
                parsed_trips = parse_newsletter_with_openai(newsletter.content, db, diving_center_id_from_metadata)
            else:
                parsed_trips = parse_newsletter_content(newsletter.content, db, diving_center_id_from_metadata)
            
            # Ensure diving_center_id is set from metadata if available
            if diving_center_id_from_metadata is not None:
                for trip_data in parsed_trips:
                    trip_data['diving_center_id'] = diving_center_id_from_metadata

            created_trips = []

            # Create new ParsedDiveTrip records
            for trip_data in parsed_trips:
                # Handle date parsing with better error handling
                trip_date = None
                if trip_data.get('trip_date'):
                    trip_date_str = trip_data['trip_date']
                    if isinstance(trip_date_str, str):
                        # Skip placeholder dates like "YYYY-MM-DD"
                        if trip_date_str == "YYYY-MM-DD" or "YYYY" in trip_date_str:
                            logger.warning(f"Skipping placeholder date: {trip_date_str}")
                            continue
                        try:
                            trip_date = datetime.strptime(trip_date_str, '%Y-%m-%d').date()
                        except ValueError as e:
                            logger.error(f"Invalid date format '{trip_date_str}': {e}")
                            continue
                    else:
                        trip_date = trip_date_str
                else:
                    logger.warning("No trip_date provided, skipping trip")
                    continue

                # Validate and convert difficulty_code if provided
                trip_difficulty_code = trip_data.get('trip_difficulty_code')
                trip_difficulty_id = None
                if trip_difficulty_code:
                    trip_difficulty_id = get_difficulty_id_by_code(db, trip_difficulty_code)
                    if trip_difficulty_id is None:
                        logger.warning(f"Invalid difficulty_code: {trip_difficulty_code} for trip, skipping this trip")
                        continue  # Skip this trip rather than fail entire import

                trip = ParsedDiveTrip(
                    source_newsletter_id=newsletter.id,
                    diving_center_id=trip_data.get('diving_center_id'),
                    trip_date=trip_date,
                    trip_time=trip_data.get('trip_time'),
                    trip_duration=trip_data.get('trip_duration'),
                    trip_difficulty_id=trip_difficulty_id,
                    trip_price=trip_data.get('trip_price'),
                    trip_currency=trip_data.get('trip_currency', 'EUR'),
                    group_size_limit=trip_data.get('group_size_limit'),
                    current_bookings=trip_data.get('current_bookings', 0),
                    trip_description=trip_data.get('trip_description'),
                    special_requirements=trip_data.get('special_requirements'),
                    trip_status=trip_data.get('trip_status', 'scheduled')
                )
                db.add(trip)
                db.flush()  # Get the trip ID

                # Create ParsedDive records for each dive in the trip
                if trip_data.get('dives'):
                    for dive_data in trip_data['dives']:
                        dive = ParsedDive(
                            trip_id=trip.id,
                            dive_site_id=dive_data.get('dive_site_id'),
                            dive_number=dive_data.get('dive_number', 1),
                            dive_time=dive_data.get('dive_time'),
                            dive_duration=dive_data.get('dive_duration'),
                            dive_description=dive_data.get('dive_description')
                        )
                        db.add(dive)

                created_trips.append(trip)

            db.commit()

            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=len(created_trips),
                message=f"Newsletter re-parsed successfully. {len(existing_trips)} old trips deleted, {len(created_trips)} new trips created."
            )

        except Exception as e:
            logger.error(f"Error re-parsing newsletter: {e}")
            return NewsletterUploadResponse(
                newsletter_id=newsletter.id,
                trips_created=0,
                message=f"Newsletter re-parsing failed: {str(e)}"
            )

    except Exception as e:
        logger.error(f"Error re-parsing newsletter: {e}")
        raise HTTPException(status_code=500, detail=f"Error re-parsing newsletter: {str(e)}")

@router.post("/trips", response_model=ParsedDiveTripResponse)
async def create_parsed_trip(
    trip_data: ParsedDiveTripCreate,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can create dive trips")
    """
    Create a new parsed dive trip manually.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can create trips")

    # Validate and convert difficulty_code if provided
    trip_difficulty_id = None
    if trip_data.trip_difficulty_code:
        trip_difficulty_id = get_difficulty_id_by_code(db, trip_data.trip_difficulty_code)
        if trip_difficulty_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid difficulty_code: {trip_data.trip_difficulty_code}. Must be one of: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"
            )

    try:
        trip = ParsedDiveTrip(
            diving_center_id=trip_data.diving_center_id,
            trip_date=trip_data.trip_date,
            trip_time=trip_data.trip_time,
            trip_duration=trip_data.trip_duration,
            trip_difficulty_id=trip_difficulty_id,
            trip_price=trip_data.trip_price,
            trip_currency=trip_data.trip_currency,
            group_size_limit=trip_data.group_size_limit,
            current_bookings=trip_data.current_bookings,
            trip_description=trip_data.trip_description,
            special_requirements=trip_data.special_requirements,
            trip_status=trip_data.trip_status
        )
        db.add(trip)
        db.flush()  # Get the trip ID

        # Create the associated dives
        dives = []
        for dive_data in trip_data.dives:
            dive = ParsedDive(
                trip_id=trip.id,
                dive_site_id=dive_data.dive_site_id,
                dive_number=dive_data.dive_number,
                dive_time=dive_data.dive_time,
                dive_duration=dive_data.dive_duration,
                dive_description=dive_data.dive_description
            )
            db.add(dive)
            dives.append(dive)

        db.commit()
        db.refresh(trip)

        # Build the response with dives
        dive_responses = []
        for dive in dives:
            dive_responses.append(ParsedDiveResponse(
                id=dive.id,
                trip_id=dive.trip_id,
                dive_site_id=dive.dive_site_id,
                dive_number=dive.dive_number,
                dive_time=dive.dive_time,
                dive_duration=dive.dive_duration,
                dive_description=dive.dive_description,
                dive_site_name=dive.dive_site.name if dive.dive_site else None,
                created_at=dive.created_at,
                updated_at=dive.updated_at
            ))

        return ParsedDiveTripResponse(
            id=trip.id,
            diving_center_id=trip.diving_center_id,
            trip_date=trip.trip_date,
            trip_time=trip.trip_time,
            trip_duration=trip.trip_duration,
            trip_difficulty_code=trip.difficulty.code if trip.difficulty else None,
            trip_difficulty_label=trip.difficulty.label if trip.difficulty else None,
            trip_price=float(trip.trip_price) if trip.trip_price else None,
            trip_currency=trip.trip_currency,
            group_size_limit=trip.group_size_limit,
            current_bookings=trip.current_bookings,
            trip_description=trip.trip_description,
            special_requirements=trip.special_requirements,
            trip_status=trip.trip_status.value,
            diving_center_name=trip.diving_center.name if trip.diving_center else None,
            dives=dive_responses,
            extracted_at=trip.extracted_at,
            created_at=trip.created_at,
            updated_at=trip.updated_at
        )

    except Exception as e:
        logger.error(f"Error creating parsed trip: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating trip: {str(e)}")

@router.get("/trips/{trip_id}", response_model=ParsedDiveTripResponse)
async def get_parsed_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific parsed dive trip by ID.
    Requires authentication but allows all authenticated users to view trips.
    """

    # Eager load difficulty relationship
    trip = db.query(ParsedDiveTrip).options(joinedload(ParsedDiveTrip.difficulty)).filter(ParsedDiveTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    return ParsedDiveTripResponse(
        id=trip.id,
        diving_center_id=trip.diving_center_id,
        trip_date=trip.trip_date,
        trip_time=trip.trip_time,
        trip_duration=trip.trip_duration,
        trip_difficulty_code=trip.difficulty.code if trip.difficulty else None,
        trip_difficulty_label=trip.difficulty.label if trip.difficulty else None,
        trip_price=float(trip.trip_price) if trip.trip_price else None,
        trip_currency=trip.trip_currency,
        group_size_limit=trip.group_size_limit,
        current_bookings=trip.current_bookings,
        trip_description=trip.trip_description,
        special_requirements=trip.special_requirements,
        trip_status=trip.trip_status.value,
        diving_center_name=trip.diving_center.name if trip.diving_center else None,
        newsletter_content=db.query(Newsletter).filter(Newsletter.id == trip.source_newsletter_id).first().content if trip.source_newsletter_id else None,
        dives=[
            ParsedDiveResponse(
                id=dive.id,
                trip_id=dive.trip_id,
                dive_site_id=dive.dive_site_id,
                dive_number=dive.dive_number,
                dive_time=dive.dive_time,
                dive_duration=dive.dive_duration,
                dive_description=dive.dive_description,
                dive_site_name=dive.dive_site.name if dive.dive_site else None,
                created_at=dive.created_at,
                updated_at=dive.updated_at
            )
            for dive in trip.dives
        ],
        extracted_at=trip.extracted_at,
        created_at=trip.created_at,
        updated_at=trip.updated_at
    )

@router.put("/trips/{trip_id}", response_model=ParsedDiveTripResponse)
async def update_parsed_trip(
    trip_id: int,
    trip_data: ParsedDiveTripUpdate,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can update dive trips")
    """
    Update a parsed dive trip.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can update trips")

    trip = db.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    try:
        # Update trip fields if provided
        if trip_data.diving_center_id is not None:
            trip.diving_center_id = trip_data.diving_center_id
        if trip_data.trip_date is not None:
            trip.trip_date = trip_data.trip_date
        if trip_data.trip_time is not None:
            trip.trip_time = trip_data.trip_time
        if trip_data.trip_duration is not None:
            trip.trip_duration = trip_data.trip_duration
        if trip_data.trip_difficulty_code is not None:
            trip_difficulty_id = get_difficulty_id_by_code(db, trip_data.trip_difficulty_code)
            if trip_difficulty_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid difficulty_code: {trip_data.trip_difficulty_code}. Must be one of: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"
                )
            trip.trip_difficulty_id = trip_difficulty_id
        if trip_data.trip_price is not None:
            trip.trip_price = trip_data.trip_price
        if trip_data.trip_currency is not None:
            trip.trip_currency = trip_data.trip_currency
        if trip_data.group_size_limit is not None:
            trip.group_size_limit = trip_data.group_size_limit
        if trip_data.current_bookings is not None:
            trip.current_bookings = trip_data.current_bookings
        if trip_data.trip_description is not None:
            trip.trip_description = trip_data.trip_description
        if trip_data.special_requirements is not None:
            trip.special_requirements = trip_data.special_requirements
        if trip_data.trip_status is not None:
            trip.trip_status = trip_data.trip_status

        # Handle dives if provided
        if trip_data.dives is not None:
            # Delete existing dives
            db.query(ParsedDive).filter(ParsedDive.trip_id == trip_id).delete()

            # Create new dives
            for dive_data in trip_data.dives:
                dive = ParsedDive(
                    trip_id=trip.id,
                    dive_site_id=dive_data.dive_site_id,
                    dive_number=dive_data.dive_number,
                    dive_time=dive_data.dive_time,
                    dive_duration=dive_data.dive_duration,
                    dive_description=dive_data.dive_description
                )
                db.add(dive)

        db.commit()
        db.refresh(trip)

        # Build the response with dives
        dive_responses = []
        for dive in trip.dives:
            dive_responses.append(ParsedDiveResponse(
                id=dive.id,
                trip_id=dive.trip_id,
                dive_site_id=dive.dive_site_id,
                dive_number=dive.dive_number,
                dive_time=dive.dive_time,
                dive_duration=dive.dive_duration,
                dive_description=dive.dive_description,
                dive_site_name=dive.dive_site.name if dive.dive_site else None,
                created_at=dive.created_at,
                updated_at=dive.updated_at
            ))

        return ParsedDiveTripResponse(
            id=trip.id,
            diving_center_id=trip.diving_center_id,
            trip_date=trip.trip_date,
            trip_time=trip.trip_time,
            trip_duration=trip.trip_duration,
            trip_difficulty_code=trip.difficulty.code if trip.difficulty else None,
            trip_difficulty_label=trip.difficulty.label if trip.difficulty else None,
            trip_price=float(trip.trip_price) if trip.trip_price else None,
            trip_currency=trip.trip_currency,
            group_size_limit=trip.group_size_limit,
            current_bookings=trip.current_bookings,
            trip_description=trip.trip_description,
            special_requirements=trip.special_requirements,
            trip_status=trip.trip_status.value,
            diving_center_name=trip.diving_center.name if trip.diving_center else None,
            dives=dive_responses,
            extracted_at=trip.extracted_at,
            created_at=trip.created_at,
            updated_at=trip.updated_at
        )

    except Exception as e:
        logger.error(f"Error updating parsed trip: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating trip: {str(e)}")