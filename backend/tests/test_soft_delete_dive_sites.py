import pytest
from fastapi import status
from app.models import DiveSite, DiveRoute

def test_soft_delete_by_creator(client, auth_headers, test_dive_site, test_user, db_session):
    """Creator can soft delete their own site."""
    # Ensure test user is the creator
    test_dive_site.created_by = test_user.id
    db_session.commit()
    
    response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Dive site archived successfully"
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.deleted_at is not None

def test_soft_delete_unauthorized_user(client, auth_headers_other_user, test_dive_site, test_user, db_session):
    """Non-creator regular users cannot soft delete the site."""
    # Ensure test user is the creator
    test_dive_site.created_by = test_user.id
    db_session.commit()
    
    response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}", headers=auth_headers_other_user)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.deleted_at is None

def test_soft_delete_by_admin(client, admin_headers, test_dive_site, db_session):
    """Admins can soft delete any site (without force parameter)."""
    response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Dive site archived successfully"
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.deleted_at is not None

def test_hard_delete_by_admin(client, admin_headers, test_dive_site, db_session):
    """Admins can hard delete a site using force=true."""
    site_id = test_dive_site.id
    response = client.delete(f"/api/v1/dive-sites/{site_id}?force=true", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Dive site permanently deleted"
    
    # Verify site is physically removed
    deleted_site = db_session.query(DiveSite).filter(DiveSite.id == site_id).first()
    assert deleted_site is None

def test_access_soft_deleted_site_as_user(client, auth_headers, test_dive_site, test_user, db_session):
    """Regular users receive 404 when accessing an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}", headers=auth_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND

def test_access_soft_deleted_site_as_admin(client, admin_headers, test_dive_site, db_session):
    """Admins can access an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == test_dive_site.id
    assert response.json()["deleted_at"] is not None

def test_access_soft_deleted_site_route_as_user(client, auth_headers, test_route, test_dive_site, db_session):
    """Regular users receive 404 when accessing a route for an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-routes/{test_route.id}", headers=auth_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND

def test_access_soft_deleted_site_route_as_admin(client, admin_headers, test_route, test_dive_site, db_session):
    """Admins can access a route for an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-routes/{test_route.id}", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == test_route.id
    assert response.json()["dive_site"]["deleted_at"] is not None

def test_get_dive_site_routes_hides_archived_sites_for_user(client, auth_headers, test_route, test_dive_site, db_session):
    """Regular users receive 404 when fetching routes list of an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}/routes", headers=auth_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND

def test_list_dive_sites_hides_archived_by_default(client, test_dive_site, db_session):
    """List endpoint hides archived sites by default for unauthenticated users."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/")
    assert response.status_code == status.HTTP_200_OK
    sites = response.json()
    assert not any(s["id"] == test_dive_site.id for s in sites)

def test_list_dive_sites_include_archived_admin(client, admin_headers, test_dive_site, db_session):
    """Admin can use include_archived=true to see archived sites."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/?include_archived=true", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    sites = response.json()
    assert any(s["id"] == test_dive_site.id for s in sites)

def test_list_dive_sites_include_archived_user(client, auth_headers, test_dive_site, db_session):
    """Regular users cannot use include_archived=true to see archived sites."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.get(f"/api/v1/dive-sites/?include_archived=true", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    sites = response.json()
    assert not any(s["id"] == test_dive_site.id for s in sites)

def test_global_search_hides_archived(client, test_dive_site, db_session):
    """Global search hides archived sites."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    test_dive_site.name = "Archived Search Site"
    db_session.commit()
    
    response = client.get(f"/api/v1/search/?q=Archived")
    assert response.status_code == status.HTTP_200_OK
    search_results = response.json().get("results", [])
    
    dive_sites_results = []
    for section in search_results:
        if section.get("entity_type") == "dive_site":
            dive_sites_results = section.get("results", [])
            break
            
    assert not any(r.get("id") == test_dive_site.id for r in dive_sites_results)

def test_restore_archived_site_admin(client, admin_headers, test_dive_site, db_session):
    """Admin can restore an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/restore", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Dive site restored successfully"
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.deleted_at is None

def test_restore_archived_site_user(client, auth_headers, test_dive_site, db_session):
    """Regular user cannot restore an archived site."""
    from datetime import datetime, timezone
    test_dive_site.deleted_at = datetime.now(timezone.utc)
    db_session.commit()
    
    response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/restore", headers=auth_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    db_session.refresh(test_dive_site)
    assert test_dive_site.deleted_at is not None
