from app.models import EntityAuditLog, PersonalAccessToken, User, UserCertification


def test_entity_audit_log_model_creation(db_session, test_user):
    log = EntityAuditLog(
        entity_type="dive_site",
        entity_id=101,
        action="create",
        user_id=test_user.id,
        user_role="user",
        auth_method="jwt",
        client_type="web",
        changes={"snapshot": {"name": "Test Site"}},
    )
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    assert log.id is not None
    assert log.entity_type == "dive_site"
    assert log.changes["snapshot"]["name"] == "Test Site"


def test_user_certification_card_id(db_session, test_user):
    from datetime import date

    from app.models import DivingOrganization

    org = db_session.query(DivingOrganization).first()
    cert = UserCertification(
        user_id=test_user.id,
        diving_organization_id=org.id,
        certification_level="Open Water Diver",
        card_id="PADI-987654321",
        certification_date=date(2021, 6, 15),
    )
    db_session.add(cert)
    db_session.commit()
    db_session.refresh(cert)
    assert cert.card_id == "PADI-987654321"
    assert cert.certification_date == date(2021, 6, 15)
