from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging
from app.models import DiveSite, DivingCenter, SiteComment, SiteRating, CenterComment, CenterRating
from app.utils import is_diving_center_reviews_enabled

logger = logging.getLogger(__name__)

def execute_get_reviews_and_comments(
    db: Session,
    entity_type: str,
    entity_name: str,
    **kwargs
) -> List[Dict]:
    results = []

    if entity_type == "diving_center":
        # Respect global setting
        if not is_diving_center_reviews_enabled(db):
            return [{
                "entity_type": "system_message",
                "error": "Reviews and ratings for diving centers are disabled by the system administrator."
            }]

        center = db.query(DivingCenter).filter(DivingCenter.name.ilike(f"%{entity_name}%")).first()
        if not center:
            return [{
                "entity_type": "system_message",
                "error": f"Diving center '{entity_name}' not found."
            }]

        comments = db.query(CenterComment).filter(CenterComment.diving_center_id == center.id).order_by(CenterComment.created_at.desc()).limit(10).all()
        avg_rating = db.query(func.avg(CenterRating.score)).filter(CenterRating.diving_center_id == center.id).scalar()

        results.append({
            "entity_type": "diving_center_reviews",
            "target_name": center.name,
            "average_rating": float(avg_rating) if avg_rating else None,
            "recent_comments": [c.comment_text for c in comments]
        })

    elif entity_type == "dive_site":
        site = db.query(DiveSite).filter(DiveSite.name.ilike(f"%{entity_name}%")).first()
        if not site:
            return [{
                "entity_type": "system_message",
                "error": f"Dive site '{entity_name}' not found."
            }]

        comments = db.query(SiteComment).filter(SiteComment.dive_site_id == site.id).order_by(SiteComment.created_at.desc()).limit(10).all()
        avg_rating = db.query(func.avg(SiteRating.score)).filter(SiteRating.dive_site_id == site.id).scalar()

        results.append({
            "entity_type": "dive_site_reviews",
            "target_name": site.name,
            "average_rating": float(avg_rating) if avg_rating else None,
            "recent_comments": [c.comment_text for c in comments]
        })
    else:
        return clean_results([{
            "entity_type": "system_message",
            "error": "Invalid entity_type. Must be 'dive_site' or 'diving_center'."
        }])

    return clean_results(results)