import pytest
from datetime import datetime, time, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import (
    DivingCenter,
    DivingCenterBookingSettings,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
)

@pytest.fixture
def octo_setup(db_session: Session, test_diving_center: DivingCenter):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
        hold_duration_minutes=20,
    )
    db_session.add(settings)
    
    product = OctoProduct(
        id="prod-octo-test-1",
        diving_center_id=test_diving_center.id,
        title="2-Tank Morning Boat Dive",
        description="Morning wreck and reef boat dive",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    db_session.add(product)
    db_session.flush()
    
    option = OctoOption(
        id="opt-octo-test-1",
        product_id=product.id,
        title="08:30 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    unit1 = OctoUnit(
        id="unit-octo-own-1",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver (Own Gear)",
        retail_price=75.00,
        currency="EUR",
    )
    unit2 = OctoUnit(
        id="unit-octo-rent-1",
        product_id=product.id,
        unit_type="DIVER_RENTAL_GEAR",
        title="Certified Diver (Full Rental Gear)",
        retail_price=105.00,
        currency="EUR",
    )
    db_session.add_all([option, unit1, unit2])
    db_session.flush()
    
    start_dt = datetime.now(timezone.utc) + timedelta(days=2)
    end_dt = start_dt + timedelta(hours=4)
    slot = OctoAvailabilitySlot(
        id="slot-octo-test-1",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        seats_total=4,
        seats_available=4,
    )
    db_session.add(slot)
    db_session.commit()
    
    return {
        "center": test_diving_center,
        "product": product,
        "option": option,
        "unit_own": unit1,
        "unit_rent": unit2,
        "slot": slot,
    }

def test_get_supplier_endpoint(client: TestClient, octo_setup):
    center_id = octo_setup["center"].id
    res = client.get(f"/api/v1/octo/suppliers/{center_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(center_id)
    assert data["name"] == octo_setup["center"].name
    assert "octo/pricing" in data["capabilities"]
    assert "octo/waivers" in data["capabilities"]

def test_get_products_endpoints(client: TestClient, octo_setup):
    center_id = octo_setup["center"].id
    # List products
    res = client.get(f"/api/v1/octo/suppliers/{center_id}/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 1
    assert any(p["id"] == octo_setup["product"].id for p in products)
    
    # Get product detail
    prod_id = octo_setup["product"].id
    res_detail = client.get(f"/api/v1/octo/suppliers/{center_id}/products/{prod_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["title"] == "2-Tank Morning Boat Dive"
    assert len(detail["options"]) == 1
    assert len(detail["units"]) == 2

def test_availability_query(client: TestClient, octo_setup):
    prod_id = octo_setup["product"].id
    opt_id = octo_setup["option"].id
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_str = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
    
    payload = {
        "productId": prod_id,
        "optionId": opt_id,
        "localDateStart": today_str,
        "localDateEnd": future_str,
    }
    res = client.post("/api/v1/octo/availability", json=payload)
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) >= 1
    assert slots[0]["id"] == octo_setup["slot"].id
    assert slots[0]["seatsAvailable"] == 4

def test_booking_lifecycle_hold_confirm_cancel(client: TestClient, octo_setup):
    prod_id = octo_setup["product"].id
    opt_id = octo_setup["option"].id
    slot_id = octo_setup["slot"].id
    unit_id = octo_setup["unit_own"].id
    
    # 1. Hold 2 seats
    hold_payload = {
        "productId": prod_id,
        "optionId": opt_id,
        "availabilityId": slot_id,
        "unitItems": [
            {
                "unitId": unit_id,
                "diverFullName": "Captain Nemo",
                "diverEmail": "nemo@nautilus.org",
                "certificationAgency": "PADI",
                "certificationLevel": "Master Scuba Diver"
            },
            {
                "unitId": unit_id,
                "diverFullName": "Ned Land",
                "diverEmail": "ned@harpoon.org",
                "certificationAgency": "SSI",
                "certificationLevel": "Open Water"
            }
        ],
        "contact": {
            "fullName": "Captain Nemo",
            "email": "nemo@nautilus.org",
            "phone": "+123456789"
        }
    }
    res_hold = client.post("/api/v1/octo/bookings", json=hold_payload)
    assert res_hold.status_code == 201
    booking = res_hold.json()
    assert booking["status"] == "ON_HOLD"
    assert booking["totalAmount"] == 150.00
    booking_uuid = booking["uuid"]
    assert len(booking["unitItems"]) == 2
    
    # Verify slot seats decreased from 4 to 2
    res_avail = client.post("/api/v1/octo/availability", json={
        "productId": prod_id,
        "optionId": opt_id,
        "localDateStart": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "localDateEnd": (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d"),
    })
    assert res_avail.json()[0]["seatsAvailable"] == 2
    
    # 2. Get booking
    res_get = client.get(f"/api/v1/octo/bookings/{booking_uuid}")
    assert res_get.status_code == 200
    assert res_get.json()["uuid"] == booking_uuid
    
    # 3. Confirm booking
    confirm_payload = {
        "contact": {
            "fullName": "Captain Nemo",
            "email": "nemo@nautilus.org"
        }
    }
    res_conf = client.post(f"/api/v1/octo/bookings/{booking_uuid}/confirm", json=confirm_payload)
    assert res_conf.status_code == 200
    assert res_conf.json()["status"] == "CONFIRMED"
    
    # 4. Cancel booking (releases seats back)
    res_cancel = client.post(f"/api/v1/octo/bookings/{booking_uuid}/cancel", json={"reason": "Sea sickness"})
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"
    
    # Verify seats released back to 4
    res_avail2 = client.post("/api/v1/octo/availability", json={
        "productId": prod_id,
        "optionId": opt_id,
        "localDateStart": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "localDateEnd": (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d"),
    })
    assert res_avail2.json()[0]["seatsAvailable"] == 4

def test_booking_capacity_overflow_rejected(client: TestClient, octo_setup):
    prod_id = octo_setup["product"].id
    opt_id = octo_setup["option"].id
    slot_id = octo_setup["slot"].id
    unit_id = octo_setup["unit_own"].id
    
    # Attempt to hold 5 seats when only 4 exist
    hold_payload = {
        "productId": prod_id,
        "optionId": opt_id,
        "availabilityId": slot_id,
        "unitItems": [{"unitId": unit_id, "diverFullName": f"Diver {i}"} for i in range(5)]
    }
    res_overflow = client.post("/api/v1/octo/bookings", json=hold_payload)
    assert res_overflow.status_code == 400
    assert "Not enough seats" in res_overflow.json()["detail"]
