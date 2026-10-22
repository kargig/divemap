from app.models import CertificationLevel, DivingOrganization, User, UserCertification
from app.services.nitrox_service import check_nitrox_eligibility, gases_permit_nitrox


def test_gases_permit_nitrox_rejects_standard_air():
    assert gases_permit_nitrox("Air") is False
    assert gases_permit_nitrox("Compressed Air (21% O2)") is False
    assert gases_permit_nitrox("Air (21% O2)") is False
    assert gases_permit_nitrox("") is False
    assert gases_permit_nitrox(None) is False


def test_gases_permit_nitrox_accepts_qualifying_mixes():
    assert gases_permit_nitrox("Nitrox up to 40% O2") is True
    assert gases_permit_nitrox("SafeAir (Nitrox) 22-40%") is True
    assert gases_permit_nitrox("Hypoxic Trimix / multiple stages / O2") is True
    assert gases_permit_nitrox("Air / Nitrox / O2 for deco") is True
    assert gases_permit_nitrox("100% O2") is True


def test_check_nitrox_eligibility_with_portfolio(db_session):
    org = DivingOrganization(name="Test Agency Nitrox", acronym="TAN")
    db_session.add(org)
    db_session.flush()

    user = User(
        username="nitrox_diver",
        email="nitrox_diver@example.com",
        password_hash="test",
    )
    db_session.add(user)
    db_session.flush()

    # User has portfolio cert with Nitrox
    nitrox_level = CertificationLevel(
        diving_organization_id=org.id,
        name="Enriched Air Nitrox Specialist",
        gases="Nitrox up to 40% O2",
    )
    db_session.add(nitrox_level)
    db_session.flush()

    user_cert = UserCertification(
        user_id=user.id,
        diving_organization_id=org.id,
        certification_level_id=nitrox_level.id,
        certification_level="Enriched Air Nitrox Specialist",
        is_active=True,
    )
    db_session.add(user_cert)
    db_session.commit()

    # When querying with primary cert "Open Water Diver" (Air only), but providing user_id:
    # Portfolio lookup should grant eligibility
    assert (
        check_nitrox_eligibility(
            "Open Water Diver", "ean32", db_session, user_id=user.id
        )
        is True
    )

    # Without user_id, "Open Water Diver" alone must not qualify
    assert (
        check_nitrox_eligibility("Open Water Diver", "ean32", db_session, user_id=None)
        is False
    )
