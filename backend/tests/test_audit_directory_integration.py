from app.models import (
    Dive,
    DiveRoute,
    DiveSite,
    DivingCenter,
    EntityAuditLog,
    RouteType,
)


def test_dive_site_crud_creates_audit_logs(client, admin_headers, db_session):
    # 1. Create site
    payload = {"name": "Audit Test Site", "latitude": 37.9, "longitude": 23.7}
    res = client.post("/api/v1/dive-sites/", json=payload, headers=admin_headers)
    assert res.status_code == 200
    site_id = res.json()["id"]

    create_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_site", entity_id=site_id, action="create")
        .first()
    )
    assert create_log is not None
    assert create_log.auth_method == "jwt"
    assert create_log.changes["snapshot"]["name"] == "Audit Test Site"

    # 2. Update site
    update_payload = {"name": "Audit Test Site Renamed"}
    res_up = client.put(
        f"/api/v1/dive-sites/{site_id}", json=update_payload, headers=admin_headers
    )
    assert res_up.status_code == 200

    update_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_site", entity_id=site_id, action="update")
        .first()
    )
    assert update_log is not None
    assert "name" in update_log.changes["changed_fields"]
    assert update_log.changes["before"]["name"] == "Audit Test Site"
    assert update_log.changes["after"]["name"] == "Audit Test Site Renamed"

    # 3. Delete site
    res_del = client.delete(f"/api/v1/dive-sites/{site_id}", headers=admin_headers)
    assert res_del.status_code == 200

    del_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_site", entity_id=site_id, action="soft_delete")
        .first()
    )
    assert del_log is not None

    # 4. Restore site
    res_rest = client.post(
        f"/api/v1/dive-sites/{site_id}/restore", headers=admin_headers
    )
    assert res_rest.status_code == 200

    restore_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_site", entity_id=site_id, action="restore")
        .first()
    )
    assert restore_log is not None


def test_dive_crud_creates_audit_logs(client, auth_headers, test_user, db_session):
    # 1. Create dive
    dive_payload = {
        "name": "Audit Dive Log",
        "dive_date": "2026-10-23",
        "max_depth": 22.0,
        "duration": 45,
    }
    res = client.post("/api/v1/dives/", json=dive_payload, headers=auth_headers)
    assert res.status_code == 200
    dive_id = res.json()["id"]

    create_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive", entity_id=dive_id, action="create")
        .first()
    )
    assert create_log is not None
    assert create_log.user_id == test_user.id

    # 2. Update dive
    update_payload = {"name": "Audit Dive Log Updated", "max_depth": 25.0}
    res_up = client.put(
        f"/api/v1/dives/{dive_id}", json=update_payload, headers=auth_headers
    )
    assert res_up.status_code == 200

    update_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive", entity_id=dive_id, action="update")
        .first()
    )
    assert update_log is not None
    assert "max_depth" in update_log.changes["changed_fields"]

    # 3. Delete dive
    res_del = client.delete(f"/api/v1/dives/{dive_id}", headers=auth_headers)
    assert res_del.status_code == 200

    del_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive", entity_id=dive_id, action="delete")
        .first()
    )
    assert del_log is not None
    assert del_log.changes["snapshot"]["name"] == "Audit Dive Log Updated"


def test_diving_center_crud_creates_audit_logs(client, admin_headers, db_session):
    # 1. Create center
    center_payload = {
        "name": "Audit Center",
        "description": "A top-tier diving center in Athens",
        "country": "Greece",
        "city": "Athens",
        "latitude": 37.98,
        "longitude": 23.72,
    }
    res = client.post(
        "/api/v1/diving-centers/", json=center_payload, headers=admin_headers
    )
    assert res.status_code == 200
    center_id = res.json()["id"]

    create_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="diving_center", entity_id=center_id, action="create")
        .first()
    )
    assert create_log is not None
    assert create_log.changes["snapshot"]["name"] == "Audit Center"

    # 2. Update center
    res_up = client.put(
        f"/api/v1/diving-centers/{center_id}",
        json={"name": "Audit Center Updated"},
        headers=admin_headers,
    )
    assert res_up.status_code == 200

    up_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="diving_center", entity_id=center_id, action="update")
        .first()
    )
    assert up_log is not None
    assert "name" in up_log.changes["changed_fields"]

    # 3. Delete center
    res_del = client.delete(
        f"/api/v1/diving-centers/{center_id}", headers=admin_headers
    )
    assert res_del.status_code == 200

    del_log = (
        db_session.query(EntityAuditLog)
        .filter_by(
            entity_type="diving_center", entity_id=center_id, action="hard_delete"
        )
        .first()
    )
    assert del_log is not None
    assert del_log.changes["snapshot"]["name"] == "Audit Center Updated"


def test_dive_route_crud_creates_audit_logs(client, admin_headers, db_session):
    # Setup site for route
    site_payload = {"name": "Route Audit Site", "latitude": 38.0, "longitude": 24.0}
    res_site = client.post(
        "/api/v1/dive-sites/", json=site_payload, headers=admin_headers
    )
    assert res_site.status_code == 200
    site_id = res_site.json()["id"]

    # 1. Create route
    route_payload = {
        "dive_site_id": site_id,
        "name": "Audit Test Route",
        "description": "Scenic circular dive route",
        "route_type": "scuba",
        "route_data": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[24.0, 38.0], [24.01, 38.01]],
                    },
                    "properties": {"route_type": "scuba"},
                }
            ],
        },
    }
    res = client.post("/api/v1/dive-routes/", json=route_payload, headers=admin_headers)
    assert res.status_code == 200
    route_id = res.json()["id"]

    create_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_route", entity_id=route_id, action="create")
        .first()
    )
    assert create_log is not None
    assert create_log.changes["snapshot"]["name"] == "Audit Test Route"

    # 2. Update route
    update_payload = {"name": "Audit Test Route Renamed"}
    res_up = client.put(
        f"/api/v1/dive-routes/{route_id}", json=update_payload, headers=admin_headers
    )
    assert res_up.status_code == 200

    up_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_route", entity_id=route_id, action="update")
        .first()
    )
    assert up_log is not None
    assert "name" in up_log.changes["changed_fields"]

    # 3. Delete route (hide)
    res_hide = client.post(
        f"/api/v1/dive-routes/{route_id}/hide", headers=admin_headers
    )
    assert res_hide.status_code == 200

    del_log = (
        db_session.query(EntityAuditLog)
        .filter_by(entity_type="dive_route", entity_id=route_id, action="soft_delete")
        .first()
    )
    assert del_log is not None
