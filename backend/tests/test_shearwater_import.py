import os
import sqlite3
import tempfile
import pytest
from fastapi import status
from app.models import Dive

def test_shearwater_import_success(client, auth_headers, db_session, test_user):
    # Retrieve the path to the real Shearwater.db file in the workspace
    db_path = os.path.join(os.path.dirname(__file__), "Shearwater.db")
    assert os.path.exists(db_path), f"Sample file not found at {db_path}"
    
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/v1/dives/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
        
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "Successfully parsed 259 dives from Shearwater database" in data["message"]
    assert len(data["dives"]) == 259
    
    # Verify the details of the first parsed dive
    first_dive = data["dives"][0]
    assert first_dive["dive_date"] == "2021-10-10"
    assert first_dive["dive_time"] == "11:57:21"
    assert first_dive["duration"] == 67 # 4053s // 60
    assert first_dive["max_depth"] == 28.3
    assert first_dive["average_depth"] == 11.33 # from calculated_values_from_samples
    assert first_dive["location"] == "Attiki"
    assert first_dive["site"] == "Porto Ennea"
    assert first_dive["unmatched_dive_site"]["name"] == "Porto Ennea"
    assert "Gradient Factors: 30/70" in first_dive["dive_information"]
    
    # Cylinder Deduplication Check: First dive has only 1 active gas, 5 placeholders should be skipped
    assert len(first_dive["cylinders"]) == 1
    assert first_dive["cylinders"][0]["o2"] == 32
    assert first_dive["cylinders"][0]["he"] == 0
    assert first_dive["cylinders"][0]["size"] == 12.0
    
    # Samples validation
    assert len(first_dive["profile_data"]["samples"]) > 0
    first_sample = first_dive["profile_data"]["samples"][0]
    assert first_sample["time_minutes"] == 0.0
    assert first_sample["depth"] == 0.0 # start at surface

def test_shearwater_import_multigas_and_pressures(client, auth_headers, db_session, test_user):
    db_path = os.path.join(os.path.dirname(__file__), "Shearwater.db")
    assert os.path.exists(db_path), f"Sample file not found at {db_path}"
    
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/v1/dives/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
        
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Dive index 107 is a confirmed multi-gas dive (Air + EAN32)
    multigas_dive = data["dives"][107]
    assert multigas_dive["dive_date"] == "2023-12-03"
    assert multigas_dive["dive_time"] == "13:44:16"
    
    # Deduplication check: Out of 6 raw placeholders, exactly 2 distinct gas profiles are kept
    assert len(multigas_dive["cylinders"]) == 2
    
    # Cylinder 0: Air (21% O2) with start/end pressures converted from PSI to Bar (1 PSI = 0.0689476 Bar)
    # Start: 2900.75 PSI * 0.0689476 -> ~200 Bar
    # End: 1160.30 PSI * 0.0689476 -> ~80 Bar
    cyl_0 = multigas_dive["cylinders"][0]
    assert cyl_0["o2"] == 21
    assert cyl_0["he"] == 0
    assert cyl_0["start"] == 200.0
    assert cyl_0["end"] == 80.0
    
    # Cylinder 1: Nitrox (32% O2) with no pressure data
    cyl_1 = multigas_dive["cylinders"][1]
    assert cyl_1["o2"] == 32
    assert cyl_1["he"] == 0
    assert cyl_1["start"] is None
    assert cyl_1["end"] is None

    # Verify that gaschange events are populated correctly
    events = multigas_dive["profile_data"]["events"]
    assert len(events) == 2
    
    # First event: start on Cylinder 0 (Air)
    assert events[0]["time_minutes"] == 0.0
    assert events[0]["type"] == "gaschange"
    assert events[0]["cylinder"] == 0
    
    # Second event: switch to Cylinder 1 (EAN32) at 230 seconds (3.833 mins)
    assert events[1]["time_minutes"] == round(230.0 / 60.0, 3)
    assert events[1]["type"] == "gaschange"
    assert events[1]["cylinder"] == 1

def test_shearwater_import_invalid_schema(client, auth_headers):
    # Dynamically create an SQLite DB with missing tables
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        temp_name = tmp.name
        
    try:
        # Create valid SQLite file but with a dummy table
        conn = sqlite3.connect(temp_name)
        conn.execute("CREATE TABLE dummy_table (id INTEGER PRIMARY KEY)")
        conn.commit()
        conn.close()
        
        with open(temp_name, "rb") as f:
            response = client.post(
                "/api/v1/dives/import/shearwater-db",
                headers=auth_headers,
                files={"file": ("invalid_schema.db", f, "application/x-sqlite3")}
            )
            
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Database missing 'dive_details' table" in response.json()["detail"]
    finally:
        if os.path.exists(temp_name):
            os.remove(temp_name)

def test_shearwater_import_invalid_file(client, auth_headers):
    # Upload an empty non-db file to trigger validation
    response = client.post(
        "/api/v1/dives/import/shearwater-db",
        headers=auth_headers,
        files={"file": ("invalid.txt", b"invalid data", "text/plain")}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "must be a SQLite" in response.json()["detail"]

def test_shearwater_import_duplicate_detection(client, auth_headers, db_session, test_user):
    # Create an existing dive that matches the first dive in the database
    existing_dive = Dive(
        user_id=test_user.id,
        dive_date="2021-10-10",
        dive_time="11:57:21",
        duration=67,
        max_depth=28.3
    )
    db_session.add(existing_dive)
    db_session.commit()
    
    db_path = os.path.join(os.path.dirname(__file__), "Shearwater.db")
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/v1/dives/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
        
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    first_dive = data["dives"][0]
    
    # Assert duplicate detection marked it as skip and referenced the existing ID
    assert first_dive.get("skip") is True
    assert first_dive.get("existing_dive_id") == existing_dive.id

def test_similarity_matching_optimizations():
    from app.routers.dives.dives_utils import calculate_similarity
    
    # Verify shipping and wreck prefixes ignoring
    assert calculate_similarity("Kyra Leni - Patroklos", "S/S Kyra Leni") >= 0.6
    assert calculate_similarity("Patroklos", "M/V Patroklos") >= 0.8
    assert calculate_similarity("Zenobia wreck", "Zenobia") >= 0.8
    
    # Verify Roman numerals ignoring and subset matching rule
    assert calculate_similarity("Avantis wreck - Agkistri", "Avantis III") >= 0.8
    assert calculate_similarity("Zenobia I", "Zenobia") >= 0.8

def test_shearwater_import_tank_sizes(client, auth_headers, db_session, test_user):
    db_path = os.path.join(os.path.dirname(__file__), "Shearwater.db")
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/v1/dives/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Dive index 64 has a confirmed 15L tank size
    fifteen_l_dive = data["dives"][64]
    assert fifteen_l_dive["dive_date"] == "2022-11-12"
    assert fifteen_l_dive["cylinders"][0]["size"] == 15.0
