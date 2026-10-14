import pytest
from datetime import date, time
from app.models import ParsedDiveTrip, DivingCenterManager

def test_trip_creation_with_online_booking(client, auth_headers, test_diving_center, db_session, test_user):
    # Ensure test_user is manager of test_diving_center
    manager = DivingCenterManager(user_id=test_user.id, diving_center_id=test_diving_center.id)
    db_session.add(manager)
    db_session.commit()

    payload = {
        "diving_center_id": test_diving_center.id,
        "trip_date": str(date(2026, 10, 28)),
        "trip_time": "09:30:00",
        "trip_duration": 240,
        "trip_description": "Exclusive Reef Dive",
        "group_size_limit": 10,
        "trip_price": 70.0,
        "trip_currency": "EUR",
        "enable_online_booking": True
    }
    response = client.post("/api/v1/newsletters/trips", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["is_bookable"] is True
    assert data["octo_slot_id"] is not None
    assert data["seats_available"] == 10

def test_my_bookings_endpoint(client, auth_headers, test_user):
    response = client.get("/api/v1/bookings/my-bookings", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_center_trips_summary_endpoint(client, auth_headers, test_diving_center, test_user, db_session):
    # Ensure test_user is manager
    manager = db_session.query(DivingCenterManager).filter(
        DivingCenterManager.user_id == test_user.id,
        DivingCenterManager.diving_center_id == test_diving_center.id
    ).first()
    if not manager:
        manager = DivingCenterManager(user_id=test_user.id, diving_center_id=test_diving_center.id)
        db_session.add(manager)
        db_session.commit()

    response = client.get(
        f"/api/v1/centers/{test_diving_center.id}/booking-ops/trips-summary",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
