import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, DiveSite, DiveSiteList, DiveSiteListItem

def test_lists_workflow(client, db_session: Session, test_user, test_user_other, test_dive_site, auth_headers, auth_headers_other_user, admin_headers):
    # 1. Access user lists anonymously / publicly
    # This should trigger default lists creation!
    response = client.get(f"/api/v1/users/{test_user.username}/lists")
    assert response.status_code == 200
    data = response.json()
    
    # By default, only public profile-enabled lists are shown
    # "My Favorites" defaults to is_public=True, show_on_profile=True -> count should be 1
    assert len(data) == 1
    assert data[0]["system_type"] == "favorites"
    assert data[0]["title"] == "My Favorites"

    # 2. Logged in user gets own lists
    response = client.get("/api/v1/lists/my-lists", headers=auth_headers)
    assert response.status_code == 200
    my_data = response.json()
    assert len(my_data) == 2  # Both Favorites and Wishlist (private)

    # 3. Create a custom list
    response = client.post(
        "/api/v1/lists",
        json={"title": "Saronikos Caves", "description": "My top cave locations", "is_public": True, "show_on_profile": True},
        headers=auth_headers
    )
    assert response.status_code == 201
    custom_list = response.json()
    assert custom_list["title"] == "Saronikos Caves"
    assert custom_list["slug"] == "saronikos-caves"

    # 4. Add a site to the custom list
    response = client.post(
        f"/api/v1/lists/{custom_list['id']}/items",
        json={"dive_site_id": test_dive_site.id, "notes": "Fabulous visibility!"},
        headers=auth_headers
    )
    assert response.status_code == 201
    item_data = response.json()
    assert item_data["notes"] == "Fabulous visibility!"

    # 5. Prevent duplicate additions
    response = client.post(
        f"/api/v1/lists/{custom_list['id']}/items",
        json={"dive_site_id": test_dive_site.id},
        headers=auth_headers
    )
    assert response.status_code == 400

    # 6. Retrieve list details
    response = client.get(f"/api/v1/lists/{custom_list['id']}")
    assert response.status_code == 200
    list_details = response.json()
    assert len(list_details["items"]) == 1
    assert list_details["items"][0]["notes"] == "Fabulous visibility!"
    assert list_details["items"][0]["dive_site"]["name"] == test_dive_site.name

    # 7. Check membership status
    response = client.get(f"/api/v1/lists/dive-site/{test_dive_site.id}/my-status", headers=auth_headers)
    assert response.status_code == 200
    status_data = response.json()
    # Check custom list is listed as having this site
    custom_status = next(s for s in status_data if s["list_id"] == custom_list["id"])
    assert custom_status["is_in_list"] is True
    assert custom_status["item_id"] == item_data["id"]

    # 8. Deletion rules
    # Prevent deleting system list
    fav_id = next(lst["id"] for lst in my_data if lst["system_type"] == "favorites")
    response = client.delete(f"/api/v1/lists/{fav_id}", headers=auth_headers)
    assert response.status_code == 403

    # 9. Admin Popular Lists
    # Regular user gets 403 Forbidden
    response = client.get("/api/v1/lists/admin/popular-lists", headers=auth_headers)
    assert response.status_code == 403

    # Admin gets 200 OK
    response = client.get("/api/v1/lists/admin/popular-lists", headers=admin_headers)
    assert response.status_code == 200
    popular_data = response.json()
    assert len(popular_data) >= 1

    # Delete custom list item
    response = client.delete(f"/api/v1/lists/{custom_list['id']}/items/{item_data['id']}", headers=auth_headers)
    assert response.status_code == 204

    # Delete custom list
    response = client.delete(f"/api/v1/lists/{custom_list['id']}", headers=auth_headers)
    assert response.status_code == 204
