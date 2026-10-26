from app.models import CertificationLevel, DivingOrganization, User, UserCertification
from app.services.nitrox_service import (
    check_nitrox_eligibility,
    gases_permit_nitrox,
    is_instructor_certification,
)


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


def test_is_instructor_certification():
    # Instructor qualifications (de facto Nitrox certified under SSI / ISO 24802 standards)
    assert is_instructor_certification("Open Water Instructor") is True
    assert is_instructor_certification("Assistant Instructor") is True
    assert is_instructor_certification("Open Water Scuba Instructor (OWSI)") is True
    assert is_instructor_certification("OWSI") is True
    assert is_instructor_certification("Master Scuba Diver Trainer (MSDT)") is True
    assert is_instructor_certification("MSDT") is True
    assert is_instructor_certification("IDC Staff Instructor") is True
    assert is_instructor_certification("Master Instructor") is True
    assert is_instructor_certification("Course Director") is True
    assert is_instructor_certification("PADI OWSI #123456") is True

    # Qualifications up to Divemaster (NOT instructors - require separate Nitrox cert)
    assert is_instructor_certification("Divemaster") is False
    assert is_instructor_certification("SSI Divemaster") is False
    assert is_instructor_certification("Dive Guide") is False
    assert is_instructor_certification("Master Scuba Diver") is False
    assert is_instructor_certification("Master Diver") is False
    assert is_instructor_certification("Rescue Diver") is False
    assert is_instructor_certification("Advanced Open Water Diver (AOWD)") is False
    assert is_instructor_certification("Open Water Diver (OWD)") is False
    assert is_instructor_certification("Scuba Diver") is False
    assert is_instructor_certification("") is False
    assert is_instructor_certification(None) is False


def test_check_nitrox_eligibility_for_instructors(db_session):
    # Instructors are de facto Nitrox eligible even without portfolio or explicit gases in DB
    assert (
        check_nitrox_eligibility(
            "Open Water Instructor", "ean32", db_session, user_id=None
        )
        is True
    )
    assert (
        check_nitrox_eligibility(
            "Assistant Instructor", "ean32", db_session, user_id=None
        )
        is True
    )
    assert (
        check_nitrox_eligibility(
            "Open Water Scuba Instructor (OWSI)", "ean32", db_session, user_id=None
        )
        is True
    )
    assert (
        check_nitrox_eligibility("Course Director", "ean32", db_session, user_id=None)
        is True
    )

    # Certifications up to Divemaster are NOT de facto Nitrox eligible without portfolio/spec
    assert (
        check_nitrox_eligibility("Divemaster", "ean32", db_session, user_id=None)
        is False
    )
    assert (
        check_nitrox_eligibility("Dive Guide", "ean32", db_session, user_id=None)
        is False
    )
    assert (
        check_nitrox_eligibility("Rescue Diver", "ean32", db_session, user_id=None)
        is False
    )


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
