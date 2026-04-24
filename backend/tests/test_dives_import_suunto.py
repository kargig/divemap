import pytest
from fastapi.testclient import TestClient
import orjson

def test_import_suunto_json(client, auth_headers):
    # Mock data for Format A
    mock_data = {
        "DeviceLog": {
            "Header": {
                "DateTime": "2026-04-04T14:08:18.260+03:00",
                "Duration": 2511,
                "Device": {"Name": "Suunto D5"},
                "Diving": {
                    "Gases": [{"Oxygen": 0.32, "TankSize": 0.012, "TankFillPressure": 20000000, "EndPressure": 5000000}], 
                    "MaxCNS": 0.1, 
                    "EndTissue": {"CNS": 0.1, "OTU": 15},
                    "Ventilation": 0.0003
                }
            },
            "Samples": [{"TimeISO8601": "2026-04-04T14:08:19.040+03:00", "Depth": 1.43}]
        }
    }
    
    files = {'file': ('test.json', orjson.dumps(mock_data), 'application/json')}
    response = client.post(
        "/api/v1/dives/import/suunto-json",
        headers=auth_headers,
        files=files
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "Successfully parsed 1 dives" in data["message"]
    assert len(data["dives"]) == 1
    dive = data["dives"][0]
    assert dive["dive_date"] == "2026-04-04"
    assert dive["max_depth"] == 1.43
    assert "SAC: 38.41 l/min" in dive["dive_information"]
    assert "CNS: 10%" in dive["dive_information"]
    assert len(dive["profile_data"]["samples"]) == 1

def test_import_suunto_invalid_extension(client, auth_headers):
    files = {'file': ('test.txt', b'some data', 'text/plain')}
    response = client.post(
        "/api/v1/dives/import/suunto-json",
        headers=auth_headers,
        files=files
    )
    assert response.status_code == 400
    assert "File must be a JSON file" in response.json()["detail"]

def test_import_suunto_invalid_json(client, auth_headers):
    files = {'file': ('test.json', b'invalid json', 'application/json')}
    response = client.post(
        "/api/v1/dives/import/suunto-json",
        headers=auth_headers,
        files=files
    )
    assert response.status_code == 400
    assert "Error processing Suunto JSON file" == response.json()["detail"]

def test_import_suunto_duplicate_detection(client, auth_headers, test_user, db_session):
    from app.models import Dive
    from datetime import date, time
    
    # Create an existing dive
    existing_dive = Dive(
        user_id=test_user.id,
        dive_date=date(2026, 4, 4),
        dive_time=time(14, 8, 18),
        duration=41,
        max_depth=1.43
    )
    db_session.add(existing_dive)
    db_session.commit()

    mock_data = {
        "DeviceLog": {
            "Header": {
                "DateTime": "2026-04-04T14:08:18.260+03:00",
                "Duration": 2511,
                "Device": {"Name": "Suunto D5"},
                "Diving": {
                    "Gases": [{"Oxygen": 0.32, "TankSize": 0.012, "TankFillPressure": 20000000, "EndPressure": 5000000}], 
                    "MaxCNS": 0.1, 
                    "EndTissue": {"CNS": 0.1, "OTU": 15},
                    "Ventilation": 0.0003
                }
            },
            "Samples": [{"TimeISO8601": "2026-04-04T14:08:19.040+03:00", "Depth": 1.43}]
        }
    }
    
    files = {'file': ('test.json', orjson.dumps(mock_data), 'application/json')}
    response = client.post(
        "/api/v1/dives/import/suunto-json",
        headers=auth_headers,
        files=files
    )
    
    assert response.status_code == 200
    data = response.json()
    dive = data["dives"][0]
    assert dive["existing_dive_id"] == existing_dive.id
    assert dive["skip"] is True

def test_confirm_import_with_profile(client, auth_headers, db_session):
    # Mock data as returned by the parser
    dives_data = [{
        "dive_date": "2026-04-04",
        "dive_time": "14:08:18",
        "duration": 41,
        "max_depth": 25.5,
        "name": "Test Suunto Dive",
        "dive_information": "SAC: 18.0 L/min\nCNS: 15%\nOTU: 20\nWeights: 8kg",
        "profile_data": {
            "samples": [
                {"time_minutes": 0.0, "depth": 0.0, "temperature": 25.0},
                {"time_minutes": 1.0, "depth": 10.0, "temperature": 24.0}
            ],
            "events": [],
            "calculated_max_depth": 25.5,
            "calculated_avg_depth": 15.0,
            "calculated_duration_minutes": 41
        }
    }]
    
    response = client.post(
        "/api/v1/dives/import/confirm",
        headers=auth_headers,
        json=dives_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_imported"] == 1
    
    # Verify in DB
    from app.models import Dive
    dive = db_session.query(Dive).filter(Dive.id == data["imported_dives"][0]["id"]).first()
    assert dive.profile_xml_path is not None
    assert dive.profile_sample_count == 2
    assert "SAC: 18.0 L/min" in dive.dive_information
    assert "CNS: 15%" in dive.dive_information
