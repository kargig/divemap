from app.models import DiveSiteEditRequest, EditRequestStatus, EditRequestType

def test_admin_can_approve_edit_request(client, admin_headers, db_session, test_dive_site, test_user):
    req = DiveSiteEditRequest(
        dive_site_id=test_dive_site.id, requested_by_id=test_user.id,
        status=EditRequestStatus.pending, edit_type=EditRequestType.site_data,
        proposed_data={"description": "Admin approved this"}
    )
    db_session.add(req)
    db_session.commit()
    
    response = client.post(f"/api/v1/admin/dive-sites/edit-requests/{req.id}/approve", headers=admin_headers)
    assert response.status_code == 200
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.description == "Admin approved this"
