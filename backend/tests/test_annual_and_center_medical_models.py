import pytest
from datetime import datetime, timezone, timedelta
from app.models import User, DivingCenter, UserMedicalProfile, CenterDiverMedicalApproval
from sqlalchemy.exc import IntegrityError


def test_user_medical_profile_model(db_session, test_user):
    now = datetime.now(timezone.utc)
    profile = UserMedicalProfile(
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek="test-encrypted-dek-base64",
        encrypted_answers=b"test-encrypted-answers-bytes",
        completed_at=now,
        expires_at=now + timedelta(days=365),
        audit_signature_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)

    assert profile.id is not None
    assert profile.status == "CLEARED"
    assert profile.user.id == test_user.id
    assert test_user.annual_medical_profile.id == profile.id


def test_center_diver_medical_approval_model(db_session, test_user, test_admin_user, test_diving_center):
    now = datetime.now(timezone.utc)
    approval = CenterDiverMedicalApproval(
        diving_center_id=test_diving_center.id,
        user_id=test_user.id,
        approved_by_user_id=test_admin_user.id,
        physician_name="Dr. Marina Sotiropoulou",
        physician_clinic="Athens Hyperbaric & Dive Medicine Clinic",
        approval_notes="Approved for recreational diving up to 30m with prophylactic inhaler.",
        approved_at=now,
        expires_at=now + timedelta(days=365),
    )
    db_session.add(approval)
    db_session.commit()
    db_session.refresh(approval)

    assert approval.id is not None
    assert approval.diving_center.id == test_diving_center.id
    assert approval.user.id == test_user.id
    assert approval.approved_by_user.id == test_admin_user.id
    assert "Athens Hyperbaric" in approval.physician_clinic


def test_center_diver_medical_approval_unique_constraint(db_session, test_user, test_admin_user, test_diving_center):
    now = datetime.now(timezone.utc)
    app1 = CenterDiverMedicalApproval(
        diving_center_id=test_diving_center.id,
        user_id=test_user.id,
        approved_by_user_id=test_admin_user.id,
        physician_name="Dr. A",
        approved_at=now,
        expires_at=now + timedelta(days=365),
    )
    db_session.add(app1)
    db_session.commit()

    # Attempt to insert duplicate approval for same center and user
    app2 = CenterDiverMedicalApproval(
        diving_center_id=test_diving_center.id,
        user_id=test_user.id,
        approved_by_user_id=test_admin_user.id,
        physician_name="Dr. B",
        approved_at=now,
        expires_at=now + timedelta(days=365),
    )
    db_session.add(app2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
