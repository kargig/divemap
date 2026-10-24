from app.models import EntityAuditLog


def test_admin_get_entity_audit_logs(client, admin_headers, db_session, test_user):
    log = EntityAuditLog(
        entity_type="dive_site",
        entity_id=485,
        action="create",
        user_id=test_user.id,
        user_role="user",
        auth_method="pat",
        pat_name="CLI Script",
        client_type="api_client",
        changes={"snapshot": {"name": "Pytheas"}},
    )
    db_session.add(log)
    db_session.commit()

    res = client.get(
        "/api/v1/admin/system/entity-audit-logs?entity_type=dive_site&entity_id=485",
        headers=admin_headers,
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    assert items[0]["pat_name"] == "CLI Script"
    assert items[0]["auth_method"] == "pat"
    assert items[0]["entity_type"] == "dive_site"
    assert str(items[0]["entity_id"]) == "485"
    assert "X-Total-Count" in res.headers


def test_non_admin_forbidden_from_entity_audit_logs(client, auth_headers):
    res = client.get("/api/v1/admin/system/entity-audit-logs", headers=auth_headers)
    assert res.status_code == 403


def test_unauthenticated_forbidden_from_entity_audit_logs(client):
    res = client.get("/api/v1/admin/system/entity-audit-logs")
    assert res.status_code == 403
