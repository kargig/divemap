import pytest
from app.models import DivingOrganization, CertificationLevel, UserCertification, User
from app.auth import create_access_token

def test_get_organization_levels(client, db_session):
    # Create org and levels
    org = DivingOrganization(name="Test Org", acronym="TO")
    db_session.add(org)
    db_session.commit()
    
    level1 = CertificationLevel(
        diving_organization_id=org.id,
        name="Level 1",
        category="Rec",
        max_depth="18m"
    )
    level2 = CertificationLevel(
        diving_organization_id=org.id,
        name="Level 2",
        category="Rec",
        max_depth="30m"
    )
    db_session.add_all([level1, level2])
    db_session.commit()
    
    response = client.get(f"/api/v1/diving-organizations/{org.id}/levels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Level 1"
    assert data[0]["max_depth"] == "18m"

def test_create_user_certification_with_id(client, db_session):
    # Create user, org, and level
    user = User(username="testcertuser", email="cert@example.com", password_hash="hash")
    db_session.add(user)
    org = DivingOrganization(name="Test Org 2", acronym="TO2")
    db_session.add(org)
    db_session.commit()
    
    level = CertificationLevel(
        diving_organization_id=org.id,
        name="Expert Diver",
        category="Pro"
    )
    db_session.add(level)
    db_session.commit()
    
    # Login
    access_token = create_access_token(data={"sub": user.username})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Create certification linking to level ID
    payload = {
        "diving_organization_id": org.id,
        "certification_level_id": level.id,
        "certification_level": "" # Should be auto-filled
    }
    
    response = client.post("/api/v1/user-certifications/my-certifications", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["certification_level"] == "Expert Diver"
    assert data["certification_level_link"]["id"] == level.id
    assert data["certification_level_link"]["name"] == "Expert Diver"

def test_duplicate_certification_check(client, db_session):
    # Setup
    user = User(username="dupuser", email="dup@example.com", password_hash="hash")
    db_session.add(user)
    org = DivingOrganization(name="Test Org 3", acronym="TO3")
    db_session.add(org)
    db_session.commit()
    
    level = CertificationLevel(diving_organization_id=org.id, name="Dup Level")
    db_session.add(level)
    db_session.commit()
    
    access_token = create_access_token(data={"sub": user.username})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    payload = {
        "diving_organization_id": org.id,
        "certification_level_id": level.id
    }
    
    # First create
    client.post("/api/v1/user-certifications/my-certifications", json=payload, headers=headers)
    
    # Second create - should fail
    response = client.post("/api/v1/user-certifications/my-certifications", json=payload, headers=headers)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]
