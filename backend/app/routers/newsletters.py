from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, time
import re
import json
import os
import requests
from app.database import get_db
from app.models import Newsletter, ParsedDiveTrip, DivingCenter, DiveSite, User, TripStatus, DifficultyLevel, ParsedDive
from app.auth import get_current_user
from app.schemas import ParsedDiveTripResponse, NewsletterUploadResponse, NewsletterResponse, NewsletterUpdateRequest, NewsletterDeleteRequest, NewsletterDeleteResponse, ParsedDiveTripCreate, ParsedDiveTripUpdate, ParsedDiveResponse
import logging
import openai
import quopri
from email import message_from_bytes
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

router = APIRouter(tags=["newsletters"])

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
    
    # First try exact match (case insensitive)
    exact_match = db.query(DiveSite).filter(
        DiveSite.name.ilike(site_name)
    ).first()
    if exact_match:
        return exact_match.id
    
    # Try partial matches
    partial_matches = db.query(DiveSite).filter(
        DiveSite.name.ilike(f"%{site_name}%")
    ).all()
    
    if partial_matches:
        # Return the first match (most likely)
        return partial_matches[0].id
    
    # Try reverse partial match (site_name contains dive site name)
    for dive_site in db.query(DiveSite).all():
        if dive_site.name.lower() in site_name.lower():
            return dive_site.id
    
    # Try similarity matching with threshold
    best_match = None
    best_ratio = 0.0
    threshold = 0.6  # Minimum similarity threshold
    
    for dive_site in db.query(DiveSite).all():
        ratio = similarity_ratio(site_name, dive_site.name)
        if ratio > best_ratio and ratio >= threshold:
            best_ratio = ratio
            best_match = dive_site
    
    if best_match:
        logger.info(f"Found dive site match: '{site_name}' -> '{best_match.name}' (similarity: {best_ratio:.2f})")
        return best_match.id
    
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

def parse_newsletter_with_openai(content: str, db: Session) -> List[dict]:
    """Parse newsletter content using OpenAI API"""
    try:
        # Extract subject and clean content from raw email
        email_message = message_from_bytes(content.encode('utf-8'))
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
        
        # Prepare prompt for OpenAI
        prompt = f"""
Parse the following newsletter content and extract dive trip information. Return a JSON array of dive trips.

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

TRIP STRUCTURE RULES:
- A single dive trip can have 1 or 2 dives
- If the text mentions "Δεύτερη βουτιά" (second dive) or similar, create 2 dives in the same trip
- If the text mentions different dates/times for different trips, create separate trip objects
- Each dive within a trip should have a dive_number (1 for first dive, 2 for second dive)
- Each dive can have its own dive site, time, duration, and description

Field descriptions:
- trip_date: Date of the dive trip (YYYY-MM-DD format, required)
- trip_time: Time of departure (HH:MM format, optional - can be null if not mentioned)
- trip_duration: Total duration in minutes (optional - can be null if not mentioned)
- trip_description: Description of the entire dive trip (required)
- trip_price: Price in euros (optional - can be null if not mentioned)
- trip_currency: Currency code (default: EUR)
- group_size_limit: Maximum number of participants (optional - can be null if not mentioned)
- special_requirements: Any special requirements (optional - can be null if not mentioned)
- dives: Array of dives in this trip
  - dive_number: Number of the dive (1 for first, 2 for second)
  - dive_site_name: Extract the specific dive site name mentioned for this dive. Look for names like "Kyra Leni", "Arzentá", "Pothitos", "Makronisos", "Koundouros", "Patris", "Avantis", "Petrokaravo", etc. (optional - can be null if not mentioned)
  - dive_time: Time for this specific dive (HH:MM format, optional - can be null if not mentioned)
  - dive_duration: Duration for this specific dive in minutes (optional - can be null if not mentioned)
  - dive_description: Description for this specific dive (optional - can be null if not mentioned)

IMPORTANT: For dive_site_name, extract the specific dive site name from the trip description. Common Greek dive sites mentioned include: Kyra Leni, Arzentá, Pothitos, Makronisos, Koundouros, Patris, Avantis, Petrokaravo.

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
            print(f"DEBUG - OpenAI response: {content}")
            
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
                                    dive_site_id = find_matching_dive_site(db, dive['dive_site_name'])
                                    if dive_site_id:
                                        dive['dive_site_id'] = dive_site_id
                                        logger.info(f"Matched dive site: '{dive['dive_site_name']}' -> ID: {dive_site_id}")
                                    else:
                                        logger.info(f"No dive site match found for: '{dive['dive_site_name']}'")
                    
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

def parse_newsletter_content(content: str, db: Session) -> List[dict]:
    """Parse newsletter content using basic regex patterns"""
    try:
        # Extract subject and clean content from raw email
        email_message = message_from_bytes(content.encode('utf-8'))
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
                            matched_id = find_matching_dive_site(db, site_name)
                            if matched_id:
                                dive_site_id = matched_id
                                dive_site_name = site_name
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
    current_user: User = Depends(get_current_user),
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
        
        # Parse the newsletter content
        try:
            if use_openai.lower() == 'true':
                parsed_trips = parse_newsletter_with_openai(content_str, db)
            else:
                parsed_trips = parse_newsletter_content(content_str, db)
            
            created_trips = []
            
            # Create ParsedDiveTrip records
            for trip_data in parsed_trips:
                trip = ParsedDiveTrip(
                    source_newsletter_id=newsletter.id,
                    diving_center_id=trip_data.get('diving_center_id'),
                    trip_date=datetime.strptime(trip_data['trip_date'], '%Y-%m-%d').date() if isinstance(trip_data['trip_date'], str) else trip_data['trip_date'],
                    trip_time=trip_data.get('trip_time'),
                    trip_duration=trip_data.get('trip_duration'),
                    trip_difficulty_level=trip_data.get('trip_difficulty_level'),
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

@router.get("/", response_model=List[NewsletterResponse])
async def get_newsletters(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all newsletters with optional pagination.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can view newsletters")
    
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get parsed dive trips with optional filtering.
    """
    query = db.query(ParsedDiveTrip)
    
    if start_date:
        query = query.filter(ParsedDiveTrip.trip_date >= start_date)
    
    if end_date:
        query = query.filter(ParsedDiveTrip.trip_date <= end_date)
    
    if diving_center_id:
        query = query.filter(ParsedDiveTrip.diving_center_id == diving_center_id)
    
    if dive_site_id:
        query = query.filter(ParsedDiveTrip.dive_site_id == dive_site_id)
    
    if trip_status:
        try:
            status = TripStatus(trip_status)
            query = query.filter(ParsedDiveTrip.trip_status == status)
        except:
            pass  # Invalid status, ignore filter
    
    trips = query.all()
    
    return [
        ParsedDiveTripResponse(
            id=trip.id,
            diving_center_id=trip.diving_center_id,
            trip_date=trip.trip_date,
            trip_time=trip.trip_time,
            trip_duration=trip.trip_duration,
            trip_difficulty_level=trip.trip_difficulty_level.value if trip.trip_difficulty_level else None,
            trip_price=float(trip.trip_price) if trip.trip_price else None,
            trip_currency=trip.trip_currency,
            group_size_limit=trip.group_size_limit,
            current_bookings=trip.current_bookings,
            trip_description=trip.trip_description,
            special_requirements=trip.special_requirements,
            trip_status=trip.trip_status.value,
            diving_center_name=trip.diving_center.name if trip.diving_center else None,
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
        for trip in trips
    ]

@router.get("/{newsletter_id}", response_model=NewsletterResponse)
async def get_newsletter(
    newsletter_id: int,
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        
        # Parse the newsletter content again
        try:
            if use_openai.lower() == 'true':
                parsed_trips = parse_newsletter_with_openai(newsletter.content, db)
            else:
                parsed_trips = parse_newsletter_content(newsletter.content, db)
            
            created_trips = []
            
            # Create new ParsedDiveTrip records
            for trip_data in parsed_trips:
                trip = ParsedDiveTrip(
                    source_newsletter_id=newsletter.id,
                    diving_center_id=trip_data.get('diving_center_id'),
                    trip_date=datetime.strptime(trip_data['trip_date'], '%Y-%m-%d').date() if isinstance(trip_data['trip_date'], str) else trip_data['trip_date'],
                    trip_time=trip_data.get('trip_time'),
                    trip_duration=trip_data.get('trip_duration'),
                    trip_difficulty_level=trip_data.get('trip_difficulty_level'),
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new parsed dive trip manually.
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can create trips")
    
    try:
        trip = ParsedDiveTrip(
            diving_center_id=trip_data.diving_center_id,
            trip_date=trip_data.trip_date,
            trip_time=trip_data.trip_time,
            trip_duration=trip_data.trip_duration,
            trip_difficulty_level=trip_data.trip_difficulty_level,
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
            trip_difficulty_level=trip.trip_difficulty_level.value if trip.trip_difficulty_level else None,
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
    """
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Only admins and moderators can view trips")
    
    trip = db.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return ParsedDiveTripResponse(
        id=trip.id,
        diving_center_id=trip.diving_center_id,
        trip_date=trip.trip_date,
        trip_time=trip.trip_time,
        trip_duration=trip.trip_duration,
        trip_difficulty_level=trip.trip_difficulty_level.value if trip.trip_difficulty_level else None,
        trip_price=float(trip.trip_price) if trip.trip_price else None,
        trip_currency=trip.trip_currency,
        group_size_limit=trip.group_size_limit,
        current_bookings=trip.current_bookings,
        trip_description=trip.trip_description,
        special_requirements=trip.special_requirements,
        trip_status=trip.trip_status.value,
        diving_center_name=trip.diving_center.name if trip.diving_center else None,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        if trip_data.trip_difficulty_level is not None:
            trip.trip_difficulty_level = trip_data.trip_difficulty_level
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
            trip_difficulty_level=trip.trip_difficulty_level.value if trip.trip_difficulty_level else None,
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