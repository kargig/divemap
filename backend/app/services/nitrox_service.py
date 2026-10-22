from sqlalchemy.orm import Session

from app.models import CertificationLevel, UserCertification

NITROX_KEYWORDS = [
    "nitrox",
    "ean",
    "enriched air",
    "safeair",
    "tec",
    "technical",
    "trimix",
    "helitrox",
    "triox",
    "extended range",
    "xr",
    "fundies",
    "fundamentals",
    "rebreather",
    "ccr",
    "decompression",
]


def check_nitrox_eligibility(
    cert_level: str | None,
    gas_mix_id: str | None,
    db_session: Session,
    user_id: int | None = None,
) -> bool:
    """Verifies that a diver holds a qualifying certification before breathing Enriched Air Nitrox (>21% O2).

    Specification-driven check hierarchy:
    1. If gas mix is air -> True
    2. Check CertificationLevel database table for cert_level gases specification.
    3. If level name matches specialized nitrox or technical keywords -> True.
    4. If user_id is provided, check if ANY active certification in the user's portfolio permits Nitrox.
    """
    if not gas_mix_id or gas_mix_id.lower() == "air":
        return True

    # 1. Specification lookup: inspect CertificationLevel.gases
    if cert_level:
        level = (
            db_session.query(CertificationLevel)
            .filter(CertificationLevel.name.ilike(cert_level.strip()))
            .first()
        )
        if level and level.gases:
            lg = level.gases.lower()
            if any(k in lg for k in ["nitrox", "safeair", "o2", "trimix", "triox"]):
                return True

        cl = cert_level.lower()
        if any(k in cl for k in NITROX_KEYWORDS):
            return True

    # 2. Portfolio lookup: check all active user certifications
    if user_id:
        user_certs = (
            db_session.query(UserCertification)
            .filter(
                UserCertification.user_id == user_id,
                UserCertification.is_active.is_(True),
            )
            .all()
        )
        for uc in user_certs:
            if uc.certification_level_link and uc.certification_level_link.gases:
                lg = uc.certification_level_link.gases.lower()
                if any(k in lg for k in ["nitrox", "safeair", "o2", "trimix", "triox"]):
                    return True
            if uc.certification_level:
                cl_user = uc.certification_level.lower()
                if any(k in cl_user for k in NITROX_KEYWORDS):
                    return True

    return False
