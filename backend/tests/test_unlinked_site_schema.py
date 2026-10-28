from app.models import Dive
from app.schemas import DiveCreate, DiveResponse, DiveUpdate


def test_dive_schema_supports_unlinked_site_name():
    data = {
        "dive_date": "2026-10-12",
        "unlinked_site_name": "Shark Reef & Yolanda",
        "dive_site_id": None,
    }
    create_schema = DiveCreate(**data)
    assert create_schema.unlinked_site_name == "Shark Reef & Yolanda"
    assert create_schema.dive_site_id is None


def test_dive_update_schema_supports_unlinked_site_name():
    update_schema = DiveUpdate(unlinked_site_name="Blue Hole")
    assert update_schema.unlinked_site_name == "Blue Hole"


def test_dive_response_schema_supports_unlinked_site_name():
    resp = DiveResponse(
        id=1,
        user_id=1,
        dive_date="2026-10-12",
        unlinked_site_name="Ras Mohammed",
    )
    assert resp.unlinked_site_name == "Ras Mohammed"


def test_dive_model_has_unlinked_site_name_column():
    assert hasattr(Dive, "unlinked_site_name")
    assert Dive.unlinked_site_name.property.columns[0].nullable is True
