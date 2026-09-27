from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest

from app.models import (
    OctoProduct,
    OctoOption,
    OctoAvailabilitySlot,
    TripBriefing,
    DiveSite,
    DivingCenter,
    User,
)
from app.services.briefing_service import BriefingService


@pytest.fixture
def briefing_test_setup(db_session):
    user = User(
        username="manager_briefing",
        email="manager@briefingtest.com",
        password_hash="fake_hash_value",
    )
    db_session.add(user)
    db_session.commit()

    center = DivingCenter(
        name="Briefing Test Center",
        phone="+30 210 9999999",
        email="info@briefingcenter.com",
        owner_id=user.id,
    )
    db_session.add(center)
    db_session.commit()

    site = DiveSite(
        name="Zenobia Wreck",
        latitude=34.9125,
        longitude=33.6542,
        max_depth=42.0,
    )
    db_session.add(site)
    db_session.commit()

    product = OctoProduct(
        id="prod-briefing-1",
        diving_center_id=center.id,
        title="Zenobia Wreck Morning Charter",
        product_type="GUIDED_BOAT_TRIP",
        dive_site_id=site.id,
    )
    db_session.add(product)
    db_session.commit()

    option = OctoOption(
        id="opt-briefing-1",
        product_id=product.id,
        title="08:30 Zenobia Departure",
        meeting_time="08:30",
        departure_time="09:00",
    )
    db_session.add(option)
    db_session.commit()

    slot = OctoAvailabilitySlot(
        id="slot-briefing-1",
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        end_datetime=datetime.now(timezone.utc) + timedelta(days=1, hours=4),
        seats_total=12,
        seats_available=12,
    )
    db_session.add(slot)
    db_session.commit()

    return {
        "user": user,
        "center": center,
        "site": site,
        "product": product,
        "option": option,
        "slot": slot,
    }


def test_compile_draft_briefing(db_session, briefing_test_setup):
    slot = briefing_test_setup["slot"]

    with patch("app.services.open_meteo_service.fetch_wind_data_single_point") as mock_weather:
        mock_weather.return_value = {
            "wind_speed_10m": 4.5,
            "wind_direction_10m": 190,
            "wind_gusts_10m": 6.2,
            "wave_height": 0.5,
            "sea_surface_temperature": 23.5,
        }

        briefing = BriefingService.compile_draft_briefing(db_session, slot.id)
        assert briefing.id is not None
        assert briefing.status == "DRAFT_PENDING_REVIEW"
        assert briefing.active_dive_site_id == briefing_test_setup["site"].id
        assert briefing.weather_forecast_data["wind_speed_kts"] == round(4.5 * 1.94384, 1)
        assert briefing.weather_forecast_data["wave_height_m"] == 0.5
        assert briefing.weather_forecast_data["wave_height_ft"] == round(0.5 * 3.28084, 1)
        assert "Zenobia Wreck" in briefing.site_profile_notes
        assert "42.0m (138ft)" in briefing.site_profile_notes
        assert "Capt. Nikos" in briefing.crew_manifest["skipper_name"]
        assert "hyperbaric_chamber" in briefing.emergency_action_plan


def test_generate_briefing_pdf(db_session, briefing_test_setup):
    slot = briefing_test_setup["slot"]
    briefing = BriefingService.compile_draft_briefing(db_session, slot.id)

    pdf_bytes = BriefingService.generate_briefing_pdf(briefing, db_session)
    assert pdf_bytes is not None
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1000


def test_dispatch_briefing(db_session, briefing_test_setup):
    slot = briefing_test_setup["slot"]
    user = briefing_test_setup["user"]

    briefing = BriefingService.dispatch_briefing(db_session, slot.id, dispatched_by_user_id=user.id)
    assert briefing.status == "APPROVED_DISPATCHED"
    assert briefing.dispatched_at is not None
    assert briefing.dispatched_by_user_id == user.id
