from app.models import DiveSiteEditRequest

def test_dive_site_edit_request_model(db_session, test_user, test_dive_site):
    request = DiveSiteEditRequest(
        dive_site_id=test_dive_site.id,
        requested_by_id=test_user.id,
        status="pending",
        edit_type="site_data",
        proposed_data={"description": "new text"}
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)
    
    assert request.id is not None
    assert request.status == "pending"
    assert request.edit_type == "site_data"
    assert request.proposed_data["description"] == "new text"
