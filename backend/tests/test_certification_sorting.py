import pytest
from app.models import DivingOrganization, CertificationLevel

def test_get_organization_levels_sorted(client, db_session):
    # Create org
    org = DivingOrganization(name="Sorting Org", acronym="SO")
    db_session.add(org)
    db_session.commit()
    
    # Create levels in random order
    levels = [
        CertificationLevel(diving_organization_id=org.id, name="Pro Diver", category="Professional Track", max_depth=None),
        CertificationLevel(diving_organization_id=org.id, name="Cave Diver", category="Cave Track", max_depth="30m"),
        CertificationLevel(diving_organization_id=org.id, name="Tec 40", category="Technical Track", max_depth="40m", gases="Nitrox"),
        CertificationLevel(diving_organization_id=org.id, name="Nitrox Diver", category="Specialties", max_depth=None, gases="Nitrox"),
        CertificationLevel(diving_organization_id=org.id, name="Open Water", category="Recreational Track", max_depth="18m"),
        CertificationLevel(diving_organization_id=org.id, name="Advanced Open Water", category="Recreational Track", max_depth="30m"),
        CertificationLevel(diving_organization_id=org.id, name="Tec 100", category="Technical Track", max_depth="100m", gases="Hypoxic Trimix"),
        CertificationLevel(diving_organization_id=org.id, name="Deep Diver", category="Specialties", max_depth="40m"),
    ]
    db_session.add_all(levels)
    db_session.commit()
    
    response = client.get(f"/api/v1/diving-organizations/{org.id}/levels")
    assert response.status_code == 200
    data = response.json()
    
    # Expected order:
    # 1. Recreational Track: Open Water (18m)
    # 2. Recreational Track: Advanced Open Water (30m)
    # 3. Specialties: Deep Diver (40m)
    # 4. Specialties: Nitrox Diver (999m)
    # 5. Technical Track: Tec 40 (40m)
    # 6. Technical Track: Tec 100 (100m)
    # 7. Cave Track: Cave Diver (30m)
    # 8. Professional Track: Pro Diver (999m)
    
    assert data[0]["name"] == "Open Water"
    assert data[1]["name"] == "Advanced Open Water"
    assert data[2]["name"] == "Deep Diver"
    assert data[3]["name"] == "Nitrox Diver"
    assert data[4]["name"] == "Tec 40"
    assert data[5]["name"] == "Tec 100"
    assert data[6]["name"] == "Cave Diver"
    assert data[7]["name"] == "Pro Diver"

def test_sorting_by_gas_difficulty(client, db_session):
    org = DivingOrganization(name="Gas Org", acronym="GO")
    db_session.add(org)
    db_session.commit()
    
    # Same depth, different gases
    levels = [
        CertificationLevel(diving_organization_id=org.id, name="Trimix 60", category="Tech", max_depth="60m", gases="Trimix"),
        CertificationLevel(diving_organization_id=org.id, name="Hypoxic 60", category="Tech", max_depth="60m", gases="Hypoxic Trimix"),
        CertificationLevel(diving_organization_id=org.id, name="Air 60", category="Tech", max_depth="60m", gases="Air"),
    ]
    db_session.add_all(levels)
    db_session.commit()
    
    response = client.get(f"/api/v1/diving-organizations/{org.id}/levels")
    data = response.json()
    
    # Air < Trimix < Hypoxic
    assert data[0]["name"] == "Air 60"
    assert data[1]["name"] == "Trimix 60"
    assert data[2]["name"] == "Hypoxic 60"
