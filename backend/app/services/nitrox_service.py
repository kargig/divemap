from typing import Optional
from sqlalchemy.orm import Session
from app.models import CertificationLevel, UserCertification

NITROX_KEYWORDS = [
    "nitrox",
    "ean",
    "enriched air",
    "tec",
    "trimix",
    "advanced open water",
    "aowd",
    "rescue",
    "divemaster",
    "instructor",
    "owsi",
    "msdt",
    "fundies",
    "fundamentals",
    "extended range",
    "xr",
]


def check_nitrox_eligibility(
    cert_level: Optional[str],
    gas_mix_id: Optional[str],
    db_session: Session,
    user_id: Optional[int] = None,
) -> bool:
    """Verifies that a diver holds a qualifying certification before breathing Enriched Air Nitrox (>21% O2).

    Checks:
    1. If gas mix is air -> True
    2. If cert_level matches known nitrox/technical/advanced levels -> True
    3. If level in DB has gases column containing 'nitrox' -> True
    4. If user_id provided, checks if user has an Enriched Air/Nitrox certification in UserCertification table -> True
    """
    if not gas_mix_id or gas_mix_id.lower() == "air":
        return True

    if cert_level:
        cl = cert_level.lower()
        if any(k in cl for k in NITROX_KEYWORDS):
            return True

        # Check CertificationLevel table
        level = db_session.query(CertificationLevel).filter(
            CertificationLevel.name.ilike(cert_level)
        ).first()
        if level and level.gases and "nitrox" in level.gases.lower():
            return True

    # If user is logged in, check all their saved user_certifications
    if user_id:
        user_certs = db_session.query(UserCertification).filter(
            UserCertification.user_id == user_id
        ).all()
        for uc in user_certs:
            if (
                uc.certification_level_link
                and uc.certification_level_link.gases
                and "nitrox" in uc.certification_level_link.gases.lower()
            ):
                return True
            if uc.certification_level_name:
                cl_user = uc.certification_level_name.lower()
                if any(k in cl_user for k in NITROX_KEYWORDS):
                    return True

    return False
