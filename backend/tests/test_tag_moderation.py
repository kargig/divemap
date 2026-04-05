from fastapi import status
from app.models import AvailableTag

def test_untrusted_tag_addition_returns_202(client, test_dive_site, auth_headers_other_user, db_session):
    # Ensure a tag exists
    tag = db_session.query(AvailableTag).first()
    if not tag:
        tag = AvailableTag(name="Test Tag")
        db_session.add(tag)
        db_session.commit()
    
    payload = {"tag_id": tag.id}
    response = client.post(f"/api/v1/tags/dive-sites/{test_dive_site.id}/tags", json=payload, headers=auth_headers_other_user)
    assert response.status_code == status.HTTP_202_ACCEPTED
    assert "Tag addition submitted for moderation" in response.json()["message"]

def test_untrusted_tag_removal_returns_202(client, test_dive_site, auth_headers_other_user, db_session):
    from app.models import DiveSiteTag
    # Ensure a tag exists and is assigned
    tag = db_session.query(AvailableTag).first()
    if not tag:
        tag = AvailableTag(name="Test Tag")
        db_session.add(tag)
        db_session.commit()
    
    assignment = DiveSiteTag(dive_site_id=test_dive_site.id, tag_id=tag.id)
    db_session.add(assignment)
    db_session.commit()
    
    response = client.delete(f"/api/v1/tags/dive-sites/{test_dive_site.id}/tags/{tag.id}", headers=auth_headers_other_user)
    assert response.status_code == status.HTTP_202_ACCEPTED
    assert "Tag removal submitted for moderation" in response.json()["message"]
