from datetime import UTC, datetime, time, timedelta

from app.models import (
    DiveSite,
    DivingCenterVessel,
    OctoAvailabilitySlot,
    OctoOption,
    OctoProduct,
)
from app.services.briefing_service import BriefingService


def test_briefing_extract_species_from_text():
    raw_text = "Dusky Grouper (15-25m), Loggerhead Sea Turtle, Octopus, Moray Eels, Barracuda schools"
    extracted = BriefingService.extract_species_from_text(raw_text)
    assert len(extracted) >= 4
    species_names = [e["species"] for e in extracted]
    assert any("Dusky Grouper" in s for s in species_names)
    assert any("Octopus" in s for s in species_names)


def test_briefing_extracts_from_site_marine_life(
    db_session, test_diving_center, test_user
):
    site = DiveSite(
        name="Zenobia Wreck Marine Reserve",
        latitude=34.91,
        longitude=33.65,
        max_depth=42.0,
        marine_life="Amberjack (20-30m), Dusky Grouper, Damselfish, Sea Bream",
    )
    db_session.add(site)
    db_session.flush()

    product = OctoProduct(
        id="prod-briefing-ml",
        diving_center_id=test_diving_center.id,
        dive_site_id=site.id,
        title="Zenobia Wreck 2-Tank Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    option = OctoOption(
        id="opt-briefing-ml",
        product_id=product.id,
        title="Morning Slot",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    db_session.add_all([product, option])
    db_session.flush()

    vessel = DivingCenterVessel(
        diving_center_id=test_diving_center.id,
        name="Briefing Boat",
        registration_number="BB-1234",
        licensed_capacity=12,
    )
    db_session.add(vessel)
    db_session.flush()

    start_dt = datetime.now(UTC) + timedelta(days=1)
    slot = OctoAvailabilitySlot(
        id="slot-briefing-ml",
        product_id=product.id,
        option_id=option.id,
        vessel_id=vessel.id,
        start_datetime=start_dt,
        end_datetime=start_dt + timedelta(hours=3),
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.commit()

    briefing = BriefingService.compile_draft_briefing(db_session, slot.id)
    assert briefing.marine_life_highlights is not None
    species_list = [item["species"] for item in briefing.marine_life_highlights]
    assert any("Amberjack" in s for s in species_list)
    assert any("Dusky Grouper" in s for s in species_list)

    # Generate PDF to verify table creation without likelihood column
    pdf_bytes = BriefingService.generate_briefing_pdf(briefing, db_session)
    assert pdf_bytes is not None
    assert pdf_bytes.startswith(b"%PDF")
