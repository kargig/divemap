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


def gases_permit_nitrox(gases_str: str | None) -> bool:
    """Returns True if the gases specification explicitly grants Nitrox or qualifying mixed gas.

    Rejects bare 'Air', 'Compressed Air (21% O2)', or generic mentions of oxygen.
    """
    if not gases_str:
        return False
    lg = gases_str.lower()
    if any(
        k in lg for k in ["nitrox", "safeair", "trimix", "triox", "helitrox", "heliox"]
    ):
        return True
    if "o2" in lg or "oxygen" in lg:
        # Reject standard air notations such as "Air (21% O2)"
        if "21%" in lg and not any(
            k in lg for k in ["40%", "50%", "100%", "deco", "stage"]
        ):
            return False
        if any(
            k in lg for k in ["40%", "50%", "100%", "deco", "pure o2", "stage", "/ o2"]
        ):
            return True
    return False


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
        if level and gases_permit_nitrox(level.gases):
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
            if uc.certification_level_link and gases_permit_nitrox(
                uc.certification_level_link.gases
            ):
                return True
            if uc.certification_level:
                cl_user = uc.certification_level.lower()
                if any(k in cl_user for k in NITROX_KEYWORDS):
                    return True

    return False
