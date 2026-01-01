from fastapi import Request
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import orjson


def is_diving_center_reviews_enabled(db: Session) -> bool:
    """
    Check if diving center reviews (comments and ratings) are enabled.
    Returns True if reviews are enabled (setting is false/disabled), False otherwise.
    
    Args:
        db: Database session
        
    Returns:
        bool: True if reviews are enabled, False if disabled
    """
    from app.models import Setting
    
    setting = db.query(Setting).filter(Setting.key == "disable_diving_center_reviews").first()
    if not setting:
        # Default to enabled if setting doesn't exist
        return True
    
    try:
        # Parse JSON boolean value using orjson for performance
        value = orjson.loads(setting.value)
        # Setting is "disable_diving_center_reviews", so if value is True, reviews are disabled
        return not bool(value)
    except (orjson.JSONDecodeError, ValueError):
        # If value is not a valid boolean, default to enabled
        return True


def get_client_ip(request: Request) -> str:
    """
    Get the client's real IP address checking headers in order of preference:
    1. Fly-Client-IP (Fly.io specific)
    2. CF-Connecting-IP (Cloudflare)
    3. X-Real-IP (Nginx, Apache)
    4. X-Forwarded-For (Standard proxy header)
    5. True-Client-IP (Akamai, Cloudflare)
    6. X-Client-IP (Custom proxy headers)
    7. request.client.host (Direct connection)
    8. request.remote_addr (Fallback)

    This function handles various proxy and load balancer configurations
    to ensure we get the actual client IP address for security, logging,
    and rate limiting purposes.

    Args:
        request: FastAPI Request object

    Returns:
        str: Client IP address or "-" if unable to determine

    Example:
        client_ip = get_client_ip(request)
        print(f"Request from IP: {client_ip}")
    """
    # Check Fly.io specific header first
    if 'Fly-Client-IP' in request.headers:
        return request.headers['Fly-Client-IP']

    # Check Cloudflare header
    elif 'CF-Connecting-IP' in request.headers:
        return request.headers['CF-Connecting-IP']

    # Check X-Real-IP header (common with Nginx, Apache)
    elif 'X-Real-IP' in request.headers:
        return request.headers['X-Real-IP']

    # Check X-Forwarded-For header (standard proxy header)
    elif 'X-Forwarded-For' in request.headers:
        # Get the first IP from the list (client's original IP)
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
        # We ALWAYS take only the leftmost IP as the real client IP
        # This prevents IP spoofing and ensures consistent behavior
        forwarded_for = request.headers['X-Forwarded-For']
        # Split by comma and take the first (leftmost) IP
        first_ip = forwarded_for.split(',')[0].strip()
        return first_ip

    # Check True-Client-IP (Akamai, Cloudflare)
    elif 'True-Client-IP' in request.headers:
        return request.headers['True-Client-IP']

    # Check X-Client-IP (custom proxy headers)
    elif 'X-Client-IP' in request.headers:
        return request.headers['X-Client-IP']

    # Check request.client.host (FastAPI's client host)
    elif hasattr(request, 'client') and request.client and request.client.host:
        return request.client.host

    # Fallback to request.remote_addr if available
    elif hasattr(request, 'remote_addr') and request.remote_addr:
        return request.remote_addr

    # If all else fails, return a placeholder
    else:
        return "-"


def get_client_ip_with_headers(request: Request) -> dict:
    """
    Get the client's IP address along with all relevant headers for debugging.
    
    This function is useful for debugging proxy configurations and understanding
    how the client IP is being forwarded through various layers.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        dict: Dictionary containing client IP and relevant headers
        
    Example:
        ip_info = get_client_ip_with_headers(request)
        print(f"Client IP: {ip_info['client_ip']}")
        print(f"Headers: {ip_info['headers']}")
    """
    client_ip = get_client_ip(request)
    
    # Collect relevant headers for debugging
    relevant_headers = {}
    header_names = [
        'Fly-Client-IP',
        'X-Real-IP', 
        'X-Forwarded-For',
        'X-Forwarded-Proto',
        'X-Forwarded-Host',
        'CF-Connecting-IP',  # Cloudflare
        'True-Client-IP',    # Akamai
        'X-Client-IP'        # Custom
    ]
    
    for header_name in header_names:
        if header_name in request.headers:
            relevant_headers[header_name] = request.headers[header_name]
    
    # Add client connection info
    connection_info = {}
    if hasattr(request, 'client') and request.client:
        connection_info['client_host'] = getattr(request.client, 'host', None)
        connection_info['client_port'] = getattr(request.client, 'port', None)
    
    return {
        'client_ip': client_ip,
        'headers': relevant_headers,
        'connection': connection_info,
        'method': request.method,
        'url': str(request.url)
    }


def is_localhost_ip(ip_address: str) -> bool:
    """
    Check if an IP address is a localhost address.
    
    Args:
        ip_address: IP address string to check
        
    Returns:
        bool: True if localhost, False otherwise
        
    Example:
        if is_localhost_ip(client_ip):
            print("Request from localhost")
    """
    localhost_ips = [
        "127.0.0.1",      # IPv4 localhost
        "::1",            # IPv6 localhost
        "localhost",      # Hostname
        "0.0.0.0",       # IPv4 unspecified
        "::",             # IPv6 unspecified
    ]
    
    return ip_address in localhost_ips


def is_private_ip(ip_address: str) -> bool:
    """
    Check if an IP address is in a private network range.
    
    Args:
        ip_address: IP address string to check
        
    Returns:
        bool: True if private IP, False otherwise
        
    Example:
        if is_private_ip(client_ip):
            print("Request from private network")
    """
    # Simple check for common private IP ranges
    # This is a basic implementation - for production use,
    # consider using ipaddress module for more robust checking
    
    if ip_address == "-" or not ip_address:
        return False
    
    # IPv4 private ranges
    if ip_address.startswith(("10.", "192.168.", "172.")):
        return True
    
    # IPv6 private ranges (simplified)
    if ip_address.startswith(("fc00:", "fd00:", "fe80:", "fdaa:")):
        return True
    
    return False


def format_ip_for_logging(client_ip: str, include_private: bool = False) -> str:
    """
    Format IP address for logging, optionally masking private IPs.
    
    Args:
        client_ip: Client IP address
        include_private: Whether to include private IPs in full
        
    Returns:
        str: Formatted IP address for logging
        
    Example:
        log_ip = format_ip_for_logging(client_ip, include_private=False)
        logger.info(f"Request from {log_ip}")
    """
    if not client_ip or client_ip == "-":
        return "unknown"
    
    if is_localhost_ip(client_ip):
        return "localhost"
    
    if is_private_ip(client_ip) and not include_private:
        # Mask private IPs for privacy in logs
        if "." in client_ip:  # IPv4
            parts = client_ip.split(".")
            return f"{parts[0]}.{parts[1]}.*.*"
        else:  # IPv6
            return "private-ipv6"
    
    return client_ip


# Unified search scoring utilities for fuzzy search across all content types
import difflib
from typing import Optional, List


# Unified typo tolerance settings
UNIFIED_TYPO_TOLERANCE = {
    'word_similarity': 0.7,      # 70% similarity for individual words
    'single_word': 0.8,          # 80% similarity for single-word queries
    'phrase_similarity': 0.7,    # 70% similarity for multi-word phrases
    'overall_threshold': 0.2,    # Overall similarity threshold for fuzzy results
}


def calculate_unified_phrase_aware_score(
    query: str,
    primary_name: str,
    description: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    city: Optional[str] = None,
    tags: Optional[List[str]] = None,
    additional_fields: Optional[dict] = None
) -> float:
    """
    Unified phrase-aware scoring function for all content types.
    
    This function provides consistent scoring logic across dive sites, diving centers,
    dives, and dive trips, ensuring a uniform user experience.
    
    Args:
        query: The search query string
        primary_name: The primary name field (e.g., site name, center name)
        description: Description field (optional)
        country: Country field (optional)
        region: Region field (optional)
        city: City field (optional)
        additional_fields: Dict of additional field names and values (optional)
    
    Returns:
        Float score between 0.0 and 1.0, where higher is more relevant
    """
    query_lower = query.lower()
    name_lower = primary_name.lower()
    desc_lower = (description or "").lower()
    country_lower = (country or "").lower()
    region_lower = (region or "").lower()
    city_lower = (city or "").lower()
    
    # 1. Exact phrase match (highest priority)
    if query_lower in name_lower:
        return 1.0
    
    # 2. Word-by-word matching across all fields (with unified typo tolerance)
    query_words = query_lower.split()
    name_words = name_lower.split()
    city_words = city_lower.split()
    region_words = region_lower.split()
    country_words = country_lower.split()
    
    # Count how many query words appear in any relevant field (with fuzzy matching)
    matching_words = 0
    for query_word in query_words:
        # Check for exact substring match first in any field
        if (any(query_word in name_word for name_word in name_words) or
            any(query_word in city_word for city_word in city_words) or
            any(query_word in region_word for region_word in region_words) or
            any(query_word in country_word for country_word in country_words)):
            matching_words += 1
        else:
            # Check for fuzzy similarity using unified threshold across all fields
            found_match = False
            # Check name field
            for name_word in name_words:
                if difflib.SequenceMatcher(None, query_word, name_word).ratio() >= UNIFIED_TYPO_TOLERANCE['word_similarity']:
                    matching_words += 1
                    found_match = True
                    break
            
            # Check city field if no match found in name
            if not found_match:
                for city_word in city_words:
                    if difflib.SequenceMatcher(None, query_word, city_word).ratio() >= UNIFIED_TYPO_TOLERANCE['word_similarity']:
                        matching_words += 1
                        found_match = True
                        break
            
            # Check region field if no match found yet
            if not found_match:
                for region_word in region_words:
                    if difflib.SequenceMatcher(None, query_word, region_word).ratio() >= UNIFIED_TYPO_TOLERANCE['word_similarity']:
                        matching_words += 1
                        found_match = True
                        break
            
            # Check country field if no match found yet
            if not found_match:
                for country_word in country_words:
                    if difflib.SequenceMatcher(None, query_word, country_word).ratio() >= UNIFIED_TYPO_TOLERANCE['word_similarity']:
                        matching_words += 1
                        break
    
    word_match_ratio = matching_words / len(query_words)
    
    # 3. Consecutive word bonus (for "blue hole" in "bluehole reef")
    consecutive_bonus = 0.0
    if len(query_words) > 1:
        # Check if words appear consecutively (even if concatenated)
        query_phrase = ''.join(query_words)
        if query_phrase in name_lower.replace(' ', ''):
            consecutive_bonus = 0.3
        else:
            # Check for fuzzy similarity of concatenated phrase
            name_no_spaces = name_lower.replace(' ', '')
            if difflib.SequenceMatcher(None, query_phrase, name_no_spaces).ratio() >= UNIFIED_TYPO_TOLERANCE['phrase_similarity']:
                consecutive_bonus = 0.2
    
    # 4. Geographic field matching (country, region, and city)
    geographic_bonus = 0.0
    if country_lower and query_lower in country_lower:
        geographic_bonus += 0.2
    if region_lower and query_lower in region_lower:
        geographic_bonus += 0.2
    if city_lower and query_lower in city_lower:
        geographic_bonus += 0.2
    
    # 5. Tag matching (high priority for specialized searches)
    tag_bonus = 0.0
    if tags:
        for tag in tags:
            tag_lower = tag.lower()
            if query_lower in tag_lower:
                tag_bonus += 0.3  # High bonus for tag matches
                break
            # Also check for word-by-word matching in tags
            for query_word in query_words:
                if query_word in tag_lower:
                    tag_bonus += 0.2
                    break
    
    # 6. Traditional similarity for edge cases
    similarity_score = difflib.SequenceMatcher(None, query_lower, name_lower).ratio()
    
    # 7. Weighted final score (unified across all content types)
    final_score = (
        word_match_ratio * 0.5 +      # Word matching (50%)
        consecutive_bonus +            # Consecutive bonus
        geographic_bonus +             # Geographic bonus
        tag_bonus +                    # Tag bonus
        similarity_score * 0.2 +      # Traditional similarity (20%)
        (0.1 if query_lower in desc_lower else 0.0)  # Description bonus (10%)
    )
    
    # 7. Special case: if it's a single word and has high similarity to any name word, boost the score
    if len(query_words) == 1 and len(name_words) > 0:
        best_word_similarity = max(
            difflib.SequenceMatcher(None, query_words[0], name_word).ratio()
            for name_word in name_words
        )
        if best_word_similarity >= UNIFIED_TYPO_TOLERANCE['single_word']:
            final_score = max(final_score, best_word_similarity * 0.8)
    
    # 8. Additional fields bonus (for content-specific fields)
    if additional_fields:
        for field_name, field_value in additional_fields.items():
            if field_value and query_lower in str(field_value).lower():
                final_score += 0.05  # Small bonus for additional field matches
    
    return min(final_score, 1.0)


def classify_match_type(score: float) -> str:
    """
    Unified match type classification for all content types.
    
    Args:
        score: The calculated similarity score (0.0 to 1.0)
    
    Returns:
        String representing the match type
    """
    if score >= 0.9:
        return 'exact_phrase'      # Exact phrase match
    elif score >= 0.7:
        return 'exact_words'       # All words found
    elif score >= 0.5:
        return 'partial_words'     # Some words found
    elif score >= 0.3:
        return 'similar'           # High similarity
    else:
        return 'fuzzy'             # Low similarity


def get_unified_fuzzy_trigger_conditions(
    search_query: str,
    exact_result_count: int,
    max_exact_results: int = 5,
    max_query_length: int = 10
) -> bool:
    """
    Unified fuzzy search trigger conditions for all content types.
    
    Args:
        search_query: The search query string
        exact_result_count: Number of results from exact search
        max_exact_results: Maximum exact results before triggering fuzzy search
        max_query_length: Maximum query length before triggering fuzzy search
    
    Returns:
        Boolean indicating whether fuzzy search should be triggered
    """
    return (
        search_query and (
            exact_result_count < max_exact_results or
            len(search_query.strip()) <= max_query_length or
            ' ' in search_query.strip()  # Multi-word queries
        )
    )


# Notification defaults for users
# Default notification categories that should be enabled for all users
DEFAULT_NOTIFICATION_CATEGORIES = [
    'new_dive_sites',
    'new_dive_trips',
    'admin_alerts'
]

# Opt-in categories (users must manually enable these)
OPT_IN_CATEGORIES = [
    'new_dives',
    'new_diving_centers'
]


def create_default_notification_preferences(user_id: int, db: Session) -> list:
    """
    Create default notification preferences for a user.
    
    Args:
        user_id: User ID to create preferences for
        db: Database session
    
    Returns:
        List of created NotificationPreference instances
    """
    from app.models import NotificationPreference
    
    created_preferences = []
    
    for category in DEFAULT_NOTIFICATION_CATEGORIES:
        # Check if preference already exists
        existing = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.category == category
        ).first()
        
        if existing:
            continue  # Skip if already exists
        
        # Create default preference
        preference = NotificationPreference(
            user_id=user_id,
            category=category,
            enable_website=True,  # Website notifications enabled by default
            enable_email=False,  # Email notifications disabled by default
            frequency='immediate',  # Immediate notifications
            area_filter=None  # No area filtering (all areas)
        )
        
        db.add(preference)
        created_preferences.append(preference)
    
    if created_preferences:
        db.commit()
        # Refresh all created preferences
        for pref in created_preferences:
            db.refresh(pref)
    
    return created_preferences


def utcnow() -> datetime:
    """
    Get current UTC datetime as timezone-aware datetime object.
    
    This is the recommended way to get UTC time in Python 3.9+.
    Replaces deprecated datetime.utcnow() which returns naive datetime.
    
    Returns:
        datetime: Current UTC time as timezone-aware datetime
    """
    return datetime.now(timezone.utc) 
