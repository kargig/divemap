"""
Dive Profile Parser Service

This service handles parsing of Subsurface XML dive profile data and extracts
detailed dive information including sample points, events, and metadata.
"""

import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Any
from datetime import datetime, time
import os
import logging

logger = logging.getLogger(__name__)


class DiveProfileParser:
    """Parser for Subsurface XML dive profile data."""
    
    def __init__(self):
        self.supported_formats = ['subsurface']
    
    def parse_xml_file(self, xml_file_path: str) -> Dict[str, Any]:
        """
        Parse a Subsurface XML file and extract dive profile data.
        
        Args:
            xml_file_path: Path to the XML file
            
        Returns:
            Dictionary containing parsed dive profile data
            
        Raises:
            FileNotFoundError: If XML file doesn't exist
            ET.ParseError: If XML is malformed
            ValueError: If dive data is invalid
        """
        if not os.path.exists(xml_file_path):
            raise FileNotFoundError(f"XML file not found: {xml_file_path}")
        
        try:
            tree = ET.parse(xml_file_path)
            root = tree.getroot()
            return self._parse_dive_element(root)
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error parsing dive profile: {e}")
            raise ValueError(f"Failed to parse dive profile: {e}")
    
    def parse_xml_content(self, xml_content: str) -> Dict[str, Any]:
        """
        Parse XML content string and extract dive profile data.
        
        Args:
            xml_content: XML content as string
            
        Returns:
            Dictionary containing parsed dive profile data
        """
        try:
            root = ET.fromstring(xml_content)
            return self._parse_dive_element(root)
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error parsing dive profile: {e}")
            raise ValueError(f"Failed to parse dive profile: {e}")
    
    def _parse_dive_element(self, root: ET.Element) -> Dict[str, Any]:
        """Parse the root dive element and extract all dive data."""
        dives = root.find('dives')
        if dives is None:
            raise ValueError("No dives found in XML")
        
        # Find the first dive (assuming single dive per file for now)
        dive = dives.find('dive')
        if dive is None:
            raise ValueError("No dive element found in XML")
        
        # Parse dive metadata
        dive_data = self._parse_dive_metadata(dive)
        
        # Parse dive computer data
        divecomputer = dive.find('divecomputer')
        if divecomputer is not None:
            dive_data.update(self._parse_divecomputer_data(divecomputer))
        
        # Parse sample data
        samples = self._parse_sample_data(dive)
        dive_data['samples'] = samples
        
        # Parse events
        events = self._parse_events(dive)
        dive_data['events'] = events
        
        # Calculate derived metrics
        dive_data.update(self._calculate_derived_metrics(samples))
        
        return dive_data
    
    def _parse_dive_metadata(self, dive: ET.Element) -> Dict[str, Any]:
        """Parse basic dive metadata from dive element."""
        metadata = {}
        
        # Basic dive information
        metadata['dive_number'] = dive.get('number')
        metadata['rating'] = dive.get('rating')
        metadata['visibility'] = dive.get('visibility')
        metadata['sac'] = dive.get('sac')  # Surface Air Consumption
        metadata['otu'] = dive.get('otu')  # Oxygen Toxicity Units
        metadata['cns'] = dive.get('cns')  # Central Nervous System
        metadata['tags'] = dive.get('tags')
        metadata['divesiteid'] = dive.get('divesiteid')
        metadata['date'] = dive.get('date')
        metadata['time'] = dive.get('time')
        metadata['duration'] = dive.get('duration')
        
        # Parse buddy information
        buddy = dive.find('buddy')
        if buddy is not None:
            metadata['buddy'] = buddy.text
        
        # Parse suit information
        suit = dive.find('suit')
        if suit is not None:
            metadata['suit'] = suit.text
        
        # Parse cylinder information
        cylinder = dive.find('cylinder')
        if cylinder is not None:
            metadata['cylinder'] = {
                'size': cylinder.get('size'),
                'workpressure': cylinder.get('workpressure'),
                'description': cylinder.get('description'),
                'o2': cylinder.get('o2'),
                'start': cylinder.get('start'),
                'end': cylinder.get('end'),
                'depth': cylinder.get('depth')
            }
        
        # Parse weight system
        weightsystem = dive.find('weightsystem')
        if weightsystem is not None:
            metadata['weightsystem'] = {
                'weight': weightsystem.get('weight'),
                'description': weightsystem.get('description')
            }
        
        return metadata
    
    def _parse_divecomputer_data(self, divecomputer: ET.Element) -> Dict[str, Any]:
        """Parse dive computer specific data."""
        dc_data = {}
        
        # Basic dive computer info
        dc_data['model'] = divecomputer.get('model')
        dc_data['deviceid'] = divecomputer.get('deviceid')
        dc_data['diveid'] = divecomputer.get('diveid')
        
        # Depth information
        depth = divecomputer.find('depth')
        if depth is not None:
            dc_data['max_depth'] = self._parse_depth(depth.get('max'))
            dc_data['mean_depth'] = self._parse_depth(depth.get('mean'))
        
        # Temperature
        temperature = divecomputer.find('temperature')
        if temperature is not None:
            dc_data['water_temperature'] = self._parse_temperature(temperature.get('water'))
        
        # Surface pressure
        surface_pressure = divecomputer.find('surface pressure')
        if surface_pressure is not None:
            dc_data['surface_pressure'] = self._parse_pressure(surface_pressure.get('value'))
        
        # Water salinity
        water_salinity = divecomputer.find('water salinity')
        if water_salinity is not None:
            dc_data['water_salinity'] = self._parse_salinity(water_salinity.get('value'))
        
        # Extra data
        extradata = divecomputer.findall('extradata')
        dc_data['extra_data'] = {}
        for data in extradata:
            key = data.get('key')
            value = data.get('value')
            if key and value:
                dc_data['extra_data'][key] = value
        
        return dc_data
    
    def _parse_sample_data(self, dive: ET.Element) -> List[Dict[str, Any]]:
        """Parse sample data from dive element."""
        samples = []
        divecomputer = dive.find('divecomputer')
        if divecomputer is None:
            return samples
        
        sample_elements = divecomputer.findall('sample')
        for sample in sample_elements:
            sample_data = {}
            
            # Parse time (convert to minutes)
            time_str = sample.get('time')
            if time_str:
                sample_data['time'] = time_str
                sample_data['time_minutes'] = self._parse_time_to_minutes(time_str)
            
            # Parse depth
            depth = sample.get('depth')
            if depth:
                sample_data['depth'] = self._parse_depth(depth)
            
            # Parse temperature
            temp = sample.get('temp')
            if temp:
                sample_data['temperature'] = self._parse_temperature(temp)
            
            # Parse NDL (No Decompression Limit)
            ndl = sample.get('ndl')
            if ndl:
                sample_data['ndl_minutes'] = self._parse_time_to_minutes(ndl)
            
            # Parse CNS
            cns = sample.get('cns')
            if cns:
                sample_data['cns_percent'] = self._parse_cns(cns)
            
            # Only add sample if it has essential data
            if 'time_minutes' in sample_data and 'depth' in sample_data:
                samples.append(sample_data)
        
        return samples
    
    def _parse_events(self, dive: ET.Element) -> List[Dict[str, Any]]:
        """Parse dive events from dive element."""
        events = []
        divecomputer = dive.find('divecomputer')
        if divecomputer is None:
            return events
        
        event_elements = divecomputer.findall('event')
        for event in event_elements:
            event_data = {
                'time': event.get('time'),
                'time_minutes': self._parse_time_to_minutes(event.get('time', '0:00 min')),
                'type': event.get('type'),
                'flags': event.get('flags'),
                'name': event.get('name'),
                'cylinder': event.get('cylinder'),
                'o2': event.get('o2')
            }
            events.append(event_data)
        
        return events
    
    def _calculate_derived_metrics(self, samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate derived metrics from sample data."""
        if not samples:
            return {}
        
        # Calculate average depth
        depths = [s['depth'] for s in samples if 'depth' in s]
        if depths:
            avg_depth = sum(depths) / len(depths)
        else:
            avg_depth = 0
        
        # Calculate max depth
        max_depth = max(depths) if depths else 0
        
        # Calculate total duration
        if samples:
            last_sample = samples[-1]
            total_duration = last_sample.get('time_minutes', 0)
        else:
            total_duration = 0
        
        # Calculate temperature range
        temperatures = [s['temperature'] for s in samples if 'temperature' in s]
        temp_range = {
            'min': min(temperatures) if temperatures else None,
            'max': max(temperatures) if temperatures else None
        }
        
        return {
            'calculated_avg_depth': round(avg_depth, 2),
            'calculated_max_depth': round(max_depth, 2),
            'calculated_duration_minutes': total_duration,
            'sample_count': len(samples),
            'temperature_range': temp_range
        }
    
    def _parse_depth(self, depth_str: Optional[str]) -> Optional[float]:
        """Parse depth string to float (meters)."""
        if not depth_str:
            return None
        try:
            # Remove 'm' suffix if present
            depth_str = depth_str.replace('m', '').strip()
            return float(depth_str)
        except (ValueError, AttributeError):
            return None
    
    def _parse_temperature(self, temp_str: Optional[str]) -> Optional[float]:
        """Parse temperature string to float (Celsius)."""
        if not temp_str:
            return None
        try:
            # Remove 'C' suffix if present
            temp_str = temp_str.replace('C', '').strip()
            return float(temp_str)
        except (ValueError, AttributeError):
            return None
    
    def _parse_pressure(self, pressure_str: Optional[str]) -> Optional[float]:
        """Parse pressure string to float (bar)."""
        if not pressure_str:
            return None
        try:
            # Remove 'bar' suffix if present
            pressure_str = pressure_str.replace('bar', '').strip()
            return float(pressure_str)
        except (ValueError, AttributeError):
            return None
    
    def _parse_salinity(self, salinity_str: Optional[str]) -> Optional[float]:
        """Parse salinity string to float (g/l)."""
        if not salinity_str:
            return None
        try:
            # Remove 'g/l' suffix if present
            salinity_str = salinity_str.replace('g/l', '').strip()
            return float(salinity_str)
        except (ValueError, AttributeError):
            return None
    
    def _parse_cns(self, cns_str: Optional[str]) -> Optional[float]:
        """Parse CNS percentage string to float."""
        if not cns_str:
            return None
        try:
            # Remove '%' suffix if present
            cns_str = cns_str.replace('%', '').strip()
            return float(cns_str)
        except (ValueError, AttributeError):
            return None
    
    def _parse_time_to_minutes(self, time_str: Optional[str]) -> float:
        """Parse time string to minutes (float)."""
        if not time_str:
            return 0.0
        
        try:
            # Handle formats like "1:30 min", "30:00 min", "0:10 min", "54:30 min"
            time_str = time_str.replace('min', '').strip()
            
            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 2:
                    # Format: MM:SS or HH:MM:SS
                    if len(parts[0]) > 2:  # More than 2 digits in first part, likely HH:MM:SS
                        hours = int(parts[0]) if parts[0] else 0
                        minutes = int(parts[1]) if parts[1] else 0
                        seconds = int(parts[2]) if len(parts) > 2 and parts[2] else 0
                        return hours * 60 + minutes + (seconds / 60.0)
                    else:  # Format: MM:SS
                        minutes = int(parts[0]) if parts[0] else 0
                        seconds = int(parts[1]) if parts[1] else 0
                        return minutes + (seconds / 60.0)
            
            # If no colon, assume it's already in minutes
            return float(time_str)
        except (ValueError, AttributeError):
            return 0.0

    def _parse_sample_element(self, sample: ET.Element) -> Dict[str, Any]:
        """Parse a single sample element."""
        sample_data = {}
        
        # Parse time (convert to minutes)
        time_str = sample.get('time')
        if time_str:
            sample_data['time'] = time_str
            sample_data['time_minutes'] = self._parse_time_to_minutes(time_str)
        
        # Parse depth
        depth = sample.get('depth')
        if depth:
            sample_data['depth'] = self._parse_depth(depth)
        
        # Parse temperature
        temp = sample.get('temp')
        if temp:
            sample_data['temperature'] = self._parse_temperature(temp)
        
        # Parse NDL (No Decompression Limit)
        ndl = sample.get('ndl')
        if ndl:
            sample_data['ndl_minutes'] = self._parse_time_to_minutes(ndl)
        
        # Parse in_deco status
        in_deco = sample.get('in_deco')
        if in_deco is not None:
            sample_data['in_deco'] = in_deco == '1'
        
        # Parse CNS
        cns = sample.get('cns')
        if cns:
            sample_data['cns_percent'] = self._parse_cns(cns)
        
        return sample_data
    
    def _parse_event_element(self, event: ET.Element) -> Dict[str, Any]:
        """Parse a single event element."""
        return {
            'time': event.get('time'),
            'time_minutes': self._parse_time_to_minutes(event.get('time', '0:00 min')),
            'type': event.get('type'),
            'flags': event.get('flags'),
            'name': event.get('name'),
            'cylinder': event.get('cylinder'),
            'o2': event.get('o2')
        }