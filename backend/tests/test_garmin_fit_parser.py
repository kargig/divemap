import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, date, time
from app.routers.dives.imports.garmin import parse_garmin_fit_file
from app.routers.dives.imports.common import semicircles_to_degrees

def test_semicircles_to_degrees():
    # 180 / 2^31 * 1 = 8.381903171539307e-08
    # Test with a known value: 27.81 degrees in semicircles
    semicircles = 331777216 # Just a dummy value
    degrees = semicircles_to_degrees(semicircles)
    assert degrees is not None
    assert round(degrees, 2) == 27.81

def test_parse_garmin_fit_basic():
    # Mock content
    mock_content = b"fake binary content"
    
    # Mock fitdecode.FitReader
    with patch('fitdecode.FitReader') as mock_reader_class:
        mock_reader = MagicMock()
        mock_reader_class.return_value.__enter__.return_value = mock_reader
        
        # Mock frames
        # Frame 1: Session
        mock_session_frame = MagicMock()
        mock_session_frame.frame_type = 'data'
        mock_session_frame.name = 'session'
        
        session_values = {
            'max_depth': 25.5,
            'avg_depth': 15.2,
            'total_elapsed_time': 2700, # 45 min
            'start_time': datetime(2023, 8, 17, 8, 51, 59),
            'start_position_lat': 331777216,
            'start_position_long': 404743216,
            'avg_temperature': 24,
            'avg_heart_rate': 85,
            'timestamp': datetime(2023, 8, 17, 9, 0, 0)
        }
        
        mock_session_frame.get_value.side_effect = lambda key: session_values.get(key)
        
        # Frame 2: Record
        mock_record_frame = MagicMock()
        mock_record_frame.frame_type = 'data'
        mock_record_frame.name = 'record'
        
        record_values = {
            'timestamp': datetime(2023, 8, 17, 8, 56, 59), # 5 mins after start
            'depth': 10.5,
            'temperature': 22,
            'ndl_time': 1200, # 20 mins
            'next_stop_depth': 3.0,
            'next_stop_time': 60, # 1 min
            'cns_load': 10,
            'n2_load': 50
        }
        mock_record_frame.get_value.side_effect = lambda key: record_values.get(key)
        
        # Mock Dive Summary
        mock_summary_frame = MagicMock()
        mock_summary_frame.frame_type = 'data'
        mock_summary_frame.name = 'dive_summary'
        summary_values = {
            'timestamp': datetime(2023, 8, 17, 9, 0, 0),
            'end_cns': 15,
            'end_n2': 80
        }
        mock_summary_frame.get_value.side_effect = lambda key: summary_values.get(key)
        
        # Mock Dive Gas
        mock_gas_frame = MagicMock()
        mock_gas_frame.frame_type = 'data'
        mock_gas_frame.name = 'dive_gas'
        gas_values = {
            'oxygen_content': 32,
            'helium_content': 0
        }
        mock_gas_frame.get_value.side_effect = lambda key: gas_values.get(key)
        
        mock_reader.__iter__.return_value = [mock_session_frame, mock_record_frame, mock_summary_frame, mock_gas_frame]
        
        # Mock FIT_FRAME_DATA constant
        with patch('fitdecode.FIT_FRAME_DATA', 'data'), \
             patch('app.routers.dives.imports.garmin.find_sites_by_coords') as mock_find_sites, \
             patch('app.routers.dives.imports.garmin.find_existing_dive') as mock_find_existing:
            
            mock_find_sites.return_value = []
            mock_find_existing.return_value = None
            
            # Pass a mock DB session
            mock_db = MagicMock()
            dives = parse_garmin_fit_file(mock_content, mock_db, 1)
            
            assert len(dives) == 1
            dive = dives[0]
            assert dive["max_depth"] == 25.5
            assert dive["duration"] == 45
            assert dive["dive_date"] == "2023-08-17"
            
            # Verify profile data
            assert "profile_data" in dive
            assert len(dive["profile_data"]["samples"]) == 1
            sample = dive["profile_data"]["samples"][0]
            assert sample["time_minutes"] == 5.0
            assert sample["depth"] == 10.5
            assert sample["temperature"] == 22
            assert sample["ndl_minutes"] == 20.0
            assert sample["stopdepth"] == 3.0
            assert sample["stoptime_minutes"] == 1.0
            assert sample["cns_percent"] == 10
            assert sample["n2_percent"] == 50
            assert sample["in_deco"] is True
