import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from app.routers.dives.imports.garmin import parse_garmin_fit_file

def test_parse_suunto_style_fit_with_calculated_deco():
    # Mock content
    mock_content = b"fake suunto fit content"
    
    with patch('fitdecode.FitReader') as mock_reader_class:
        mock_reader = MagicMock()
        mock_reader_class.return_value.__enter__.return_value = mock_reader
        
        start_time = datetime(2026, 5, 31, 9, 26, 35)
        
        # Mock Session (Suunto style: minimal)
        mock_session_frame = MagicMock()
        mock_session_frame.frame_type = 'data'
        mock_session_frame.name = 'session'
        session_values = {
            'start_time': start_time,
            'total_elapsed_time': 3600, # 60 min
            'max_depth': 40.0,
            'avg_depth': 20.0
        }
        mock_session_frame.has_field.side_effect = lambda key: key in session_values
        mock_session_frame.get_value.side_effect = lambda key: session_values.get(key)
        
        # Mock Records (Just a few deep samples to trigger deco)
        records = []
        for i in range(0, 61, 10): # Every 10 mins
            mock_r = MagicMock()
            mock_r.frame_type = 'data'
            mock_r.name = 'record'
            # 40m depth from 10m to 50m
            d = 40.0 if 10 <= i <= 50 else 0.0
            r_values = {
                'timestamp': start_time + timedelta(minutes=i),
                'depth': d
            }
            mock_r.has_field.side_effect = lambda key, v=r_values: key in v
            mock_r.get_value.side_effect = lambda key, v=r_values: v.get(key)
            records.append(mock_r)
            
        # Mock Dive Settings (GFs)
        mock_settings_frame = MagicMock()
        mock_settings_frame.frame_type = 'data'
        mock_settings_frame.name = 'dive_settings'
        settings_values = {
            'gf_low': 30,
            'gf_high': 70
        }
        mock_settings_frame.has_field.side_effect = lambda key: key in settings_values
        mock_settings_frame.get_value.side_effect = lambda key: settings_values.get(key)
        
        # Mock Dive Gas
        mock_gas_frame = MagicMock()
        mock_gas_frame.frame_type = 'data'
        mock_gas_frame.name = 'dive_gas'
        gas_values = {
            'oxygen_content': 21,
            'helium_content': 0,
            'status': 'enabled'
        }
        mock_gas_frame.has_field.side_effect = lambda key: key in gas_values
        mock_gas_frame.get_value.side_effect = lambda key: gas_values.get(key)
        
        mock_reader.__iter__.return_value = [mock_session_frame, mock_settings_frame, mock_gas_frame] + records
        
        with patch('fitdecode.FIT_FRAME_DATA', 'data'), \
             patch('app.routers.dives.imports.garmin.find_sites_by_coords') as mock_find_sites, \
             patch('app.routers.dives.imports.garmin.find_existing_dive') as mock_find_existing:
            
            mock_find_sites.return_value = []
            mock_find_existing.return_value = None
            
            mock_db = MagicMock()
            dives = parse_garmin_fit_file(mock_content, mock_db, 1)
            
            assert len(dives) == 1
            dive = dives[0]
            samples = dive['profile_data']['samples']
            
            # Verify that some samples have 'stopdepth' set (calculated)
            deco_samples = [s for s in samples if s.get('stopdepth', 0) > 0]
            assert len(deco_samples) > 0
            assert all(s.get('calculated_deco') is True for s in deco_samples)
            
            # Verify GF inclusion in dive info
            assert "Deco Model: Bühlmann ZH-L16 (GF 30/70)" in dive["dive_information"]
            
            # Verify tissue saturation data
            assert "tissue_saturation" in dive["profile_data"]
            assert len(dive["profile_data"]["tissue_saturation"]) == 16
            
            # Verify tissue heatmap data
            assert "tissue_heatmap" in dive["profile_data"]
            assert len(dive["profile_data"]["tissue_heatmap"]) == len(samples)
