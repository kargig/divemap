import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat_service import ChatService
from app.schemas.chat import SearchIntent, IntentType
from app.models import DivingCenter, GearRentalCost

@pytest.fixture
def chat_service(db_session):
    return ChatService(db_session)

@pytest.fixture
def setup_gear_data(db_session):
    # Center 1: Expensive
    c1 = DivingCenter(name="Expensive Center", city="Athens", region="Attica", latitude=37.9, longitude=23.7)
    db_session.add(c1)
    db_session.flush()
    
    # Center 2: Cheap
    c2 = DivingCenter(name="Cheap Center", city="Athens", region="Attica", latitude=37.95, longitude=23.75)
    db_session.add(c2)
    db_session.flush()
    
    # Center 3: Far away
    c3 = DivingCenter(name="Far Center", city="Thessaloniki", region="Macedonia", latitude=40.6, longitude=22.9)
    db_session.add(c3)
    db_session.flush()

    # Gear
    # 12L Air Tank
    g1 = GearRentalCost(diving_center_id=c1.id, item_name="12L Air Tank", cost=15.00, currency="EUR")
    g2 = GearRentalCost(diving_center_id=c2.id, item_name="12L Tank Air", cost=10.00, currency="EUR") # Cheaper
    g3 = GearRentalCost(diving_center_id=c3.id, item_name="12L Air Tank", cost=5.00, currency="EUR") # Cheapest but wrong location
    
    # Other Gear (Regulator)
    g4 = GearRentalCost(diving_center_id=c1.id, item_name="Regulator Set", cost=20.00, currency="EUR")

    db_session.add_all([g1, g2, g3, g4])
    db_session.commit()
    
    return {"c1": c1, "c2": c2, "c3": c3}

def test_gear_rental_search(chat_service, setup_gear_data):
    # User asks: "cheaper to rent 12Lt tank air in Attica"
    # Intent extraction should yield:
    intent = SearchIntent(
        intent_type=IntentType.GEAR_RENTAL,
        keywords=["12L", "tank"], # Normalized keywords ideally, but let's say "12L" and "tank"
        location="Attica"
    )
    
    results = chat_service.execute_search(intent)
    
    # Analysis:
    # Should find g1 (15.00) and g2 (10.00)
    # Should NOT find g3 (Wrong location)
    # Should NOT find g4 (Item name mismatch)
    # Should be sorted by price ASC (g2 first)
    
    assert len(results) >= 2
    
    # Filter for our test entities to ignore seed data
    test_ids = {setup_gear_data["c1"].id, setup_gear_data["c2"].id, setup_gear_data["c3"].id}
    relevant_results = [r for r in results if r.get("center_id") in test_ids]
    
    assert len(relevant_results) == 2
    
    first = relevant_results[0]
    second = relevant_results[1]
    
    assert first["cost"] == 10.00
    assert first["center_name"] == "Cheap Center"
    
    assert second["cost"] == 15.00
    assert second["center_name"] == "Expensive Center"
    
    # Ensure items are correct
    assert "12L" in first["name"]
    assert "12L" in second["name"]
