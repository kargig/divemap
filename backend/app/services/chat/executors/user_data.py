from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
import logging
from app.models import Dive, DiveSite, User

logger = logging.getLogger(__name__)

def execute_get_user_dive_logs(
    db: Session,
    current_user: Optional[User] = None,
    limit: int = 5,
    dive_site_name: Optional[str] = None,
    **kwargs
) -> List[Dict]:
    results = []
    
    if not current_user:
        return [{
            "entity_type": "system_message",
            "error": "User is not logged in. Cannot fetch dive logs."
        }]

    query = db.query(Dive).filter(Dive.user_id == current_user.id)

    if dive_site_name:
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id, isouter=True)
        query = query.filter(DiveSite.name.ilike(f"%{dive_site_name}%"))

    query = query.order_by(Dive.dive_date.desc())
    dives = query.limit(limit).all()

    for dive in dives:
        site_name = dive.dive_site.name if dive.dive_site else "Unknown Site"
        results.append({
            "entity_type": "dive_log",
            "id": dive.id,
            "date": str(dive.dive_date) if dive.dive_date else None,
            "site": site_name,
            "max_depth": float(dive.max_depth) if dive.max_depth else None,
            "duration_minutes": dive.duration,
            "gas_used": dive.gas_bottles_used,
            "dive_information": dive.dive_information
        })

    if not results:
        return [{
            "entity_type": "system_message",
            "message": "No dive logs found for the user matching the given criteria."
        }]

    return results