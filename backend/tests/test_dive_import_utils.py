
import pytest
import json
import orjson
from app.routers.dives.dives_import import create_structured_gas_data, parse_cylinder
import xml.etree.ElementTree as ET

class TestDiveImportUtils:
    """Test utility functions for dive import."""

    def test_create_structured_gas_data_ghost_cylinder_filtering(self):
        """
        Regression test for ghost cylinder bug.
        Ensures that cylinders with no size, pressure, gas, or known description are filtered out.
        """
        # Create cylinder data mimicking the bug scenario
        # 1. Valid Stage
        # 2. Valid Backgas
        # 3. Ghost cylinder (empty/unknown)
        
        cylinders = [
            {'size': '7.0 l', 'workpressure': '200.0 bar', 'description': 'ALU7', 'o2': '50.0%', 'start': '200.0 bar', 'end': '120.0 bar'},
            {'size': '24.0 l', 'workpressure': '232.0 bar', 'description': 'D12 232 bar', 'o2': '28.0%', 'start': '200.0 bar', 'end': '90.0 bar'},
            {'description': 'unknown'}  # Ghost cylinder
        ]
        
        result_json = create_structured_gas_data(cylinders)
        result = orjson.loads(result_json)
        
        # Verify total tanks (should be 2, not 3)
        stages = result.get('stages', [])
        total_tanks = 1 + len(stages)  # 1 back_gas + N stages
        
        assert total_tanks == 2, f"Expected 2 tanks, got {total_tanks}. Ghost cylinder was not filtered."
        
        # Verify content
        # Backgas logic might pick index 0 or 1 depending on size/events, but we just check presence
        # 7L tank (Stage) and 24L tank (Backgas/Stage)
        
        tanks = [result['back_gas']] + stages
        tank_sizes = []
        o2_levels = []
        
        for t in tanks:
            # Check O2 to identify tanks
            o2_levels.append(t['gas']['o2'])
            
        o2_levels.sort()
        assert o2_levels == [28, 50], f"Expected O2 levels [28, 50], got {o2_levels}"

    def test_create_structured_gas_data_valid_cylinders_preserved(self):
        """Test that valid cylinders are not accidentally filtered."""
        cylinders = [
            {'size': '12.0 l', 'start': '200 bar'},  # Valid (size + pressure)
            {'description': 'My Tank'},             # Valid (custom description)
            {'o2': '32%'}                           # Valid (gas mix)
        ]
        
        result_json = create_structured_gas_data(cylinders)
        result = orjson.loads(result_json)
        
        stages = result.get('stages', [])
        total_tanks = 1 + len(stages)
        
        assert total_tanks == 3

    def test_create_structured_gas_data_all_ghosts_returns_none(self):
        """Test that if all cylinders are ghosts, returns None."""
        cylinders = [
            {'description': 'unknown'},
            {},
            {'description': ''}
        ]
        
        result = create_structured_gas_data(cylinders)
        assert result is None

