#!/usr/bin/env python3
"""
Enhanced Subsurface Dive Import Script

This script reads dive files from Subsurface repository structure and imports them
via the backend API. It performs similarity checks and conflict resolution before
creating new dives.

Features:
- Smart dive site matching using import IDs
- Conflict resolution for existing dives
- Interactive merge functionality for conflicting dives
- Force mode for batch processing
- Dry run mode for testing
- Skip existing dives option
- Merge file generation for complex updates
- Automatic date/time parsing from directory structure

Usage:
    python import_subsurface_dives.py [-f] [--dry-run] [--skip-existing] [--update-existing] [--create-merge-all] [--import-merge FILE]

Options:
    -f, --force: Skip confirmation prompts
    --dry-run: Show what would be imported without actually importing
    --skip-existing: Skip all dives that already exist
    --update-existing: Update all existing dives with conflicts
    --create-merge-all: Create merge files for all dives that can be updated
    --import-merge FILE: Import merge file to apply final changes
    --user-id ID: Specify user ID for imported dives (default: admin user)
    --repo-path PATH: Path to Subsurface repository (default: utils/Subsurface)
    --max-dives N: Maximum number of dives to process (useful for testing)
"""

import os
import sys
import json
import argparse
import requests
import math
import time
import re
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime, date, time
from difflib import SequenceMatcher

# Import the parser
from subsurface_dive_parser import SubsurfaceDiveParser

# Configuration
BACKEND_URL = "http://localhost:8000"
AUTH_ENDPOINT = f"{BACKEND_URL}/api/v1/auth/login"
DIVES_ENDPOINT = f"{BACKEND_URL}/api/v1/dives"
DIVE_SITES_ENDPOINT = f"{BACKEND_URL}/api/v1/dive-sites"

# Similarity threshold for dive matching (0.0 to 1.0)
SIMILARITY_THRESHOLD = 0.8

def read_credentials_from_local_testme() -> Tuple[str, str]:
    """Read admin credentials from local_testme file"""
    local_testme_path = Path("../local_testme")
    if not local_testme_path.exists():
        # Try relative to current directory
        local_testme_path = Path("local_testme")
        if not local_testme_path.exists():
            raise FileNotFoundError("local_testme file not found")

    try:
        with open(local_testme_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse the file to find admin credentials
        lines = content.split('\n')
        admin_username = None
        admin_password = None

        for line in lines:
            line = line.strip()
            if line.startswith('Admin user:'):
                # Look for the next line with credentials
                continue
            elif line and '/' in line and not line.startswith('Normal user:') and not line.startswith('OpenAI'):
                # This should be a credential line like "user/password"
                parts = line.split('/')
                if len(parts) == 2:
                    admin_username = parts[0].strip()
                    admin_password = parts[1].strip()
                    break

        if not admin_username or not admin_password:
            raise ValueError("Could not find admin credentials in local_testme file")

        return admin_username, admin_password

    except Exception as e:
        raise Exception(f"Error reading credentials from local_testme: {e}")

class SubsurfaceDiveImporter:
    def __init__(self, force: bool = False, dry_run: bool = False,
                 skip_existing: bool = False, update_existing: bool = False,
                 create_merge_all: bool = False, user_id: int = None, max_dives: int = None):
        self.force = force
        self.dry_run = dry_run
        self.skip_existing = skip_existing
        self.update_existing = update_existing
        self.create_merge_all = create_merge_all
        self.user_id = user_id
        self.max_dives = max_dives
        self.session = requests.Session()
        self.token = None
        self.parser = None
        self.stats = {
            'processed': 0,
            'skipped_existing': 0,
            'skipped_no_site': 0,
            'skipped_invalid': 0,
            'created': 0,
            'updated': 0,
            'errors': 0,
            'merge_files_created': 0,
            'stopped_by_limit': 0
        }

    def login(self) -> bool:
        """Login to get authentication token"""
        try:
            # Read credentials from local_testme file
            admin_username, admin_password = read_credentials_from_local_testme()

            print(f"Attempting login with username: {admin_username}")
            response = self.session.post(AUTH_ENDPOINT, json={
                "username": admin_username,
                "password": admin_password
            })
            print(f"Login response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            self.token = data["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"✅ Successfully logged in as {admin_username}")

            # Initialize parser with auth token
            self.parser = SubsurfaceDiveParser(BACKEND_URL, self.token)

            return True
        except Exception as e:
            print(f"❌ Failed to login: {e}")
            return False

    def parse_directory_date(self, dir_path: Path) -> Optional[Tuple[date, time]]:
        """
        Parse date and time from directory structure.

        Args:
            dir_path: Path like "06-Sat-11=33=00" or "12-02-Mon-11=08=31"

        Returns:
            Tuple of (date, time) or None if parsing fails
        """
        try:
            dir_name = dir_path.name

            # Extract year from the directory path (e.g., utils/Subsurface/2018/10/06-Sat-11=33=00)
            path_parts = dir_path.parts
            year = None
            for part in path_parts:
                if part.isdigit() and len(part) == 4:  # 4-digit year
                    year = int(part)
                    break

            if not year:
                year = 2024  # Default year if not found

            # Try format: "12-02-Mon-11=08=31" (MM-DD-Day-HH=mm=SS)
            date_match = re.search(r'(\d{2})-(\d{2})-', dir_name)
            if date_match:
                month = int(date_match.group(1))
                day = int(date_match.group(2))
            else:
                # Try format: "06-Sat-11=33=00" (DD-Day-HH=mm=SS)
                # Extract month from path (e.g., utils/Subsurface/2018/10/06-Sat-11=33=00)
                month = None
                for part in path_parts:
                    if part.isdigit() and len(part) == 2:  # 2-digit month
                        month = int(part)
                        break

                if not month:
                    return None

                # Extract day from directory name
                day_match = re.search(r'(\d{2})-', dir_name)
                if not day_match:
                    return None

                day = int(day_match.group(1))

            # Extract time components: "11=08=31" or "11=33=00" -> hour=11, minute=08, second=31
            time_match = re.search(r'(\d{2})=(\d{2})=(\d{2})', dir_name)
            if not time_match:
                return None

            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            second = int(time_match.group(3))

            dive_date = date(year, month, day)
            dive_time = time(hour, minute, second)

            return dive_date, dive_time

        except (ValueError, AttributeError) as e:
            print(f"❌ Error parsing date from directory {dir_path}: {e}")
            return None

    def find_dive_site_by_import_id(self, import_site_id: str) -> Optional[Dict]:
        """Find dive site by import ID"""
        try:
            # Find by name from the Subsurface site file
            site_file_path = Path(f"utils/Subsurface/01-Divesites/Site-{import_site_id}")
            if site_file_path.exists():
                site_name = self.parse_site_name_from_file(site_file_path)
                if site_name:
                    # Search for dive site by name
                    response = self.session.get(DIVE_SITES_ENDPOINT, params={
                        "name": site_name,
                        "limit": 10
                    })

                    if response.status_code == 200:
                        sites = response.json()
                        if sites:
                            return sites[0]
                        else:
                            print(f"      ❌ No dive sites found with name: '{site_name}'")
                            print(f"      💡 This dive site needs to be imported first")

                            # Parse dive site data from file
                            site_data = self.parse_dive_site_from_file(site_file_path)
                            if site_data:
                                print(f"      📄 Dive site data from Subsurface:")
                                print(f"         Name: {site_data['name']}")
                                if site_data.get('description'):
                                    print(f"         Description: {site_data['description']}")
                                print(f"         Coordinates: {site_data['latitude']}, {site_data['longitude']}")

                                # Search for nearby dive sites
                                nearby_sites = self.search_nearby_dive_sites(
                                    site_data['latitude'],
                                    site_data['longitude'],
                                    max_distance_km=0.5  # 500 meters
                                )

                                if nearby_sites:
                                    print(f"      🗺️  Found {len(nearby_sites)} nearby dive sites (within 500m):")
                                    for i, site in enumerate(nearby_sites[:5], 1):
                                        distance_km = self.calculate_distance(
                                            site_data['latitude'], site_data['longitude'],
                                            site['latitude'], site['longitude']
                                        )
                                        print(f"         {i}. {site['name']} (ID: {site['id']}) - {distance_km:.3f}km away")

                                    if not self.dry_run:
                                        try:
                                            choice = input(f"      🤔 Use nearby site (1-{min(len(nearby_sites), 5)}) or import new site (i) or skip dive (s): ").lower().strip()
                                        except EOFError:
                                            print(f"      ⏭️  No input available, skipping dive site import")
                                            return None

                                        if choice == 's':
                                            print(f"      ⏭️  Skipping this dive due to missing dive site")
                                            return None
                                        elif choice == 'i':
                                            # Import new dive site
                                            return self.import_new_dive_site(site_data, import_site_id)
                                        elif choice.isdigit():
                                            site_index = int(choice) - 1
                                            if 0 <= site_index < len(nearby_sites):
                                                selected_site = nearby_sites[site_index]
                                                print(f"      ✅ Using nearby dive site: {selected_site['name']} (ID: {selected_site['id']})")
                                                return selected_site
                                            else:
                                                print(f"      ❌ Invalid selection, skipping dive site")
                                                return None
                                        else:
                                            print(f"      ⏭️  Skipping dive site import")
                                            return None
                                    else:
                                        print(f"      🔍 DRY RUN - Would ask user to choose nearby site or import new")
                                        return None
                                else:
                                    # No nearby sites found, offer to import new site
                                    return self.import_new_dive_site(site_data, import_site_id)
                            else:
                                print(f"      ❌ Could not parse dive site data from file")
                    else:
                        print(f"      ❌ Error searching for dive site: {response.status_code}")
                else:
                    print(f"      ❌ Could not parse site name from file: {site_file_path}")
            else:
                print(f"      ❌ Site file not found: {site_file_path}")

            return None

        except Exception as e:
            print(f"❌ Error finding dive site for import ID {import_site_id}: {e}")
            return None

    def parse_site_name_from_file(self, site_file_path: Path) -> Optional[str]:
        """Parse dive site name from Subsurface site file"""
        try:
            with open(site_file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('name '):
                    # Extract name from "name "Site Name""
                    name_match = re.search(r'name "([^"]+)"', line)
                    if name_match:
                        return name_match.group(1)

            return None

        except Exception as e:
            print(f"❌ Error parsing site name from {site_file_path}: {e}")
            return None

    def parse_dive_site_from_file(self, site_file_path: Path) -> Optional[Dict]:
        """Parse dive site data from Subsurface site file"""
        try:
            with open(site_file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            lines = content.split('\n')
            site_data = {}
            gps_found = False

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                parts = line.split(' ', 1)
                if len(parts) < 2:
                    continue

                key = parts[0].lower()
                value = parts[1].strip('"')

                if key == 'name':
                    site_data['name'] = value
                elif key == 'description':
                    site_data['description'] = value
                elif key == 'notes':
                    # Merge notes into description if description is empty
                    if value and (not site_data.get('description') or site_data['description'] == ''):
                        site_data['description'] = value
                    elif value and site_data.get('description'):
                        site_data['description'] = f"{site_data['description']} {value}"
                elif key == 'gps':
                    gps_found = True
                    coords = value.split()
                    if len(coords) == 2:
                        try:
                            site_data['latitude'] = float(coords[0])
                            site_data['longitude'] = float(coords[1])
                        except ValueError:
                            print(f"❌ Invalid GPS coordinates in {site_file_path}: {value}")
                            return None
                    else:
                        print(f"❌ Invalid GPS format in {site_file_path}: {value} (expected 2 coordinates)")
                        return None

            # Validate required fields
            if not site_data.get('name'):
                print(f"❌ Missing name field in {site_file_path}")
                return None

            if not gps_found:
                print(f"⚠️  No GPS coordinates found in {site_file_path} - cannot import")
                return None

            return site_data

        except Exception as e:
            print(f"❌ Error parsing dive site data from {site_file_path}: {e}")
            return None

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in kilometers using Haversine formula"""
        import math

        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)

        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))

        # Earth's radius in kilometers
        radius = 6371

        return radius * c

    def search_nearby_dive_sites(self, latitude: float, longitude: float, max_distance_km: float = 0.5) -> List[Dict]:
        """Search for dive sites within specified distance"""
        try:
            # Get all dive sites from the backend
            response = self.session.get(DIVE_SITES_ENDPOINT, params={"limit": 1000})
            if response.status_code != 200:
                print(f"      ❌ Error fetching dive sites: {response.status_code}")
                return []

            all_sites = response.json()
            nearby_sites = []

            for site in all_sites:
                if site.get('latitude') and site.get('longitude'):
                    distance = self.calculate_distance(
                        latitude, longitude,
                        site['latitude'], site['longitude']
                    )
                    if distance <= max_distance_km:
                        site['distance'] = distance
                        nearby_sites.append(site)

            # Sort by distance
            nearby_sites.sort(key=lambda x: x['distance'])
            return nearby_sites

        except Exception as e:
            print(f"      ❌ Error searching nearby dive sites: {e}")
            return []

    def import_new_dive_site(self, site_data: Dict, import_site_id: str) -> Optional[Dict]:
        """Import a new dive site"""
        # Prepare payload for backend
        payload = {
            "name": site_data['name'],
            "description": site_data.get('description', ''),
            "latitude": site_data['latitude'],
            "longitude": site_data['longitude']
            # Note: import_site_id not supported by backend yet
        }

        print(f"      📤 Would send to backend:")
        import json
        print(f"         {json.dumps(payload, indent=8)}")

        if not self.dry_run:
            try:
                choice = input(f"      🤔 Import this dive site? (y/n/s to skip this dive): ").lower().strip()
            except EOFError:
                print(f"      ⏭️  No input available, skipping dive site import")
                return None

            if choice == 'y':
                # Create dive site via API
                response = self.session.post(DIVE_SITES_ENDPOINT, json=payload)
                if response.status_code == 200:
                    created_site = response.json()
                    print(f"      ✅ Created dive site: {created_site['name']} (ID: {created_site['id']})")
                    return created_site
                else:
                    print(f"      ❌ Error creating dive site: {response.status_code}")
                    return None
            elif choice == 's':
                print(f"      ⏭️  Skipping this dive due to missing dive site")
                return None
            else:
                print(f"      ⏭️  Skipping dive site import")
                return None
        else:
            print(f"      🔍 DRY RUN - Would ask user to import dive site")
            return None

    def check_existing_dive(self, dive_data: Dict) -> Optional[Dict]:
        """
        Check if a dive already exists based on date, time, and user.

        Args:
            dive_data: Parsed dive data

        Returns:
            Existing dive data or None if not found
        """
        try:
            # Search for dives by date and user
            params = {
                "dive_date": dive_data['dive_date'],
                "user_id": self.user_id,
                "limit": 100
            }

            response = self.session.get(DIVES_ENDPOINT, params=params)
            if response.status_code == 200:
                dives = response.json()

                # Check for exact matches
                for dive in dives:
                    if (dive.get('dive_date') == dive_data['dive_date'] and
                        dive.get('dive_time') == dive_data.get('dive_time') and
                        dive.get('duration') == dive_data.get('duration')):
                        return dive

                # Check for similar dives (same date, similar duration)
                for dive in dives:
                    if (dive.get('dive_date') == dive_data['dive_date'] and
                        dive.get('duration') and dive_data.get('duration')):
                        duration_diff = abs(dive['duration'] - dive_data['duration'])
                        if duration_diff <= 5:  # Within 5 minutes
                            return dive

            return None

        except Exception as e:
            print(f"❌ Error checking for existing dive: {e}")
            return None

    def calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate string similarity using multiple algorithms"""
        str1_lower = str1.lower().strip()
        str2_lower = str2.lower().strip()

        if str1_lower == str2_lower:
            return 1.0

        # Method 1: Sequence matcher (good for typos and minor differences)
        sequence_similarity = SequenceMatcher(None, str1_lower, str2_lower).ratio()

        # Method 2: Word-based similarity
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'dive', 'site', 'reef', 'rock', 'point', 'bay', 'beach'}
        str1_words = set(re.findall(r'\b\w+\b', str1_lower)) - common_words
        str2_words = set(re.findall(r'\b\w+\b', str2_lower)) - common_words

        if not str1_words and not str2_words:
            word_similarity = 0.0
        else:
            intersection = str1_words.intersection(str2_words)
            union = str1_words.union(str2_words)
            word_similarity = len(intersection) / len(union) if union else 0.0

        # Method 3: Substring matching
        substring_similarity = 0.0
        if len(str1_lower) > 3 and len(str2_lower) > 3:
            if str1_lower in str2_lower or str2_lower in str1_lower:
                substring_similarity = 0.9

        # Return the highest similarity score
        return max(sequence_similarity, word_similarity, substring_similarity)

    def create_merge_file(self, existing_dive: Dict, new_dive: Dict, filename: str) -> str:
        """Create a merge file for complex updates"""
        merge_content = f"""# Merge file for dive update
# Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# File: {filename}

--existing--
{json.dumps(existing_dive, indent=2)}

--new--
{json.dumps(new_dive, indent=2)}

--final--
# Edit the section below with the final merged data
# Then run: python import_subsurface_dives.py --import-merge this_file.txt
{{
  "dive_date": "{new_dive['dive_date']}",
  "dive_time": "{new_dive.get('dive_time', existing_dive.get('dive_time', ''))}",
  "duration": {new_dive.get('duration', existing_dive.get('duration', 0))},
  "max_depth": {new_dive.get('max_depth', existing_dive.get('max_depth', 0))},
  "user_rating": {new_dive.get('user_rating', existing_dive.get('user_rating', 0))},
  "visibility_rating": {new_dive.get('visibility_rating', existing_dive.get('visibility_rating', 0))},
  "suit_type": "{new_dive.get('suit_type', existing_dive.get('suit_type', ''))}",
  "dive_information": "{new_dive.get('dive_information', existing_dive.get('dive_information', ''))}",
  "gas_bottles_used": "{new_dive.get('gas_bottles_used', existing_dive.get('gas_bottles_used', ''))}",
  "imported_from": "subsurface",
  "import_site_id": "{new_dive.get('import_site_id', existing_dive.get('import_site_id', ''))}"
}}
"""

        merge_filename = f"merge_dive_{existing_dive['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(merge_filename, 'w', encoding='utf-8') as f:
            f.write(merge_content)

        return merge_filename

    def import_merge_file(self, merge_file_path: str) -> bool:
        """Import a merge file to apply final changes"""
        try:
            with open(merge_file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract the final section
            final_match = re.search(r'--final--\n(.*?)(?:\n\n|$)', content, re.DOTALL)
            if not final_match:
                print(f"❌ No --final-- section found in {merge_file_path}")
                return False

            final_data_str = final_match.group(1).strip()

            # Remove any comment lines that start with #
            final_data_str = '\n'.join([line for line in final_data_str.split('\n') if not line.strip().startswith('#')])

            # Parse the JSON data
            try:
                final_data = json.loads(final_data_str)
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON in final section: {e}")
                return False

            # Extract dive ID from filename or content
            dive_id_match = re.search(r'merge_dive_(\d+)_', merge_file_path)
            if not dive_id_match:
                print(f"❌ Could not extract dive ID from filename: {merge_file_path}")
                return False

            dive_id = int(dive_id_match.group(1))

            # Update the dive
            return self.update_dive(dive_id, final_data)

        except Exception as e:
            print(f"❌ Error importing merge file: {e}")
            return False

    def create_dive(self, dive_data: Dict) -> bool:
        """Create a dive via API"""
        try:
            payload = {
                "dive_date": dive_data['dive_date'],
                "duration": dive_data.get('duration'),
                "user_rating": dive_data.get('user_rating'),
                "visibility_rating": dive_data.get('visibility_rating'),
                "suit_type": dive_data.get('suit_type'),
                "dive_information": dive_data.get('dive_information'),
                "gas_bottles_used": dive_data.get('gas_bottles_used'),
                "max_depth": dive_data.get('max_depth')
                # Note: imported_from and import_site_id not supported by backend yet
            }

            # Add optional fields
            if dive_data.get('dive_time'):
                payload['dive_time'] = dive_data['dive_time']

            if dive_data.get('dive_site_id'):
                payload['dive_site_id'] = dive_data['dive_site_id']

            if self.dry_run:
                print(f"📝 Would create dive: {json.dumps(payload, indent=2)}")
                return True

            response = self.session.post(DIVES_ENDPOINT, json=payload)
            response.raise_for_status()

            created_dive = response.json()
            print(f"✅ Created dive: {created_dive['id']} on {created_dive['dive_date']}")
            return True

        except Exception as e:
            print(f"❌ Error creating dive: {e}")
            return False

    def update_dive(self, dive_id: int, dive_data: Dict) -> bool:
        """Update an existing dive"""
        try:
            payload = {
                "dive_date": dive_data['dive_date'],
                "duration": dive_data.get('duration'),
                "user_rating": dive_data.get('user_rating'),
                "visibility_rating": dive_data.get('visibility_rating'),
                "suit_type": dive_data.get('suit_type'),
                "dive_information": dive_data.get('dive_information'),
                "gas_bottles_used": dive_data.get('gas_bottles_used'),
                "max_depth": dive_data.get('max_depth'),
                "imported_from": "subsurface",
                "import_site_id": dive_data.get('import_site_id')
            }

            # Add optional fields
            if dive_data.get('dive_time'):
                payload['dive_time'] = dive_data['dive_time']

            if dive_data.get('dive_site_id'):
                payload['dive_site_id'] = dive_data['dive_site_id']

            if self.dry_run:
                print(f"📝 Would update dive {dive_id}: {json.dumps(payload, indent=2)}")
                return True

            response = self.session.put(f"{DIVES_ENDPOINT}/{dive_id}", json=payload)
            response.raise_for_status()

            updated_dive = response.json()
            print(f"✅ Updated dive: {updated_dive['id']} on {updated_dive['dive_date']}")
            return True

        except Exception as e:
            print(f"❌ Error updating dive: {e}")
            return False

    def scan_dive_directories(self, base_path: Path) -> List[Tuple[Path, date, time]]:
        """
        Scan for dive directories in various formats:
        - YYYY/MM/DD-Day-HH=mm=SS (direct date directories)
        - YYYY/MM/Trip/DD-Day-HH=mm=SS (trip directories)

        Returns:
            List of tuples (dive_dir_path, dive_date, dive_time)
        """
        dive_dirs = []

        # Scan for year directories
        for year_dir in base_path.iterdir():
            if not year_dir.is_dir() or not year_dir.name.isdigit():
                continue

            year = int(year_dir.name)

            # Scan for month directories
            for month_dir in year_dir.iterdir():
                if not month_dir.is_dir() or not month_dir.name.isdigit():
                    continue

                month = int(month_dir.name)

                # Scan for day directories or trip directories
                for day_or_trip_dir in month_dir.iterdir():
                    if not day_or_trip_dir.is_dir():
                        continue

                    # Check if this is a direct date directory (contains Dive-* files)
                    dive_files = list(day_or_trip_dir.glob("Dive-*"))
                    if dive_files:
                        # This is a direct date directory
                        date_time = self.parse_directory_date(day_or_trip_dir)
                        if date_time:
                            dive_date, dive_time = date_time
                            dive_dirs.append((day_or_trip_dir, dive_date, dive_time))
                        continue

                    # Check if this is a trip directory (contains date subdirectories)
                    for date_dir in day_or_trip_dir.iterdir():
                        if not date_dir.is_dir():
                            continue

                        # Check if this date directory contains dive files
                        dive_files = list(date_dir.glob("Dive-*"))
                        if dive_files:
                            # Parse date and time from directory name
                            date_time = self.parse_directory_date(date_dir)
                            if date_time:
                                dive_date, dive_time = date_time
                                dive_dirs.append((date_dir, dive_date, dive_time))

        return dive_dirs

    def process_dive_directory(self, dive_dir: Path, dive_date: date, dive_time: time) -> bool:
        """Process a single dive directory"""
        print(f"\n📁 Processing dive directory: {dive_dir}")
        print(f"   Date: {dive_date}, Time: {dive_time}")

        # Find dive files
        dive_files = list(dive_dir.glob("Dive-*"))
        if not dive_files:
            print(f"   ⚠️  No dive files found in {dive_dir}")
            return True

        success_count = 0
        for dive_file in dive_files:
            print(f"\n📄 Processing dive file: {dive_file.name}")

            # Parse the dive file
            subsurface_data = self.parser.parse_dive_file(dive_file)
            if not subsurface_data:
                print(f"   ❌ Failed to parse dive file {dive_file}")
                self.stats['errors'] += 1
                continue

            # Convert to Divemap format
            divemap_data = self.parser.convert_to_divemap_format(
                subsurface_data, dive_date, dive_time
            )

            # Validate the data
            is_valid, errors = self.parser.validate_dive_data(divemap_data)
            if not is_valid:
                print(f"   ❌ Validation errors: {errors}")
                self.stats['skipped_invalid'] += 1
                continue

            # Find dive site
            dive_site = None
            if subsurface_data.get('import_site_id'):
                dive_site = self.find_dive_site_by_import_id(subsurface_data['import_site_id'])
                if dive_site:
                    divemap_data['dive_site_id'] = dive_site['id']
                    print(f"   🏝️  Found dive site: {dive_site['name']} (ID: {dive_site['id']})")
                else:
                    print(f"   ❌ ERROR: No dive site found for import ID: {subsurface_data['import_site_id']}")
                    print(f"      Import this dive site with: python utils/import_subsurface_divesite.py --file Site-{subsurface_data['import_site_id']}")
                    self.stats['skipped_no_site'] += 1
                    continue

            # Check for existing dive
            existing_dive = self.check_existing_dive(divemap_data)
            if existing_dive:
                print(f"   ⚠️  Found existing dive: ID {existing_dive['id']} on {existing_dive['dive_date']}")

                if self.skip_existing:
                    print("   Skipping due to --skip-existing flag")
                    self.stats['skipped_existing'] += 1
                    continue

                if self.create_merge_all:
                    merge_file = self.create_merge_file(existing_dive, divemap_data, dive_file.name)
                    print(f"   📝 Created merge file: {merge_file}")
                    self.stats['merge_files_created'] += 1
                    continue

                if not self.force:
                    choice = input(f"   Skip existing dive, update it, or create new one? (s/u/c/m for merge file): ").lower().strip()
                    if choice == 's':
                        print("   Skipping...")
                        self.stats['skipped_existing'] += 1
                        continue
                    elif choice == 'm':
                        merge_file = self.create_merge_file(existing_dive, divemap_data, dive_file.name)
                        print(f"   📝 Created merge file: {merge_file}")
                        self.stats['merge_files_created'] += 1
                        continue
                    elif choice == 'u':
                        success = self.update_dive(existing_dive['id'], divemap_data)
                        if success:
                            self.stats['updated'] += 1
                            success_count += 1
                        continue
                    # If choice is 'c', continue to create new dive
                else:
                    print("   Force mode: creating new dive")

            # Confirm creation (unless force mode or dry run)
            if not self.force and not self.dry_run:
                print(f"\n📋 About to create dive:")
                print(f"   Date: {divemap_data['dive_date']}")
                print(f"   Time: {divemap_data.get('dive_time', 'N/A')}")
                print(f"   Duration: {divemap_data.get('duration', 'N/A')} minutes")
                if dive_site:
                    print(f"   Site: {dive_site['name']}")

                try:
                    confirm = input("   Proceed? (y/n): ").lower().strip()
                except EOFError:
                    print("   ⏭️  No input available, skipping dive")
                    return False
                if confirm != 'y':
                    print("   Skipping...")
                    continue

            # Create the dive
            success = self.create_dive(divemap_data)
            if success:
                self.stats['created'] += 1
                success_count += 1
            else:
                self.stats['errors'] += 1

            # Check if we've reached the maximum number of dives
            if self.max_dives and (self.stats['created'] + self.stats['updated']) >= self.max_dives:
                print(f"\n🛑 Reached maximum dive limit of {self.max_dives}")
                self.stats['stopped_by_limit'] = 1
                return True  # Stop processing this directory

        return success_count > 0

    def run(self, repo_path: str = "utils/Subsurface"):
        """Main execution method"""
        print("🚀 Enhanced Subsurface Dive Import Script")
        print("=" * 50)

        # Login
        if not self.login():
            return False

        # Set user ID if not provided
        if not self.user_id:
            # Get current user info
            try:
                response = self.session.get(f"{BACKEND_URL}/api/v1/users/me")
                if response.status_code == 200:
                    user_info = response.json()
                    self.user_id = user_info['id']
                    print(f"👤 Using user ID: {self.user_id} ({user_info['username']})")
                else:
                    print("❌ Could not get current user info")
                    return False
            except Exception as e:
                print(f"❌ Error getting user info: {e}")
                return False

        # Find dive directories
        base_path = Path(repo_path)
        if not base_path.exists():
            print(f"❌ Repository path not found: {base_path}")
            return False

        dive_dirs = self.scan_dive_directories(base_path)
        if not dive_dirs:
            print(f"❌ No dive directories found in {base_path}")
            return False

        print(f"📁 Found {len(dive_dirs)} dive directories")

        if self.dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")

        if self.force:
            print("⚡ FORCE MODE - Skipping confirmations")

        if self.skip_existing:
            print("⏭️  SKIP EXISTING MODE - Skipping all existing dives")

        if self.update_existing:
            print("🔄 UPDATE EXISTING MODE - Updating all existing dives")

        if self.create_merge_all:
            print("📝 CREATE MERGE ALL MODE - Creating merge files for all conflicts")

        if self.max_dives:
            print(f"🔢 MAX DIVES MODE - Will stop after processing {self.max_dives} dives")

        # Process each dive directory
        for dive_dir, dive_date, dive_time in sorted(dive_dirs):
            self.stats['processed'] += 1
            result = self.process_dive_directory(dive_dir, dive_date, dive_time)

            # Check if we should stop processing (limit reached)
            if self.stats['stopped_by_limit']:
                break

        # Print summary
        print("\n" + "=" * 50)
        print("📊 Import Summary:")
        print(f"   Processed: {self.stats['processed']}")
        print(f"   Created: {self.stats['created']}")
        print(f"   Updated: {self.stats['updated']}")
        print(f"   Skipped (existing): {self.stats['skipped_existing']}")
        print(f"   Skipped (no site): {self.stats['skipped_no_site']}")
        print(f"   Skipped (invalid): {self.stats['skipped_invalid']}")
        print(f"   Merge files created: {self.stats['merge_files_created']}")
        print(f"   Errors: {self.stats['errors']}")
        if self.stats['stopped_by_limit']:
            print(f"   Stopped by limit: {self.max_dives} dives")

        return self.stats['errors'] == 0

def main():
    parser = argparse.ArgumentParser(description="Import dives from Subsurface repository")
    parser.add_argument("-f", "--force", action="store_true",
                       help="Skip confirmation prompts")
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be imported without actually importing")
    parser.add_argument("--skip-existing", action="store_true",
                       help="Skip all dives that already exist")
    parser.add_argument("--update-existing", action="store_true",
                       help="Update all existing dives with conflicts")
    parser.add_argument("--create-merge-all", action="store_true",
                       help="Create merge files for all dives that can be updated")
    parser.add_argument("--import-merge", type=str,
                       help="Import merge file to apply final changes")
    parser.add_argument("--user-id", type=int,
                       help="User ID for imported dives (default: current user)")
    parser.add_argument("--repo-path", type=str, default="utils/Subsurface",
                       help="Path to Subsurface repository")
    parser.add_argument("--max-dives", type=int,
                       help="Maximum number of dives to process (useful for testing)")

    args = parser.parse_args()

    # Check if backend is running
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        if response.status_code != 200:
            print(f"❌ Backend is not responding properly (status: {response.status_code})")
            return 1
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend at {BACKEND_URL}")
        print("   Make sure the backend is running: docker-compose up backend")
        return 1

    # Handle merge file import
    if args.import_merge:
        importer = SubsurfaceDiveImporter()
        if not importer.login():
            return 1

        success = importer.import_merge_file(args.import_merge)
        return 0 if success else 1

    # Run the importer
    importer = SubsurfaceDiveImporter(
        force=args.force,
        dry_run=args.dry_run,
        skip_existing=args.skip_existing,
        update_existing=args.update_existing,
        create_merge_all=args.create_merge_all,
        user_id=args.user_id,
        max_dives=args.max_dives
    )
    success = importer.run(args.repo_path)

    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
