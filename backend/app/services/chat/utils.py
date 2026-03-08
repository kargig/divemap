import logging
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from app.models import UserCertification

logger = logging.getLogger(__name__)

def degrees_to_cardinal(d):
    """
    Convert degrees to cardinal direction (N, NE, E, etc.)
    """
    if d is None:
        return "Unknown"
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    ix = round(d / (360. / len(dirs)))
    return dirs[ix % len(dirs)]

def get_user_difficulty_level(db: Session, user_id: int) -> int:
    """
    Get the user's max difficulty level based on certifications.
    Returns 1-4.
    """
    try:
        certs = db.query(UserCertification).options(
            joinedload(UserCertification.certification_level_link)
        ).filter(UserCertification.user_id == user_id).all()

        max_level = 1
        for cert in certs:
            current_cert_level = 1
            cert_name_str = cert.certification_level.lower() if cert.certification_level else ""

            if cert.certification_level_link:
                name = cert.certification_level_link.name.lower() if cert.certification_level_link.name else ""
                depth = cert.certification_level_link.max_depth.lower() if cert.certification_level_link.max_depth else ""

                if "technical" in name or "trimix" in name or "cave" in name:
                    current_cert_level = 4
                elif "rescue" in name or "master" in name or "deep" in name:
                    current_cert_level = 3
                elif "advanced" in name or "aow" in name:
                    current_cert_level = 2

                # Check depth if name wasn't decisive
                if current_cert_level < 3 and ("40m" in depth or "45m" in depth):
                     current_cert_level = max(current_cert_level, 3)
                elif current_cert_level < 2 and "30m" in depth:
                     current_cert_level = max(current_cert_level, 2)

            # Fallback to string matching on cert.certification_level if link is missing or lower
            if current_cert_level < 4 and ("xr" in cert_name_str or "technical" in cert_name_str or "trimix" in cert_name_str or "tx" in cert_name_str or "cave" in cert_name_str):
                current_cert_level = 4
            elif current_cert_level < 3 and ("rescue" in cert_name_str or "master" in cert_name_str or "deep" in cert_name_str or "dm" in cert_name_str):
                current_cert_level = 3
            elif current_cert_level < 2 and ("advanced" in cert_name_str or "aow" in cert_name_str):
                current_cert_level = 2

            max_level = max(max_level, current_cert_level)

        return max_level
    except Exception as e:
        logger.error(f"Error getting user difficulty: {e}")
        return 1
