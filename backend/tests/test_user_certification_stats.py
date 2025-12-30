import pytest
from app.routers.users import calculate_certification_stats
from app.models import DivingOrganization, CertificationLevel, UserCertification, User
from unittest.mock import MagicMock

def test_calculate_certification_stats_logic():
    # Test case 1: Recreational Air
    cert1 = MagicMock()
    cert1.certification_level_link.max_depth = "18m (60ft)"
    cert1.certification_level_link.gases = "Air"
    cert1.certification_level_link.tanks = "Single"
    cert1.certification_level_link.deco_time_limit = "No decompression"

    stats = calculate_certification_stats([cert1])
    assert stats.max_depth == 18.0
    assert stats.max_nitrox_pct == 21
    assert stats.max_trimix_pct is None
    assert stats.max_stages == 0
    assert stats.max_deco_time == "No decompression"

    # Test case 2: Advanced Tech
    cert2 = MagicMock()
    cert2.certification_level_link.max_depth = "100m"
    cert2.certification_level_link.gases = "Hypoxic Trimix (10/50), Oxygen for deco" # Added Oxygen
    cert2.certification_level_link.tanks = "Double + 3+ Stages"
    cert2.certification_level_link.deco_time_limit = "Unlimited"

    stats = calculate_certification_stats([cert1, cert2])
    assert stats.max_depth == 100.0
    assert stats.max_nitrox_pct == 100 # Now it should be 100
    assert stats.max_trimix_pct == "Hypoxic"
    assert stats.max_stages == 3
    assert stats.max_deco_time == "Unlimited"

    # Test case 3: Nitrox 40%
    cert3 = MagicMock()
    cert3.certification_level_link.max_depth = None
    cert3.certification_level_link.gases = "Nitrox up to 40%"
    cert3.certification_level_link.tanks = "Single"
    cert3.certification_level_link.deco_time_limit = None

    stats = calculate_certification_stats([cert3])
    assert stats.max_nitrox_pct == 40

def test_user_public_profile_includes_cert_stats(client, db_session, test_user):
    # Setup organization and tech level
    org = DivingOrganization(name="Tech Org", acronym="TO")
    db_session.add(org)
    db_session.commit()
    
    level = CertificationLevel(
        diving_organization_id=org.id,
        name="Trimix Diver",
        category="Technical",
        max_depth="60m",
        gases="Normoxic Trimix",
        tanks="Double + 2 stages",
        deco_time_limit="Unlimited"
    )
    db_session.add(level)
    db_session.commit()
    
    user_cert = UserCertification(
        user_id=test_user.id,
        diving_organization_id=org.id,
        certification_level="Trimix Diver",
        certification_level_id=level.id,
        is_active=True
    )
    db_session.add(user_cert)
    db_session.commit()
    
    response = client.get(f"/api/v1/users/{test_user.username}/public")
    assert response.status_code == 200
    data = response.json()
    
    assert "certification_stats" in data
    cert_stats = data["certification_stats"]
    assert cert_stats["max_depth"] == 60.0
    assert cert_stats["max_trimix_pct"] == "Normoxic"
    assert cert_stats["max_stages"] == 2
    assert cert_stats["max_deco_time"] == "Unlimited"
    assert "Double" in cert_stats["largest_tanks"]
    assert "Trimix" in cert_stats["best_gases"]
