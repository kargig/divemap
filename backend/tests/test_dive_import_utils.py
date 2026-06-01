
import pytest
import json
import orjson
from app.routers.dives.imports.gas_utils import create_structured_gas_data
from app.routers.dives.imports.subsurface import parse_cylinder
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

    def test_prefer_steel_for_back_gas(self):
        """Test that steel tanks are preferred for back gas over aluminum."""
        cylinders = [
            # AL80 (Aluminum)
            {'size': '11.1 l', 'description': 'AL80', 'start': '200 bar', 'end': '100 bar'},
            # 12L Steel
            {'size': '12.0 l', 'description': '12L Steel', 'start': '200 bar', 'end': '100 bar'}
        ]
        
        result_json = create_structured_gas_data(cylinders)
        result = orjson.loads(result_json)
        
        # 12L Steel should be back_gas
        assert result['back_gas']['tank'] == '12'
        assert '12l' in result['back_gas']['description'].lower()
        
        # AL80 should be stage
        assert len(result['stages']) == 1
        assert result['stages'][0]['tank'] == 'al80'

    def test_filter_gasses_without_pressures(self):
        """Test that if some gasses have pressures, those without are filtered out."""
        cylinders = [
            # Used gas (with pressure)
            {'size': '12.0 l', 'description': 'Main', 'start': '200 bar', 'end': '100 bar', 'o2': '32%'},
            # Unused gas (no pressure)
            {'size': '11.1 l', 'description': 'Stage 50%', 'o2': '50%'},
            # Another unused gas
            {'o2': '100%', 'description': 'O2'}
        ]
        
        result_json = create_structured_gas_data(cylinders)
        result = orjson.loads(result_json)
        
        # Only 1 tank should be left
        assert result['back_gas'] is not None
        assert len(result['stages']) == 0
        assert result['back_gas']['gas']['o2'] == 32

    def test_fallback_when_no_pressures_exist(self):
        """Test that if NO gasses have pressures, we keep all identifiable ones."""
        cylinders = [
            {'size': '12.0 l', 'description': 'Main', 'o2': '32%'},
            {'size': '11.1 l', 'description': 'Stage 50%', 'o2': '50%'}
        ]
        
        result_json = create_structured_gas_data(cylinders)
        result = orjson.loads(result_json)
        
        # Both tanks should be kept
        assert result['back_gas'] is not None
        assert len(result['stages']) == 1
        # 12L (index 0) > 11.1L (index 1), so index 0 is back gas
        assert result['back_gas']['gas']['o2'] == 32
        assert result['back_gas']['tank'] == '12'
        assert result['stages'][0]['tank'] == 'al80'

