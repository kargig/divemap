import pytest
import json
import tempfile
import os
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient

from app.models import Dive, DiveSite, User


class TestDiveImportWithProfiles:
    """Test dive import functionality with profile data."""

    @pytest.fixture
    def sample_subsurface_xml(self):
        """Sample Subsurface XML content for testing."""
        return """<?xml version="1.0" encoding="UTF-8"?>
<dives>
    <dive>
        <diveid>test_dive_123</diveid>
        <number>1</number>
        <date>2024-09-27</date>
        <time>12:11:13</time>
        <duration>82:30</duration>
        <maxdepth>48.7</maxdepth>
        <meandepth>22.068</meandepth>
        <watertemp>24</watertemp>
        <rating>4</rating>
        <visibility>3</visibility>
        <sac>13.147</sac>
        <otu>82</otu>
        <cns>29</cns>
        <tags>Wreck</tags>
        <divesiteid>5520dc00</divesiteid>
        <buddy>Nikos Vardakas</buddy>
        <suit>DrySuit Rofos</suit>
        <cylinder>
            <size>24.0</size>
            <workpressure>232.0</workpressure>
            <description>D12 232 bar</description>
            <o2>22.0</o2>
            <start>210.0</start>
            <end>100.0</end>
            <depth>62.551</depth>
        </cylinder>
        <weightsystem>
            <weight>3.2</weight>
            <description>weight</description>
        </weightsystem>
        <computer>
            <model>Shearwater Perdix AI</model>
            <deviceid>8a66df8d</deviceid>
        </computer>
        <extra_data>
            <Logversion>14(PNF)</Logversion>
            <Serial>206352f8</Serial>
            <FW Version>93</FW Version>
            <Deco model>GF 30/85</Deco model>
            <Battery type>1.5V Lithium</Battery type>
            <Battery at end>1.7 V</Battery at end>
        </extra_data>
        <samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='0:30 min' depth='3.8 m' />
            <sample time='0:40 min' depth='4.1 m' />
            <sample time='0:50 min' depth='5.5 m' temperature='33 C' />
            <sample time='1:00 min' depth='4.8 m' />
            <sample time='9:00 min' depth='44.2 m' ndl='0:00 min' cns='3%' />
            <sample time='10:20 min' depth='45.6 m' in_deco='1' stoptime='1:00 min' stopdepth='3.0 m' />
            <sample time='75:10 min' depth='6.8 m' ndl='99:00 min' in_deco='0' stopdepth='0.0 m' />
            <sample time='82:30 min' depth='0.0 m' />
        </samples>
        <events>
            <event time='0:10 min' type='25' flags='1' name='gaschange' cylinder='0' o2='22.0%' />
            <event time='36:00 min' type='25' flags='2' name='gaschange' cylinder='1' o2='49.0%' />
        </events>
    </dive>
</dives>"""

    @pytest.fixture
    def sample_dive_data_with_profile(self):
        """Sample dive data with profile information."""
        return {
            "dive_site_id": 1,
            "name": "Test Dive with Profile",
            "is_private": False,
            "dive_information": "Test dive information",
            "max_depth": 48.7,
            "average_depth": 22.068,
            "gas_bottles_used": "24.0l 232 bar | O2: 22.0% | 210.0 bar→100.0 bar",
            "suit_type": "dry_suit",
            "difficulty_level": 2,
            "visibility_rating": 6,
            "user_rating": 8,
            "dive_date": "2024-09-27",
            "dive_time": "12:11:13",
            "duration": 82,
            "profile_data": {
                "samples": [
                    {"time_minutes": 0.16666666666666666, "depth": 2.7, "temperature": 34},
                    {"time_minutes": 0.3333333333333333, "depth": 4.0, "ndl_minutes": 99},
                    {"time_minutes": 0.5, "depth": 3.8},
                    {"time_minutes": 0.6666666666666666, "depth": 4.1},
                    {"time_minutes": 0.8333333333333334, "depth": 5.5, "temperature": 33},
                    {"time_minutes": 1.0, "depth": 4.8},
                    {"time_minutes": 9.0, "depth": 44.2, "ndl_minutes": 0, "cns_percent": 3},
                    {"time_minutes": 10.333333333333334, "depth": 45.6, "in_deco": True, "stoptime_minutes": 1.0, "stopdepth": 3.0},
                    {"time_minutes": 75.16666666666667, "depth": 6.8, "ndl_minutes": 99, "in_deco": False, "stopdepth": 0.0},
                    {"time_minutes": 82.5, "depth": 0.0}
                ],
                "events": [
                    {"time_minutes": 0.16666666666666666, "type": "25", "flags": "1", "name": "gaschange", "cylinder": "0", "o2": "22.0%"},
                    {"time_minutes": 36.0, "type": "25", "flags": "2", "name": "gaschange", "cylinder": "1", "o2": "49.0%"}
                ],
                "calculated_avg_depth": 21.85,
                "calculated_max_depth": 48.6,
                "calculated_duration_minutes": 83.33333333333333,
                "sample_count": 10,
                "temperature_range": {"min": 24, "max": 34}
            }
        }

    def test_import_subsurface_xml_with_profile_success(self, client, auth_headers, test_dive_site, sample_subsurface_xml):
        """Test successful import of Subsurface XML with profile data."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.return_value = "user_1/2025/09/dive_profile.json"
            
            files = {"file": ("test.xml", sample_subsurface_xml, "application/xml")}
            response = client.post("/api/v1/dives/import/subsurface-xml", 
                                 files=files, headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "dives" in data
            assert len(data["dives"]) == 1
            
            dive_data = data["dives"][0]
            assert "profile_data" in dive_data
            assert dive_data["profile_data"]["sample_count"] == 10
            assert dive_data["profile_data"]["calculated_max_depth"] == 48.6
            assert dive_data["profile_data"]["calculated_avg_depth"] == 21.85
            assert len(dive_data["profile_data"]["samples"]) == 10

    def test_import_subsurface_xml_with_decompression_data(self, client, auth_headers, test_dive_site, sample_subsurface_xml):
        """Test import of Subsurface XML with decompression data."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.return_value = "user_1/2025/09/dive_profile.json"
            
            files = {"file": ("test.xml", sample_subsurface_xml, "application/xml")}
            response = client.post("/api/v1/dives/import/subsurface-xml", 
                                 files=files, headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            dive_data = data["dives"][0]
            
            # Check decompression sample
            deco_sample = None
            for sample in dive_data["profile_data"]["samples"]:
                if sample.get("in_deco") == True:
                    deco_sample = sample
                    break
            
            assert deco_sample is not None
            assert deco_sample["time_minutes"] == 10.333333333333334
            assert deco_sample["depth"] == 45.6
            assert deco_sample["stoptime_minutes"] == 1.0
            assert deco_sample["stopdepth"] == 3.0

    def test_import_subsurface_xml_without_profile_data(self, client, auth_headers, test_dive_site):
        """Test import of Subsurface XML without profile data."""
        xml_without_profile = """<?xml version="1.0" encoding="UTF-8"?>
<dives>
    <dive>
        <diveid>test_dive_123</diveid>
        <number>1</number>
        <date>2024-09-27</date>
        <time>12:11:13</time>
        <duration>82:30</duration>
        <maxdepth>48.7</maxdepth>
        <meandepth>22.068</meandepth>
        <watertemp>24</watertemp>
    </dive>
</dives>"""
        
        files = {"file": ("test.xml", xml_without_profile, "application/xml")}
        response = client.post("/api/v1/dives/import/subsurface-xml", 
                             files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        dive_data = data["dives"][0]
        assert "profile_data" not in dive_data

    def test_import_subsurface_xml_with_empty_samples(self, client, auth_headers, test_dive_site):
        """Test import of Subsurface XML with empty samples."""
        xml_with_empty_samples = """<?xml version="1.0" encoding="UTF-8"?>
<dives>
    <dive>
        <diveid>test_dive_123</diveid>
        <number>1</number>
        <date>2024-09-27</date>
        <time>12:11:13</time>
        <duration>82:30</duration>
        <maxdepth>48.7</maxdepth>
        <meandepth>22.068</meandepth>
        <watertemp>24</watertemp>
        <samples></samples>
    </dive>
</dives>"""
        
        files = {"file": ("test.xml", xml_with_empty_samples, "application/xml")}
        response = client.post("/api/v1/dives/import/subsurface-xml", 
                             files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        dive_data = data["dives"][0]
        assert "profile_data" not in dive_data

    def test_confirm_import_dives_with_profile_success(self, client, auth_headers, test_dive_site, sample_dive_data_with_profile):
        """Test successful confirmation of dive import with profile data."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.return_value = "user_1/2025/09/dive_profile.json"
            
            response = client.post("/api/v1/dives/import/confirm", 
                                 json=[sample_dive_data_with_profile], 
                                 headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "dives" in data
            assert len(data["dives"]) == 1
            
            dive = data["dives"][0]
            assert dive["name"] == "Test Dive with Profile"
            assert dive["max_depth"] == 48.7
            assert dive["average_depth"] == 22.068

    def test_confirm_import_dives_with_profile_storage_error(self, client, auth_headers, test_dive_site, sample_dive_data_with_profile):
        """Test dive import confirmation with profile storage error."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.side_effect = Exception("Storage error")
            
            response = client.post("/api/v1/dives/import/confirm", 
                                 json=[sample_dive_data_with_profile], 
                                 headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Error importing dives" in response.json()["detail"]

    def test_parse_dive_element_with_profile_data(self, client, auth_headers, test_dive_site):
        """Test parsing dive element with profile data."""
        from app.routers.dives import parse_dive_element
        
        dive_xml = """<dive>
            <diveid>test_dive_123</diveid>
            <number>1</number>
            <date>2024-09-27</date>
            <time>12:11:13</time>
            <duration>82:30</duration>
            <maxdepth>48.7</maxdepth>
            <meandepth>22.068</meandepth>
            <watertemp>24</watertemp>
            <samples>
                <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
                <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
                <sample time='1:00 min' depth='4.8 m' />
            </samples>
        </dive>"""
        
        from xml.etree.ElementTree import fromstring
        dive_element = fromstring(dive_xml)
        
        result = parse_dive_element(dive_element, test_dive_site.id, 1)
        
        assert result is not None
        assert "profile_data" in result
        assert result["profile_data"]["sample_count"] == 3
        assert result["profile_data"]["calculated_max_depth"] == 4.8
        assert len(result["profile_data"]["samples"]) == 3

    def test_parse_dive_element_without_profile_data(self, client, auth_headers, test_dive_site):
        """Test parsing dive element without profile data."""
        from app.routers.dives import parse_dive_element
        
        dive_xml = """<dive>
            <diveid>test_dive_123</diveid>
            <number>1</number>
            <date>2024-09-27</date>
            <time>12:11:13</time>
            <duration>82:30</duration>
            <maxdepth>48.7</maxdepth>
            <meandepth>22.068</meandepth>
            <watertemp>24</watertemp>
        </dive>"""
        
        from xml.etree.ElementTree import fromstring
        dive_element = fromstring(dive_xml)
        
        result = parse_dive_element(dive_element, test_dive_site.id, 1)
        
        assert result is not None
        assert "profile_data" not in result

    def test_parse_time_to_minutes_various_formats(self, client, auth_headers):
        """Test parsing various time formats."""
        from app.routers.dives import parse_time_to_minutes
        
        # Test MM:SS format
        assert parse_time_to_minutes("0:10 min") == 0.16666666666666666
        assert parse_time_to_minutes("1:30 min") == 1.5
        assert parse_time_to_minutes("10:20 min") == 10.333333333333334
        
        # Test HH:MM:SS format
        assert parse_time_to_minutes("1:00:00 min") == 60.0
        assert parse_time_to_minutes("1:30:00 min") == 90.0
        assert parse_time_to_minutes("2:15:30 min") == 135.5
        
        # Test invalid formats
        assert parse_time_to_minutes("invalid") == 0.0
        assert parse_time_to_minutes("") == 0.0
        assert parse_time_to_minutes(None) == 0.0

    def test_parse_dive_profile_samples_with_decompression(self, client, auth_headers):
        """Test parsing dive profile samples with decompression data."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='9:00 min' depth='44.2 m' ndl='0:00 min' cns='3%' />
            <sample time='10:20 min' depth='45.6 m' in_deco='1' stoptime='1:00 min' stopdepth='3.0 m' />
            <sample time='75:10 min' depth='6.8 m' ndl='99:00 min' in_deco='0' stopdepth='0.0 m' />
        </samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is not None
        assert len(result['samples']) == 5
        assert result['sample_count'] == 5
        
        # Check decompression sample
        deco_sample = None
        for sample in result['samples']:
            if sample.get('in_deco') == True:
                deco_sample = sample
                break
        
        assert deco_sample is not None
        assert deco_sample['time_minutes'] == 10.333333333333334
        assert deco_sample['depth'] == 45.6
        assert deco_sample['stoptime_minutes'] == 1.0
        assert deco_sample['stopdepth'] == 3.0

    def test_parse_dive_profile_samples_with_events(self, client, auth_headers):
        """Test parsing dive profile samples with events."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
        </samples>
        <events>
            <event time='0:10 min' type='25' flags='1' name='gaschange' cylinder='0' o2='22.0%' />
            <event time='36:00 min' type='25' flags='2' name='gaschange' cylinder='1' o2='49.0%' />
        </events>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is not None
        assert len(result['samples']) == 2
        assert len(result['events']) == 2
        
        # Check event data
        first_event = result['events'][0]
        assert first_event['time_minutes'] == 0.16666666666666666
        assert first_event['type'] == '25'
        assert first_event['name'] == 'gaschange'
        assert first_event['o2'] == '22.0%'

    def test_parse_dive_profile_samples_empty(self, client, auth_headers):
        """Test parsing empty dive profile samples."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples></samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is None

    def test_parse_dive_profile_samples_invalid_xml(self, client, auth_headers):
        """Test parsing invalid dive profile samples XML."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples>
            <sample time='invalid' depth='invalid' />
        </samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is not None
        assert len(result['samples']) == 1
        assert result['samples'][0]['time_minutes'] == 0
        assert result['samples'][0]['depth'] == 0
