#!/usr/bin/env python3
"""
Subsurface Dive Parser

This module provides parsing functionality for Subsurface dive files.
It handles the conversion of Subsurface dive data format to Divemap format.

Usage:
    from subsurface_dive_parser import SubsurfaceDiveParser

    parser = SubsurfaceDiveParser()
    dive_data = parser.parse_dive_file("path/to/dive/file")
"""

import re
import requests
from typing import Dict, Optional, List, Tuple
from pathlib import Path
from datetime import datetime, date, time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SubsurfaceDiveParser:
    """
    Parser for Subsurface dive files.

    Handles conversion from Subsurface format to Divemap format,
    including field mapping and data validation.
    """

    def __init__(self, backend_url: str = "http://localhost:8000", auth_token: str = None):
        self.backend_url = backend_url
        self.auth_token = auth_token
        self.session = requests.Session()
        if auth_token:
            self.session.headers.update({"Authorization": f"Bearer {auth_token}"})

        # Suit type mapping
        self.suit_mapping = {
            "wet": "wet_suit",
            "dry": "dry_suit",
            "shortie": "shortie",
            "aqualung": "wet_suit",
            "drysuit": "dry_suit",
            "shorty": "shortie",
            "wetsuit": "wet_suit",
            "wet suit": "wet_suit",
            "rofos": "dry_suit"
        }

    def parse_duration(self, duration_str: str) -> Optional[int]:
        """
        Convert Subsurface duration format to minutes.

        Args:
            duration_str: Duration string like "42:30 min" or "45 min"

        Returns:
            Duration in minutes, or None if parsing fails
        """
        try:
            # Remove "min" and trim
            duration_str = duration_str.replace("min", "").strip()

            if ":" in duration_str:
                # Format: "42:30" (minutes:seconds)
                parts = duration_str.split(":")
                if len(parts) == 2:
                    minutes = int(parts[0])
                    seconds = int(parts[1])
                    # Convert to total minutes (rounding up for partial minutes)
                    total_minutes = minutes + (seconds / 60)
                    return int(total_minutes)
                else:
                    logger.warning(f"Invalid duration format: {duration_str}")
                    return None
            else:
                # Format: "45" (just minutes)
                return int(duration_str)

        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing duration '{duration_str}': {e}")
            return None

    def parse_rating(self, rating: int) -> int:
        """
        Convert Subsurface rating (1-5) to Divemap rating (1-10).

        Args:
            rating: Rating on 1-5 scale

        Returns:
            Rating on 1-10 scale
        """
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            logger.warning(f"Invalid rating value: {rating}, defaulting to 5")
            rating = 5

        return rating * 2

    def parse_cylinder(self, cylinder_str: str) -> Dict[str, any]:
        """
        Parse cylinder information from Subsurface format.

        Args:
            cylinder_str: Cylinder string like "vol=14.0l workpressure=220.0bar description=\"D7 220 bar\" start=200.0bar end=60.0bar depth=66.019m o2=31.0%"

        Returns:
            Dictionary with parsed cylinder information
        """
        result = {}

        try:
            # Extract volume
            vol_match = re.search(r'vol=([\d.]+)l', cylinder_str)
            if vol_match:
                result['volume'] = float(vol_match.group(1))

            # Extract working pressure
            wp_match = re.search(r'workpressure=([\d.]+)bar', cylinder_str)
            if wp_match:
                result['work_pressure'] = float(wp_match.group(1))

            # Extract start pressure
            start_match = re.search(r'start=([\d.]+)bar', cylinder_str)
            if start_match:
                result['start_pressure'] = float(start_match.group(1))

            # Extract end pressure
            end_match = re.search(r'end=([\d.]+)bar', cylinder_str)
            if end_match:
                result['end_pressure'] = float(end_match.group(1))

            # Extract description
            desc_match = re.search(r'description="([^"]+)"', cylinder_str)
            if desc_match:
                result['description'] = desc_match.group(1)

            # Extract depth (removed - this is cylinder max depth, not dive depth)
            # depth_match = re.search(r'depth=([\d.]+)m', cylinder_str)
            # if depth_match:
            #     result['depth'] = float(depth_match.group(1))

            # Extract oxygen percentage (EANx)
            o2_match = re.search(r'o2=([\d.]+)%', cylinder_str)
            if o2_match:
                result['oxygen_percentage'] = float(o2_match.group(1))

        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing cylinder string '{cylinder_str}': {e}")

        return result

    def parse_weights(self, weights_str: str) -> Dict[str, any]:
        """
        Parse weights information from Subsurface format.

        Args:
            weights_str: Weights string like "weight=4.2kg description=\"weight\""

        Returns:
            Dictionary with parsed weights information
        """
        result = {}

        try:
            # Extract weight
            weight_match = re.search(r'weight=([\d.]+)kg', weights_str)
            if weight_match:
                result['weight'] = float(weight_match.group(1))

            # Extract description
            desc_match = re.search(r'description="([^"]+)"', weights_str)
            if desc_match:
                result['description'] = desc_match.group(1)

        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing weights string '{weights_str}': {e}")

        return result

    def parse_suit_type(self, suit_str: str) -> str:
        """
        Map Subsurface suit type to Divemap enum.

        Args:
            suit_str: Suit string like "Wet Aqualung" or "Dry Suit"

        Returns:
            Divemap suit type enum value
        """
        if not suit_str:
            return "wet_suit"  # Default

        suit_lower = suit_str.lower()

        # Check for exact matches first
        for key, value in self.suit_mapping.items():
            if key in suit_lower:
                return value

        # Check for partial matches
        if "wet" in suit_lower:
            return "wet_suit"
        elif "dry" in suit_lower:
            return "dry_suit"
        elif "short" in suit_lower:
            return "shortie"

        logger.warning(f"Unknown suit type: {suit_str}, defaulting to wet_suit")
        return "wet_suit"

    def parse_tags(self, tags_str: str) -> List[str]:
        """
        Parse comma-separated tags from Subsurface format.

        Args:
            tags_str: Tags string like "\"Canyon\", \"wall\""

        Returns:
            List of tag names
        """
        if not tags_str:
            return []

        try:
            # Remove quotes and split by comma
            tags = re.findall(r'"([^"]+)"', tags_str)
            return [tag.strip() for tag in tags if tag.strip()]

        except Exception as e:
            logger.error(f"Error parsing tags '{tags_str}': {e}")
            return []

    def parse_dive_file(self, dive_file: Path) -> Optional[Dict]:
        """
        Parse a single Subsurface dive file.

        Args:
            dive_file: Path to the dive file

        Returns:
            Dictionary with parsed dive data, or None if parsing fails
        """
        try:
            with open(dive_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            lines = content.split('\n')
            dive_data = {}

            for line in lines:
                line = line.strip()
                if not line or line.startswith('---'):
                    continue

                # Split on first space to get key-value
                parts = line.split(' ', 1)
                if len(parts) < 2:
                    continue

                key = parts[0].lower()
                value = parts[1].strip()

                # Parse based on field type
                if key == 'duration':
                    dive_data['duration'] = self.parse_duration(value)
                elif key == 'rating':
                    dive_data['user_rating'] = self.parse_rating(int(value))
                elif key == 'visibility':
                    dive_data['visibility_rating'] = self.parse_rating(int(value))
                elif key == 'tags':
                    dive_data['tags'] = self.parse_tags(value)
                elif key == 'divesiteid':
                    dive_data['import_site_id'] = value
                elif key == 'buddy':
                    # Remove quotes
                    buddy = value.strip('"')
                    dive_data['buddy'] = buddy
                elif key == 'suit':
                    dive_data['suit_type'] = self.parse_suit_type(value)
                elif key == 'cylinder':
                    cylinder_info = self.parse_cylinder(value)
                    dive_data.update(cylinder_info)
                elif key == 'weightsystem':
                    weights_info = self.parse_weights(value)
                    # Use different key names to avoid conflicts
                    for key, val in weights_info.items():
                        dive_data[f'weight_{key}'] = val

            return dive_data

        except Exception as e:
            logger.error(f"Error parsing dive file {dive_file}: {e}")
            return None

    def convert_to_divemap_format(self, subsurface_data: Dict, dive_date: date, dive_time: time = None) -> Dict:
        """
        Convert parsed Subsurface data to Divemap format.

        Args:
            subsurface_data: Parsed Subsurface dive data
            dive_date: Date of the dive
            dive_time: Time of the dive (optional)

        Returns:
            Dictionary in Divemap format
        """
        divemap_data = {
            'dive_date': dive_date.isoformat(),
            'duration': subsurface_data.get('duration'),
            'user_rating': subsurface_data.get('user_rating'),
            'visibility_rating': subsurface_data.get('visibility_rating'),
            'suit_type': subsurface_data.get('suit_type'),
            'buddy': subsurface_data.get('buddy'),
            'imported_from': 'subsurface',
            'import_site_id': subsurface_data.get('import_site_id')
        }

        # Add dive time if available
        if dive_time:
            divemap_data['dive_time'] = dive_time.isoformat()

        # Build dive information from various fields
        dive_info_parts = []

        if subsurface_data.get('buddy'):
            dive_info_parts.append(f"Dive Buddy: {subsurface_data['buddy']}")

        if subsurface_data.get('weight_weight'):
            weight_desc = subsurface_data.get('weight_description', '')
            dive_info_parts.append(f"Weights Used: {subsurface_data['weight_weight']}kg {weight_desc}".strip())

        if dive_info_parts:
            divemap_data['dive_information'] = '\n'.join(dive_info_parts)

        # Build gas bottles information
        gas_info_parts = []

        if subsurface_data.get('volume'):
            gas_info_parts.append(f"Volume: {subsurface_data['volume']}L")

        if subsurface_data.get('work_pressure'):
            gas_info_parts.append(f"Working Pressure: {subsurface_data['work_pressure']} bar")

        if subsurface_data.get('start_pressure'):
            gas_info_parts.append(f"Start Pressure: {subsurface_data['start_pressure']} bar")

        if subsurface_data.get('end_pressure'):
            gas_info_parts.append(f"End Pressure: {subsurface_data['end_pressure']} bar")

        if subsurface_data.get('oxygen_percentage'):
            gas_info_parts.append(f"Oxygen: {subsurface_data['oxygen_percentage']}% (EANx)")

        if subsurface_data.get('description'):
            gas_info_parts.append(f"Description: {subsurface_data['description']}")

        if gas_info_parts:
            divemap_data['gas_bottles_used'] = '\n'.join(gas_info_parts)

        # Add max depth if available (removed - will be handled by Divecomputer files)
        # if subsurface_data.get('depth'):
        #     divemap_data['max_depth'] = subsurface_data['depth']

        # Add cylinder-specific fields
        if subsurface_data.get('volume'):
            divemap_data['cylinder_volume'] = subsurface_data['volume']

        if subsurface_data.get('work_pressure'):
            divemap_data['cylinder_work_pressure'] = subsurface_data['work_pressure']

        if subsurface_data.get('start_pressure'):
            divemap_data['cylinder_start_pressure'] = subsurface_data['start_pressure']

        if subsurface_data.get('end_pressure'):
            divemap_data['cylinder_end_pressure'] = subsurface_data['end_pressure']

        if subsurface_data.get('description'):
            divemap_data['cylinder_description'] = subsurface_data['description']

        if subsurface_data.get('weight_weight'):
            divemap_data['weights_used'] = subsurface_data['weight_weight']

        if subsurface_data.get('weight_description'):
            divemap_data['weights_description'] = subsurface_data['weight_description']

        return divemap_data

    def find_dive_site_by_import_id(self, import_id: str) -> Optional[int]:
        """
        Find dive site by import ID.

        Args:
            import_id: Import dive site ID

        Returns:
            Divemap dive site ID, or None if not found
        """
        try:
            # This would need to be implemented based on your dive site mapping system
            # For now, return None to indicate no mapping found
            response = self.session.get(f"{self.backend_url}/api/v1/dive-sites",
                                     params={"import_id": import_id})

            if response.status_code == 200:
                sites = response.json()
                if sites:
                    return sites[0]['id']

            return None

        except Exception as e:
            logger.error(f"Error finding dive site for import ID {import_id}: {e}")
            return None

    def validate_dive_data(self, dive_data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate parsed dive data.

        Args:
            dive_data: Parsed dive data

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        # Check required fields
        if not dive_data.get('duration'):
            errors.append("Missing or invalid duration")

        if not dive_data.get('dive_date'):
            errors.append("Missing dive date")

        # Check rating ranges
        if dive_data.get('user_rating') and (dive_data['user_rating'] < 1 or dive_data['user_rating'] > 10):
            errors.append("User rating must be between 1 and 10")

        if dive_data.get('visibility_rating') and (dive_data['visibility_rating'] < 1 or dive_data['visibility_rating'] > 10):
            errors.append("Visibility rating must be between 1 and 10")

        # Check depth ranges
        if dive_data.get('max_depth') and (dive_data['max_depth'] < 0 or dive_data['max_depth'] > 1000):
            errors.append("Max depth must be between 0 and 1000 meters")

        return len(errors) == 0, errors

# Example usage
if __name__ == "__main__":
    parser = SubsurfaceDiveParser()

    # Example dive file content with EANx
    example_content = """
duration 53:00 min
rating 3
visibility 3
tags "Scubalife", "Wreck"
divesiteid 31db931b
buddy "Dimitris Lawyer"
suit "DrySuit Rofos"
cylinder vol=15.0l workpressure=232.0bar description="15ℓ 232 bar" o2=31.0% start=210.0bar end=80.0bar depth=41.454m
weightsystem weight=6.2kg description="weight"
---
"""

    # Create temporary file for testing
    test_file = Path("test_dive.txt")
    with open(test_file, 'w') as f:
        f.write(example_content)

    try:
        # Parse the dive file
        dive_data = parser.parse_dive_file(test_file)

        if dive_data:
            print("Parsed dive data:")
            for key, value in dive_data.items():
                print(f"  {key}: {value}")

            # Convert to Divemap format
            divemap_data = parser.convert_to_divemap_format(
                dive_data,
                date(2024, 1, 15),
                time(10, 30, 0)
            )

            print("\nDivemap format:")
            for key, value in divemap_data.items():
                print(f"  {key}: {value}")

            # Validate the data
            is_valid, errors = parser.validate_dive_data(divemap_data)
            if is_valid:
                print("\n✅ Dive data is valid")
            else:
                print(f"\n❌ Validation errors: {errors}")

    finally:
        # Clean up test file
        if test_file.exists():
            test_file.unlink()
