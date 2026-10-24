from app.models import (
    AvailableTag,
    CenterComment,
    DivingCenter,
    DivingOrganization,
    EntityAuditLog,
    OwnershipRequest,
    Setting,
    SiteComment,
    UserCertification,
)


def test_user_certification_audit_logging(client, auth_headers, test_user, db_session):
    org = db_session.query(DivingOrganization).first()
    res = client.post(
        "/api/v1/user-certifications/my-certifications",
        json={
            "diving_organization_id": org.id,
            "certification_level": "Rescue Diver",
            "card_id": "RESCUE-007",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    cert_id = res.json()["id"]

    audit_create = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="user_certification", entity_id=cert_id, action="create")
        .first()
    )
    assert audit_create is not None
    assert audit_create.changes["snapshot"]["card_id"] == "RESCUE-007"

    # Update
    res_up = client.put(
        f"/api/v1/user-certifications/my-certifications/{cert_id}",
        json={"card_id": "RESCUE-008"},
        headers=auth_headers,
    )
    assert res_up.status_code == 200

    audit_up = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="user_certification", entity_id=cert_id, action="update")
        .first()
    )
    assert audit_up is not None
    assert audit_up.changes["changed_fields"] == ["card_id"]
    assert audit_up.changes["before"]["card_id"] == "RESCUE-007"
    assert audit_up.changes["after"]["card_id"] == "RESCUE-008"

    # Delete
    res_del = client.delete(
        f"/api/v1/user-certifications/my-certifications/{cert_id}", headers=auth_headers
    )
    assert res_del.status_code == 200

    audit_del = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="user_certification", entity_id=cert_id, action="delete")
        .first()
    )
    assert audit_del is not None


def test_tag_audit_logging(client, admin_headers, db_session):
    # 1. Create Tag
    res = client.post(
        "/api/v1/tags/",
        json={"name": "AuditTag1", "description": "Test Tag"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    tag_id = res.json()["id"]

    audit_create = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="available_tag", entity_id=tag_id, action="create")
        .first()
    )
    assert audit_create is not None
    assert audit_create.changes["snapshot"]["name"] == "AuditTag1"

    # 2. Update Tag
    res_up = client.put(
        f"/api/v1/tags/{tag_id}",
        json={"description": "Updated Test Tag"},
        headers=admin_headers,
    )
    assert res_up.status_code == 200

    audit_up = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="available_tag", entity_id=tag_id, action="update")
        .first()
    )
    assert audit_up is not None
    assert audit_up.changes["changed_fields"] == ["description"]

    # 3. Delete Tag
    res_del = client.delete(f"/api/v1/tags/{tag_id}", headers=admin_headers)
    assert res_del.status_code == 200

    audit_del = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="available_tag", entity_id=tag_id, action="delete")
        .first()
    )
    assert audit_del is not None


def test_setting_audit_logging(client, admin_headers, db_session):
    setting = Setting(key="audit_test_key", value='"initial"')
    db_session.add(setting)
    db_session.commit()

    res = client.put(
        "/api/v1/settings/audit_test_key",
        json={"value": "updated_value"},
        headers=admin_headers,
    )
    assert res.status_code == 200

    audit = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="setting", entity_id=setting.id, action="update")
        .first()
    )
    assert audit is not None
    assert audit.changes["changed_fields"] == ["value"]


def test_site_comment_audit_logging(client, auth_headers, admin_headers, db_session):
    site_res = client.post(
        "/api/v1/dive-sites/",
        json={"name": "Comment Audit Site", "latitude": 38.0, "longitude": 24.0},
        headers=admin_headers,
    )
    assert site_res.status_code == 200
    site_id = site_res.json()["id"]

    res = client.post(
        f"/api/v1/dive-sites/{site_id}/comments",
        json={"comment_text": "Great visibility today!"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    comment_id = res.json()["id"]

    audit = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="site_comment", entity_id=comment_id, action="create")
        .first()
    )
    assert audit is not None
    assert audit.changes["snapshot"]["comment_text"] == "Great visibility today!"
