import pytest
import os
from sqlalchemy.orm import Session
from app.routers.dives.dives_import import parse_garmin_fit_file

def test_parse_real_garmin_file_1(db_session: Session):
    """Test parsing the first real Garmin FIT file."""
    file_path = "garmin_2023-08-17-08-51-59.fit"
    if not os.path.exists(file_path):
        pytest.skip(f"File {file_path} not found")
        
    with open(file_path, "rb") as f:
        content = f.read()
        
    # We use a dummy user ID 1
    dives = parse_garmin_fit_file(content, db_session, 1)
    
    assert len(dives) > 0
    dive = dives[0]
    
    # Verify expected fields from the spec/design
    assert "max_depth" in dive
    assert "duration" in dive
    assert "dive_date" == "2023-08-17"
    assert "latitude" in dive
    assert "longitude" in dive
    
    # Verify profile data extraction
    assert "profile_data" in dive
    assert len(dive["profile_data"]["samples"]) > 0

def test_parse_real_garmin_file_2(db_session: Session):
    """Test parsing the second real Garmin FIT file."""
    file_path = "garmin_2023-10-21-12-13-38.fit"
    if not os.path.exists(file_path):
        pytest.skip(f"File {file_path} not found")
        
    with open(file_path, "rb") as f:
        content = f.read()
        
    dives = parse_garmin_fit_file(content, db_session, 1)
    
    assert len(dives) > 0
    dive = dives[0]
    assert dive["dive_date"] == "2023-10-21"
    assert "latitude" in dive
    assert "profile_data" in dive
