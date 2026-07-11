import pytest
from fastapi import status
from sqlalchemy.orm import Session
from app.models import User, DiveSite, DiveSiteList, DiveSiteListItem, UserFriendship, DiveSiteListCollaborator
from unittest.mock import patch, MagicMock

def setup_friendship(db_session: Session, user_a_id: int, user_b_id: int, status: str = "ACCEPTED"):
    # Enforce user_id < friend_id for uniqueness
    uid, fid = sorted([user_a_id, user_b_id])
    friendship = UserFriendship(
        user_id=uid,
        friend_id=fid,
        status=status,
        initiator_id=user_a_id
    )
    db_session.add(friendship)
    db_session.commit()
    return friendship

def test_collaborator_permissions_and_workflow(
    client,
    db_session: Session,
    test_user,
    test_user_other,
    test_dive_site,
    auth_headers,
    auth_headers_other_user
):
    # 1. Create a custom private list owned by test_user
    response = client.post(
        "/api/v1/lists",
        json={
            "title": "Collaborative Cave Exploring",
            "description": "Planning cave exploration",
            "is_public": False,
            "show_on_profile": True
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    lst_data = response.json()
    lst_id = lst_data["id"]

    # 2. Try to view private list as test_user_other (non-collaborator, non-owner) -> should be 403
    response = client.get(f"/api/v1/lists/{lst_id}", headers=auth_headers_other_user)
    assert response.status_code == 403

    # 3. Try to add collaborator as a non-owner -> should be 403
    response = client.post(
        f"/api/v1/lists/{lst_id}/collaborators",
        json={"username": test_user_other.username},
        headers=auth_headers_other_user
    )
    assert response.status_code == 403

    # 4. Try to add collaborator who is not a buddy (yet) -> should be 400
    response = client.post(
        f"/api/v1/lists/{lst_id}/collaborators",
        json={"username": test_user_other.username},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "accepted buddies" in response.json()["detail"]

    # 5. Establish friendship / buddy status
    setup_friendship(db_session, test_user.id, test_user_other.id, "ACCEPTED")

    # 6. Add collaborator successfully as owner (Mock notifications to prevent network SQS/APNS errors)
    with patch("app.services.notification_service.NotificationService.create_notification") as mock_notif:
        response = client.post(
            f"/api/v1/lists/{lst_id}/collaborators",
            json={"username": test_user_other.username},
            headers=auth_headers
        )
        assert response.status_code == 201
        collab_data = response.json()
        assert collab_data["username"] == test_user_other.username
        assert collab_data["role"] == "editor"
        assert collab_data["show_on_profile"] is True
        
        # Verify notification mock triggers
        mock_notif.assert_called_once()

    # 7. Try to add duplicate collaborator -> should be 400
    response = client.post(
        f"/api/v1/lists/{lst_id}/collaborators",
        json={"username": test_user_other.username},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "already a collaborator" in response.json()["detail"]

    # 8. View the private list as collaborator -> should now succeed with 200
    response = client.get(f"/api/v1/lists/{lst_id}", headers=auth_headers_other_user)
    assert response.status_code == 200
    details = response.json()
    assert details["is_collaborator"] is True
    assert details["role"] == "editor"
    assert len(details["collaborators"]) == 1
    assert details["collaborators"][0]["username"] == test_user_other.username

    # 9. Add list item as collaborator -> should succeed
    with patch("app.routers.lists.notify_collaborative_list_activity") as mock_activity:
        response = client.post(
            f"/api/v1/lists/{lst_id}/items",
            json={"dive_site_id": test_dive_site.id, "notes": "Deep cave entrance"},
            headers=auth_headers_other_user
        )
        assert response.status_code == 201
        item_data = response.json()
        assert item_data["notes"] == "Deep cave entrance"

    # 10. Update list item note as collaborator -> should succeed
    response = client.put(
        f"/api/v1/lists/{lst_id}/items/{item_data['id']}",
        json={"notes": "Deep cave entrance - verified"},
        headers=auth_headers_other_user
    )
    assert response.status_code == 200
    updated_item = response.json()
    assert updated_item["notes"] == "Deep cave entrance - verified"

    # 11. Collaborator toggles profile preference -> should succeed
    response = client.put(
        f"/api/v1/lists/{lst_id}/collaborators/preference",
        json={"show_on_profile": False},
        headers=auth_headers_other_user
    )
    assert response.status_code == 200
    pref_data = response.json()
    assert pref_data["show_on_profile"] is False

    # 12. Collaborator tries to update list-wide metadata (title/description) -> should be 403 (Owner only!)
    response = client.put(
        f"/api/v1/lists/{lst_id}",
        json={"title": "Unauthorized Title Hack"},
        headers=auth_headers_other_user
    )
    assert response.status_code == 403

    # 13. Collaborator leaves list successfully
    response = client.delete(
        f"/api/v1/lists/{lst_id}/collaborators/{test_user_other.id}",
        headers=auth_headers_other_user
    )
    assert response.status_code == 204

    # 14. Access private list again as the former collaborator -> should be 403 again
    response = client.get(f"/api/v1/lists/{lst_id}", headers=auth_headers_other_user)
    assert response.status_code == 403


def test_collaborator_public_profile_visibility(
    client,
    db_session: Session,
    test_user,
    test_user_other,
    auth_headers,
    auth_headers_other_user
):
    # 1. Create a public list owned by test_user
    response = client.post(
        "/api/v1/lists",
        json={
            "title": "Public Reef Hunt",
            "description": "Public list for reefs",
            "is_public": True,
            "show_on_profile": True
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    lst_id = response.json()["id"]

    # 2. Add test_user_other as collaborator
    setup_friendship(db_session, test_user.id, test_user_other.id, "ACCEPTED")
    with patch("app.services.notification_service.NotificationService.create_notification"):
        response = client.post(
            f"/api/v1/lists/{lst_id}/collaborators",
            json={"username": test_user_other.username},
            headers=auth_headers
        )
        assert response.status_code == 201

    # 3. By default, collaborators have show_on_profile = True.
    # Check if this list shows up on test_user_other's public profile list endpoint.
    response = client.get(f"/api/v1/users/{test_user_other.username}/lists")
    assert response.status_code == 200
    pub_lists = response.json()
    assert len(pub_lists) >= 1
    
    collab_list = next((l for l in pub_lists if l["id"] == lst_id), None)
    assert collab_list is not None
    assert collab_list["is_collaborator"] is True
    assert collab_list["role"] == "editor"
    assert collab_list["username"] == test_user.username  # Owner username!

    # 4. If test_user_other sets show_on_profile = False, it should no longer show on their public profile
    response = client.put(
        f"/api/v1/lists/{lst_id}/collaborators/preference",
        json={"show_on_profile": False},
        headers=auth_headers_other_user
    )
    assert response.status_code == 200

    response = client.get(f"/api/v1/users/{test_user_other.username}/lists")
    assert response.status_code == 200
    pub_lists_after = response.json()
    collab_list_after = next((l for l in pub_lists_after if l["id"] == lst_id), None)
    assert collab_list_after is None

