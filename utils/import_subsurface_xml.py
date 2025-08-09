#!/usr/bin/env python3
"""
Subsurface XML Import Script

This script reads Subsurface XML files and imports them via the backend API.
It performs similarity checks and conflict resolution before creating new dives.

Features:
- Parse Subsurface XML format directly
- Match dive sites with existing sites using import IDs
- Parse dive information including cylinders and weight systems
- Extract dive computer information (keeping only "Deco model" from extradata)
- Handle gas tanks and weight systems
- Interactive conflict resolution
- Force mode for batch processing
- Dry run mode for testing

Usage:
    python import_subsurface_xml.py <xml_file> [-f] [--dry-run] [--skip-existing] [--update-existing]

Options:
    xml_file: Path to the Subsurface XML file to import
    -f, --force: Skip confirmation prompts
    --dry-run: Show what would be imported without actually importing
    --skip-existing: Skip all dives that already exist
    --update-existing: Update all existing dives with conflicts
    --user-id ID: Specify user ID for imported dives (default: admin user)
"""

import os
import sys
import json
import argparse
import requests
import xml.etree.ElementTree as ET
import re
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from datetime import datetime, date, time
from difflib import SequenceMatcher

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

class SubsurfaceXMLImporter:
    def __init__(self, force: bool = False, dry_run: bool = False,
                 skip_existing: bool = False, update_existing: bool = False,
                 user_id: int = None):
        self.force = force
        self.dry_run = dry_run
        self.skip_existing = skip_existing
        self.update_existing = update_existing
        self.user_id = user_id
        self.auth_token = None
        self.session = requests.Session()
        
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

    def login(self) -> bool:
        """Login to the backend API"""
        try:
            username, password = read_credentials_from_local_testme()
            
            response = self.session.post(AUTH_ENDPOINT, json={
                "username": username,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                print(f"✅ Successfully logged in as {username}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False

    def parse_duration(self, duration_str: str) -> Optional[int]:
        """Convert Subsurface duration format to minutes"""
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
                    print(f"⚠️  Invalid duration format: {duration_str}")
                    return None
            else:
                # Format: "45" (just minutes)
                return int(duration_str)

        except (ValueError, AttributeError) as e:
            print(f"❌ Error parsing duration '{duration_str}': {e}")
            return None

    def parse_rating(self, rating: int) -> int:
        """Convert Subsurface rating (1-5) to Divemap rating (1-10)"""
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            print(f"⚠️  Invalid rating value: {rating}, defaulting to 5")
            rating = 5
        
        # Convert 1-5 scale to 1-10 scale
        return rating * 2

    def parse_suit_type(self, suit_str: str) -> Optional[str]:
        """Parse suit type from Subsurface format"""
        if not suit_str:
            return None
            
        suit_lower = suit_str.lower()
        
        # Check for exact matches first
        for key, value in self.suit_mapping.items():
            if key in suit_lower:
                return value
        
        # If no match found, return None
        print(f"⚠️  Unknown suit type: {suit_str}")
        return None

    def parse_cylinder(self, cylinder_elem: ET.Element) -> Dict[str, Any]:
        """Parse cylinder information from XML element"""
        cylinder_data = {}
        
        # Extract cylinder attributes
        cylinder_data['size'] = cylinder_elem.get('size')
        cylinder_data['workpressure'] = cylinder_elem.get('workpressure')
        cylinder_data['description'] = cylinder_elem.get('description')
        cylinder_data['o2'] = cylinder_elem.get('o2')
        cylinder_data['start'] = cylinder_elem.get('start')
        cylinder_data['end'] = cylinder_elem.get('end')
        cylinder_data['depth'] = cylinder_elem.get('depth')
        
        return cylinder_data

    def parse_weightsystem(self, weights_elem: ET.Element) -> Dict[str, Any]:
        """Parse weight system information from XML element"""
        weights_data = {}
        
        # Extract weight system attributes
        weights_data['weight'] = weights_elem.get('weight')
        weights_data['description'] = weights_elem.get('description')
        
        return weights_data

    def parse_divecomputer(self, computer_elem: ET.Element) -> Dict[str, Any]:
        """Parse dive computer information from XML element"""
        computer_data = {}
        
        # Extract basic computer info
        computer_data['model'] = computer_elem.get('model')
        computer_data['deviceid'] = computer_elem.get('deviceid')
        computer_data['diveid'] = computer_elem.get('diveid')
        
        # Parse depth information
        depth_elem = computer_elem.find('depth')
        if depth_elem is not None:
            computer_data['max_depth'] = depth_elem.get('max')
            computer_data['mean_depth'] = depth_elem.get('mean')
        
        # Parse temperature information
        temp_elem = computer_elem.find('temperature')
        if temp_elem is not None:
            computer_data['water_temp'] = temp_elem.get('water')
        
        # Parse surface pressure
        surface_pressure_elem = computer_elem.find('surface pressure')
        if surface_pressure_elem is not None:
            computer_data['surface_pressure'] = surface_pressure_elem.get('surface pressure')
        
        # Parse water salinity
        salinity_elem = computer_elem.find('water salinity')
        if salinity_elem is not None:
            computer_data['water_salinity'] = salinity_elem.get('water salinity')
        
        # Parse extradata - only keep "Deco model"
        extradata_list = []
        for extradata_elem in computer_elem.findall('extradata'):
            key = extradata_elem.get('key')
            value = extradata_elem.get('value')
            if key == 'Deco model':
                extradata_list.append({'key': key, 'value': value})
        
        computer_data['extradata'] = extradata_list
        
        return computer_data

    def find_dive_site_by_import_id(self, import_site_id: str) -> Optional[Dict]:
        """Find dive site by import ID"""
        try:
            # First, try to get all dive sites to search through aliases
            response = self.session.get(f"{DIVE_SITES_ENDPOINT}/", params={
                "page_size": 100
            })
            
            if response.status_code == 200:
                sites = response.json()
                print(f"🔍 Found {len(sites)} dive sites total")
                
                # Check if any site has this import ID as an alias
                for site in sites:
                    if 'aliases' in site:
                        for alias in site['aliases']:
                            if alias['alias'] == import_site_id:
                                print(f"✅ Found dive site by alias: {site['name']} (ID: {site['id']})")
                                return site
                
                # If no exact alias match, check site names
                for site in sites:
                    if site['name'] == import_site_id:
                        print(f"✅ Found dive site by name: {site['name']} (ID: {site['id']})")
                        return site
                
                print(f"❌ No dive site found with import ID: {import_site_id}")
                return None
            else:
                print(f"❌ Error searching dive sites: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error finding dive site: {e}")
            return None

    def check_existing_dive(self, dive_data: Dict) -> Optional[Dict]:
        """Check if a dive already exists"""
        try:
            # Search for dives with same date, time, and user
            params = {
                "start_date": dive_data['dive_date'],
                "end_date": dive_data['dive_date'],
                "page_size": 50
            }
            
            if self.user_id:
                # Note: This would require backend support for user filtering
                # For now, we'll search all dives on that date
                pass
            
            response = self.session.get(f"{DIVES_ENDPOINT}/", params=params)
            
            if response.status_code == 200:
                dives = response.json()
                
                for dive in dives:
                    # Check if this is the same dive
                    if (dive['dive_date'] == dive_data['dive_date'] and
                        dive.get('dive_time') == dive_data.get('dive_time') and
                        dive.get('duration') == dive_data.get('duration')):
                        
                        # Calculate similarity score
                        similarity = self.calculate_similarity(
                            str(dive.get('dive_information', '')),
                            str(dive_data.get('dive_information', ''))
                        )
                        
                        if similarity > SIMILARITY_THRESHOLD:
                            return dive
                
                return None
            else:
                print(f"❌ Error searching dives: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error checking existing dive: {e}")
            return None

    def calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity between two strings"""
        if not str1 and not str2:
            return 1.0
        if not str1 or not str2:
            return 0.0
        
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

    def create_dive(self, dive_data: Dict) -> bool:
        """Create a new dive via API"""
        try:
            response = self.session.post(DIVES_ENDPOINT, json=dive_data)
            
            if response.status_code in [200, 201]:
                created_dive = response.json()
                print(f"✅ Successfully created dive ID: {created_dive['id']}")
                return True
            else:
                print(f"❌ Failed to create dive: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating dive: {e}")
            return False

    def update_dive(self, dive_id: int, dive_data: Dict) -> bool:
        """Update an existing dive via API"""
        try:
            response = self.session.put(f"{DIVES_ENDPOINT}/{dive_id}", json=dive_data)
            
            if response.status_code == 200:
                updated_dive = response.json()
                print(f"✅ Successfully updated dive ID: {updated_dive['id']}")
                return True
            else:
                print(f"❌ Failed to update dive: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error updating dive: {e}")
            return False

    def parse_xml_file(self, xml_file_path: Path) -> List[Dict]:
        """Parse Subsurface XML file and extract dive data"""
        try:
            tree = ET.parse(xml_file_path)
            root = tree.getroot()
            
            # Extract dive sites
            dive_sites = {}
            for site_elem in root.findall('.//divesites/site'):
                site_id = site_elem.get('uuid')
                site_name = site_elem.get('name')
                gps = site_elem.get('gps')
                
                if site_id and site_name:
                    dive_sites[site_id] = {
                        'name': site_name,
                        'gps': gps
                    }
            
            # Extract dives
            dives = []
            for dive_elem in root.findall('.//dives/dive'):
                dive_data = self.parse_dive_element(dive_elem, dive_sites)
                if dive_data:
                    dives.append(dive_data)
            
            return dives
            
        except Exception as e:
            print(f"❌ Error parsing XML file: {e}")
            return []

    def parse_dive_element(self, dive_elem: ET.Element, dive_sites: Dict) -> Optional[Dict]:
        """Parse individual dive element from XML"""
        try:
            # Extract basic dive information
            dive_number = dive_elem.get('number')
            rating = dive_elem.get('rating')
            visibility = dive_elem.get('visibility')
            sac = dive_elem.get('sac')
            otu = dive_elem.get('otu')
            cns = dive_elem.get('cns')
            tags = dive_elem.get('tags')
            divesiteid = dive_elem.get('divesiteid')
            dive_date = dive_elem.get('date')
            dive_time = dive_elem.get('time')
            duration = dive_elem.get('duration')
            
            # Parse buddy information
            buddy_elem = dive_elem.find('buddy')
            buddy = buddy_elem.text if buddy_elem is not None else None
            
            # Parse suit information
            suit_elem = dive_elem.find('suit')
            suit = suit_elem.text if suit_elem is not None else None
            
            # Parse cylinders
            cylinders = []
            for cylinder_elem in dive_elem.findall('cylinder'):
                cylinder_data = self.parse_cylinder(cylinder_elem)
                cylinders.append(cylinder_data)
            
            # Parse weight systems
            weights = []
            for weights_elem in dive_elem.findall('weightsystem'):
                weights_data = self.parse_weightsystem(weights_elem)
                weights.append(weights_data)
            
            # Parse dive computer
            computer_data = None
            computer_elem = dive_elem.find('divecomputer')
            if computer_elem is not None:
                computer_data = self.parse_divecomputer(computer_elem)
            
            # Convert to Divemap format
            divemap_dive = self.convert_to_divemap_format(
                dive_number, rating, visibility, sac, otu, cns, tags,
                divesiteid, dive_date, dive_time, duration,
                buddy, suit, cylinders, weights, computer_data,
                dive_sites
            )
            
            return divemap_dive
            
        except Exception as e:
            print(f"❌ Error parsing dive element: {e}")
            return None

    def convert_to_divemap_format(self, dive_number, rating, visibility, sac, otu, cns, tags,
                                 divesiteid, dive_date, dive_time, duration,
                                 buddy, suit, cylinders, weights, computer_data,
                                 dive_sites) -> Dict:
        """Convert Subsurface dive data to Divemap format"""
        
        # Parse date and time
        parsed_date = None
        parsed_time = None
        
        if dive_date:
            try:
                parsed_date = datetime.strptime(dive_date, '%Y-%m-%d').date()
            except ValueError:
                print(f"⚠️  Invalid date format: {dive_date}")
        
        if dive_time:
            try:
                parsed_time = datetime.strptime(dive_time, '%H:%M:%S').time()
            except ValueError:
                print(f"⚠️  Invalid time format: {dive_time}")
        
        # Parse duration
        parsed_duration = None
        if duration:
            parsed_duration = self.parse_duration(duration)
        
        # Parse suit type
        parsed_suit_type = None
        if suit:
            parsed_suit_type = self.parse_suit_type(suit)
        
        # Parse ratings
        parsed_rating = None
        if rating:
            try:
                parsed_rating = self.parse_rating(int(rating))
            except ValueError:
                print(f"⚠️  Invalid rating: {rating}")
        
        parsed_visibility = None
        if visibility:
            try:
                parsed_visibility = self.parse_rating(int(visibility))
            except ValueError:
                print(f"⚠️  Invalid visibility rating: {visibility}")
        
        # Build dive information text
        dive_info_parts = []
        
        if buddy:
            dive_info_parts.append(f"Buddy: {buddy}")
        
        if sac:
            dive_info_parts.append(f"SAC: {sac}")
        
        if otu:
            dive_info_parts.append(f"OTU: {otu}")
        
        if cns:
            dive_info_parts.append(f"CNS: {cns}")
        
        if computer_data:
            if computer_data.get('max_depth'):
                dive_info_parts.append(f"Max Depth: {computer_data['max_depth']}")
            if computer_data.get('mean_depth'):
                dive_info_parts.append(f"Avg Depth: {computer_data['mean_depth']}")
            if computer_data.get('water_temp'):
                dive_info_parts.append(f"Water Temp: {computer_data['water_temp']}")
            if computer_data.get('surface_pressure'):
                dive_info_parts.append(f"Surface Pressure: {computer_data['surface_pressure']}")
            if computer_data.get('water_salinity'):
                dive_info_parts.append(f"Salinity: {computer_data['water_salinity']}")
            
            # Add deco model from extradata
            for extradata in computer_data.get('extradata', []):
                if extradata['key'] == 'Deco model':
                    dive_info_parts.append(f"Deco Model: {extradata['value']}")
        
        # Add weight system information
        for weight in weights:
            weight_info = []
            if weight.get('weight'):
                weight_info.append(weight['weight'])
            if weight.get('description'):
                weight_info.append(weight['description'])
            if weight_info:
                dive_info_parts.append(f"Weights: {' '.join(weight_info)}")
        
        dive_information = "\n".join(dive_info_parts) if dive_info_parts else None
        
        # Build gas bottles information
        gas_bottles_parts = []
        for cylinder in cylinders:
            cylinder_info = []
            
            # Format: size + workpressure (e.g., "15.0l 232 bar")
            size = cylinder.get('size', '').replace(' l', 'l')  # Remove space before 'l'
            workpressure = cylinder.get('workpressure', '')
            
            if size and workpressure:
                # Extract numeric value from workpressure (e.g., "232.0 bar" -> "232")
                wp_value = workpressure.replace(' bar', '').strip()
                try:
                    wp_float = float(wp_value)
                    if wp_float.is_integer():
                        wp_value = str(int(wp_float))
                    else:
                        wp_value = str(wp_float)
                except ValueError:
                    wp_value = workpressure
                
                cylinder_info.append(f"{size} {wp_value} bar")
            elif size:
                cylinder_info.append(size)
            
            # Add O2 percentage
            if cylinder.get('o2'):
                cylinder_info.append(f"O2: {cylinder['o2']}")
            
            # Add pressure range
            if cylinder.get('start') and cylinder.get('end'):
                start_pressure = cylinder['start'].replace(' bar', '').strip()
                end_pressure = cylinder['end'].replace(' bar', '').strip()
                cylinder_info.append(f"{start_pressure} bar→{end_pressure} bar")
            
            if cylinder_info:
                gas_bottles_parts.append(" | ".join(cylinder_info))
        
        gas_bottles_used = "\n".join(gas_bottles_parts) if gas_bottles_parts else None
        
        # Find dive site
        dive_site_id = None
        if divesiteid and divesiteid in dive_sites:
            site_data = dive_sites[divesiteid]
            existing_site = self.find_dive_site_by_import_id(divesiteid)
            if existing_site:
                dive_site_id = existing_site['id']
            else:
                print(f"⚠️  Dive site not found: {site_data['name']} (ID: {divesiteid})")
        
        # Build Divemap dive data
        divemap_dive = {
            'dive_site_id': dive_site_id,
            'name': f"Dive #{dive_number}" if dive_number else None,
            'is_private': False,
            'dive_information': dive_information,
            'max_depth': None,  # Will be set from computer data if available
            'average_depth': None,  # Will be set from computer data if available
            'gas_bottles_used': gas_bottles_used,
            'suit_type': parsed_suit_type,
            'difficulty_level': 'intermediate',  # Default
            'visibility_rating': parsed_visibility,
            'user_rating': parsed_rating,
            'dive_date': parsed_date.strftime('%Y-%m-%d') if parsed_date else None,
            'dive_time': parsed_time.strftime('%H:%M:%S') if parsed_time else None,
            'duration': parsed_duration
        }
        
        # Set depths from computer data
        if computer_data:
            if computer_data.get('max_depth'):
                try:
                    # Extract numeric value from "28.7 m"
                    max_depth_str = computer_data['max_depth'].replace(' m', '')
                    divemap_dive['max_depth'] = float(max_depth_str)
                except ValueError:
                    print(f"⚠️  Invalid max depth: {computer_data['max_depth']}")
            
            if computer_data.get('mean_depth'):
                try:
                    # Extract numeric value from "16.849 m"
                    mean_depth_str = computer_data['mean_depth'].replace(' m', '')
                    divemap_dive['average_depth'] = float(mean_depth_str)
                except ValueError:
                    print(f"⚠️  Invalid mean depth: {computer_data['mean_depth']}")
        
        return divemap_dive

    def process_xml_file(self, xml_file_path: Path) -> bool:
        """Process a single XML file"""
        print(f"\n📁 Processing XML file: {xml_file_path}")
        
        if not xml_file_path.exists():
            print(f"❌ File not found: {xml_file_path}")
            return False
        
        # Parse XML file
        dives = self.parse_xml_file(xml_file_path)
        
        if not dives:
            print("❌ No dives found in XML file")
            return False
        
        print(f"📊 Found {len(dives)} dives in XML file")
        
        # Debug: Show first dive data
        if dives and self.dry_run:
            print(f"\n🔍 Sample dive data:")
            for key, value in dives[0].items():
                if value is not None:
                    print(f"   {key}: {value}")
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        for i, dive_data in enumerate(dives, 1):
            print(f"\n🔍 Processing dive {i}/{len(dives)}")
            
            if not dive_data.get('dive_date'):
                print("⚠️  Skipping dive without date")
                error_count += 1
                continue
            
            # Check if dive already exists
            existing_dive = self.check_existing_dive(dive_data)
            
            if existing_dive:
                if self.skip_existing:
                    print(f"⏭️  Skipping existing dive ID: {existing_dive['id']}")
                    skip_count += 1
                    continue
                
                if self.update_existing:
                    print(f"🔄 Updating existing dive ID: {existing_dive['id']}")
                    if not self.dry_run:
                        if self.update_dive(existing_dive['id'], dive_data):
                            success_count += 1
                        else:
                            error_count += 1
                    else:
                        print("🔍 [DRY RUN] Would update dive")
                        success_count += 1
                else:
                    print(f"⚠️  Dive already exists ID: {existing_dive['id']}")
                    if not self.force:
                        response = input("Update this dive? (y/N): ").strip().lower()
                        if response == 'y':
                            if not self.dry_run:
                                if self.update_dive(existing_dive['id'], dive_data):
                                    success_count += 1
                                else:
                                    error_count += 1
                            else:
                                print("🔍 [DRY RUN] Would update dive")
                                success_count += 1
                        else:
                            print("⏭️  Skipping dive")
                            skip_count += 1
                    else:
                        print("⏭️  Skipping dive (force mode)")
                        skip_count += 1
            else:
                print("🆕 Creating new dive")
                if not self.dry_run:
                    if self.create_dive(dive_data):
                        success_count += 1
                    else:
                        error_count += 1
                else:
                    print("🔍 [DRY RUN] Would create dive")
                    success_count += 1
        
        print(f"\n📈 Import Summary:")
        print(f"   ✅ Successfully processed: {success_count}")
        print(f"   ⏭️  Skipped: {skip_count}")
        print(f"   ❌ Errors: {error_count}")
        
        return error_count == 0

    def run(self, xml_file_path: str):
        """Main execution method"""
        print("🚀 Starting Subsurface XML Import")
        
        # Login to backend
        if not self.login():
            print("❌ Failed to login to backend")
            return False
        
        # Process XML file
        xml_path = Path(xml_file_path)
        return self.process_xml_file(xml_path)

def main():
    parser = argparse.ArgumentParser(description="Import Subsurface XML files into Divemap")
    parser.add_argument("xml_file", help="Path to Subsurface XML file")
    parser.add_argument("-f", "--force", action="store_true", help="Skip confirmation prompts")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be imported without actually importing")
    parser.add_argument("--skip-existing", action="store_true", help="Skip all dives that already exist")
    parser.add_argument("--update-existing", action="store_true", help="Update all existing dives with conflicts")
    parser.add_argument("--user-id", type=int, help="Specify user ID for imported dives (default: admin user)")
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.skip_existing and args.update_existing:
        print("❌ Cannot use both --skip-existing and --update-existing")
        return 1
    
    # Create importer
    importer = SubsurfaceXMLImporter(
        force=args.force,
        dry_run=args.dry_run,
        skip_existing=args.skip_existing,
        update_existing=args.update_existing,
        user_id=args.user_id
    )
    
    # Run import
    success = importer.run(args.xml_file)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
