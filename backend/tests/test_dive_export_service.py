import pytest
from datetime import date, time
from app.models import Dive, DiveSite
from app.services.dive_export_service import DiveExportService

class TestDiveExportService:
    @pytest.fixture
    def sample_dive(self):
        return Dive(
            id=470,
            dive_date=date(2026, 4, 26),
            dive_time=time(10, 30),
            duration=45,
            max_depth=30.5,
            average_depth=15.2,
            dive_information="Buddy: John Doe\nSAC: 15.5 l/min\nOTU: 25\nCNS: 12%\nComputer: Shearwater Perdix\nDeco Model: GF 30/70\nWeights: 6.5 kg\nWonderful dive at the reef",
            user_rating=8,
            visibility_rating=6
        )

    @pytest.fixture
    def sample_dive_site(self):
        return DiveSite(
            id=123,
            name="Great Reef",
            latitude=37.123456,
            longitude=23.654321,
            description="A beautiful reef with many fish"
        )

    @pytest.fixture
    def sample_profile_data(self):
        return {
            "model": "Suunto D5",
            "deviceid": "SN123456",
            "samples": [
                {"time_minutes": 0, "depth": 0, "temperature": 22.5, "cns_percent": 5, "ndl_minutes": 99},
                {"time_minutes": 1, "depth": 10.2, "temperature": 21.8, "cns_percent": 6},
                {"time_minutes": 2, "depth": 20.5, "temperature": 20.5, "cns_percent": 8, "stopdepth": 3, "stoptime_minutes": 1},
                {"time_minutes": 45, "depth": 0, "temperature": 22.0, "cns_percent": 12}
            ],
            "temperature_range": {"min": 20.5, "max": 22.5},
            "events": [
                {"time": "20:00 min", "name": "Deco Warning", "type": "1", "value": "3"}
            ]
        }

    def test_export_to_subsurface_xml(self, sample_dive, sample_profile_data, sample_dive_site):
        service = DiveExportService()
        tags = ["Wreck", "Nitrox"]
        xml_output = service.export_to_subsurface_xml(sample_dive, sample_profile_data, sample_dive_site, tags)
        
        # Verify Subsurface styling
        assert "program='divemap'" in xml_output
        assert "uuid='0000007b'" in xml_output
        assert "sac='15.5 l/min'" in xml_output
        assert "otu='25'" in xml_output
        assert "cns='12%'" in xml_output
        assert "tags='Wreck, Nitrox'" in xml_output
        
        # Verify Element order & data
        assert "John Doe" in xml_output
        assert "Shearwater Perdix" in xml_output
        assert "GF 30/70" in xml_output
        assert "weight='6.5 kg'" in xml_output
        assert "Wonderful dive at the reef" in xml_output
        assert "max='30.5 m'" in xml_output
        assert "mean='15.200 m'" in xml_output
        
        # Verify self-closing space
        assert " />" in xml_output

    def test_export_to_subsurface_xml_gaschange(self, sample_dive):
        service = DiveExportService()
        profile_data = {
            "samples": [],
            "events": [
                {"time": "10:00 min", "name": "gaschange", "cylinder": 1, "o2": 50, "he": 0}
            ]
        }
        xml_output = service.export_to_subsurface_xml(sample_dive, profile_data)
        assert "name='gaschange'" in xml_output
        assert "cylinder='1'" in xml_output
        assert "o2='50.0%'" in xml_output

    def test_export_to_subsurface_xml_gas_fallback(self, sample_dive):
        service = DiveExportService()
        # Profile has NO cylinders
        profile_data = {"samples": []}
        # Dive has gas_bottles_used in DB
        import orjson
        sample_dive.gas_bottles_used = orjson.dumps({
            "back_gas": {
                "tank": "14",
                "start_pressure": 200,
                "end_pressure": 60,
                "gas": {"o2": 21, "he": 0},
                "description": "D7 220 bar",
                "workpressure": 220,
                "depth": 66.019
            },
            "stages": []
        }).decode('utf-8')
        
        xml_output = service.export_to_subsurface_xml(sample_dive, profile_data)
        assert "<cylinder" in xml_output
        assert "size='14.0 l'" in xml_output
        assert "description='D7 220 bar'" in xml_output
        assert "workpressure='220.0 bar'" in xml_output
        assert "depth='66.019 m'" in xml_output

    def test_export_to_suunto_json(self, sample_dive, sample_profile_data):
        service = DiveExportService()
        json_output_bytes = service.export_to_suunto_json(sample_dive, sample_profile_data)
        import orjson
        data = orjson.loads(json_output_bytes)
        
        assert data["header"]["activityId"] == "470"
        assert data["header"]["startTime"] == "2026-04-26T10:30:00Z"
        assert data["summary"]["maxDepth"] == 30.5
        assert len(data["samples"]) == 4
        assert data["samples"][1]["depth"] == 10.2
        assert data["samples"][1]["temperature"] == 21.8

    def test_export_to_garmin_fit(self, sample_dive, sample_profile_data):
        service = DiveExportService()
        try:
            fit_output = service.export_to_garmin_fit(sample_dive, sample_profile_data)
            assert isinstance(fit_output, bytes)
            assert len(fit_output) > 0
            # Basic FIT file magic byte check if possible, or just length
            assert b'.FIT' in fit_output[:20]
        except RuntimeError as e:
            if "garmin-fit-sdk not installed" in str(e):
                pytest.skip("garmin-fit-sdk not installed")
            raise
