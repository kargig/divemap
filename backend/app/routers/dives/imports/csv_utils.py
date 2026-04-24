import re
import nh3
from typing import Optional, Tuple
from datetime import date, time
from dateutil import parser

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

def parse_csv_date_time(value: str) -> Tuple[Optional[date], Optional[time]]:
    """
    Intelligently parse date and time from various CSV formats.
    """
    if not value:
        return None, None
        
    try:
        # dateutil.parser is very robust. dayfirst=True is safer for international formats.
        dt = parser.parse(value, dayfirst=True)
        return (dt.date(), dt.time())
    except (ValueError, TypeError, OverflowError):
        return (None, None)
