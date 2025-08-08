#!/usr/bin/env python3
"""
Enhanced Dive Site Import Script

This script reads dive site files from 01-Divesites/ and imports them
via the backend API. It performs similarity checks and proximity checks before
creating new dive sites.

Features:
- Smart similarity matching for dive site names
- Proximity checking (200m threshold)
- Interactive merge functionality for conflicting sites
- Force mode for batch processing
- Dry run mode for testing
- Merge file generation for complex updates
- Automatic skipping of files without GPS coordinates

Usage:
    python import_dive_sites_enhanced.py [-f] [--dry-run] [--skip-all] [--update-all] [--create-merge-all] [--import-merge FILE]

Options:
    -f, --force: Skip confirmation prompts
    --dry-run: Show what would be imported without actually importing
    --skip-all: Skip all sites with conflicts
    --update-all: Update all existing sites with conflicts
    --create-merge-all: Create merge files for all sites that can be updated
    --import-merge FILE: Import merge file to apply final changes
"""

import os
import sys
import json
import argparse
import requests
import math
import time
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import re
from datetime import datetime
from difflib import SequenceMatcher

# Configuration
BACKEND_URL = "http://localhost:8000"
AUTH_ENDPOINT = f"{BACKEND_URL}/api/v1/auth/login"
DIVE_SITES_ENDPOINT = f"{BACKEND_URL}/api/v1/dive-sites"
SEARCH_ENDPOINT = f"{BACKEND_URL}/api/v1/dive-sites"

# Distance threshold for nearby dive sites (in meters)
DISTANCE_THRESHOLD = 200

# Similarity threshold for name matching (0.0 to 1.0)
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
                # This should be a credential line like "admin/Admin123!"
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

class DiveSiteImporter:
    def __init__(self, force: bool = False, dry_run: bool = False, 
                 skip_all: bool = False, update_all: bool = False, create_merge_all: bool = False):
        self.force = force
        self.dry_run = dry_run
        self.skip_all = skip_all
        self.update_all = update_all
        self.create_merge_all = create_merge_all
        self.session = requests.Session()
        self.token = None
        self.stats = {
            'processed': 0,
            'skipped_similar_name': 0,
            'skipped_nearby': 0,
            'skipped_no_gps': 0,
            'created': 0,
            'updated': 0,
            'errors': 0,
            'merge_files_created': 0
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
            print(f"Login response: {response.text[:100]}")
            response.raise_for_status()
            data = response.json()
            self.token = data["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"✅ Successfully logged in as {admin_username}")
            return True
        except Exception as e:
            print(f"❌ Failed to login: {e}")
            return False

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula (in meters)"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

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

    def search_similar_dive_sites(self, name: str, latitude: float, longitude: float) -> Tuple[Optional[Dict], Optional[Dict]]:
        """Search for dive sites with similar names and nearby locations"""
        try:
            # Search by name
            response = self.session.get(SEARCH_ENDPOINT, params={"name": name})
            if response.status_code == 429:  # Rate limited
                print("   ⏳ Rate limited, waiting 2 seconds...")
                time.sleep(2)
                response = self.session.get(SEARCH_ENDPOINT, params={"name": name})
            response.raise_for_status()
            name_matches = response.json()
            
            # Search for nearby sites (within 1km to be safe)
            nearby_response = self.session.get(SEARCH_ENDPOINT, params={
                "limit": 100  # Get more results to check distance
            })
            if nearby_response.status_code == 429:  # Rate limited
                print("   ⏳ Rate limited, waiting 2 seconds...")
                time.sleep(2)
                nearby_response = self.session.get(SEARCH_ENDPOINT, params={
                    "limit": 100
                })
            nearby_response.raise_for_status()
            all_sites = nearby_response.json()
            
            similar_name_site = None
            nearby_site = None
            best_similarity = 0.0
            
            # Check for similar names
            for site in name_matches:
                similarity = self.calculate_similarity(name, site['name'])
                if similarity >= SIMILARITY_THRESHOLD and similarity > best_similarity:
                    similar_name_site = site
                    best_similarity = similarity
            
            # Check for nearby sites
            closest_distance = float('inf')
            for site in all_sites:
                distance = self.calculate_distance(
                    latitude, longitude,
                    site['latitude'], site['longitude']
                )
                if distance <= DISTANCE_THRESHOLD and distance < closest_distance:
                    nearby_site = site
                    closest_distance = distance
            
            return similar_name_site, nearby_site
            
        except Exception as e:
            print(f"❌ Error searching for similar dive sites: {e}")
            return None, None

    def parse_dive_site_file(self, file_path: Path) -> Optional[Dict]:
        """Parse a dive site file and return structured data"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
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
                            print(f"❌ Invalid GPS coordinates in {file_path}: {value}")
                            return None
                    else:
                        print(f"❌ Invalid GPS format in {file_path}: {value} (expected 2 coordinates)")
                        return None
            
            # Validate required fields
            if not site_data.get('name'):
                print(f"❌ Missing name field in {file_path}")
                return None
            
            if not gps_found:
                found_fields = list(site_data.keys())
                print(f"⚠️  No GPS coordinates found in {file_path} - skipping file")
                if found_fields:
                    print(f"   Found fields: {', '.join(found_fields)}")
                else:
                    print(f"   No valid fields found in file")
                return "NO_GPS"
            
            if 'latitude' not in site_data or 'longitude' not in site_data:
                print(f"❌ GPS coordinates found but invalid in {file_path}")
                return None
            
            return site_data
            
        except Exception as e:
            print(f"❌ Error parsing {file_path}: {e}")
            return None

    def create_merge_file(self, existing_site: Dict, new_site: Dict, filename: str) -> str:
        """Create a merge file for complex updates"""
        merge_content = f"""# Merge file for dive site update
# Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# File: {filename}

--existing--
{json.dumps(existing_site, indent=2)}

--new--
{json.dumps(new_site, indent=2)}

--final--
# Edit the section below with the final merged data
# Then run: python import_dive_sites_enhanced.py --import-merge this_file.txt
{{
  "name": "{new_site['name']}",
  "description": "{new_site.get('description', existing_site.get('description', ''))}",
  "latitude": {new_site['latitude']},
  "longitude": {new_site['longitude']},
  "address": "{existing_site.get('address', '')}",
  "access_instructions": "{existing_site.get('access_instructions', '')}",
  "difficulty_level": "{existing_site.get('difficulty_level', '')}",
  "marine_life": "{existing_site.get('marine_life', '')}",
  "safety_information": "{existing_site.get('safety_information', '')}",
  "aliases": "{existing_site.get('aliases', '')}",
  "country": "{existing_site.get('country', '')}",
  "region": "{existing_site.get('region', '')}"
}}
"""
        
        merge_filename = f"merge_{existing_site['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
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
            
            # Extract site ID from filename or content
            site_id_match = re.search(r'merge_(\d+)_', merge_file_path)
            if not site_id_match:
                print(f"❌ Could not extract site ID from filename: {merge_file_path}")
                return False
            
            site_id = int(site_id_match.group(1))
            
            # Update the dive site
            return self.update_dive_site(site_id, final_data)
            
        except Exception as e:
            print(f"❌ Error importing merge file: {e}")
            return False

    def create_dive_site(self, site_data: Dict) -> bool:
        """Create a dive site via API"""
        try:
            payload = {
                "name": site_data['name'],
                "description": site_data.get('description', ''),
                "latitude": site_data['latitude'],
                "longitude": site_data['longitude']
            }
            
            if self.dry_run:
                print(f"📝 Would create dive site: {json.dumps(payload, indent=2)}")
                return True
            
            response = self.session.post(DIVE_SITES_ENDPOINT, json=payload)
            response.raise_for_status()
            
            created_site = response.json()
            print(f"✅ Created dive site: {created_site['name']} (ID: {created_site['id']})")
            return True
            
        except Exception as e:
            print(f"❌ Error creating dive site: {e}")
            return False

    def update_dive_site(self, site_id: int, site_data: Dict) -> bool:
        """Update an existing dive site"""
        try:
            payload = {
                "name": site_data['name'],
                "description": site_data.get('description', ''),
                "latitude": site_data['latitude'],
                "longitude": site_data['longitude']
            }
            
            # Add optional fields if they exist
            optional_fields = ['address', 'access_instructions', 'difficulty_level', 
                             'marine_life', 'safety_information', 'aliases',
                             'country', 'region']
            for field in optional_fields:
                if field in site_data and site_data[field]:
                    payload[field] = site_data[field]
            
            if self.dry_run:
                print(f"📝 Would update dive site {site_id}: {json.dumps(payload, indent=2)}")
                return True
            
            response = self.session.put(f"{DIVE_SITES_ENDPOINT}/{site_id}", json=payload)
            response.raise_for_status()
            
            updated_site = response.json()
            print(f"✅ Updated dive site: {updated_site['name']} (ID: {updated_site['id']})")
            return True
            
        except Exception as e:
            print(f"❌ Error updating dive site: {e}")
            return False

    def process_dive_site(self, file_path: Path) -> bool:
        """Process a single dive site file"""
        print(f"\n📄 Processing: {file_path.name}")
        
        # Parse the file
        site_data = self.parse_dive_site_file(file_path)
        if site_data == "NO_GPS":
            self.stats['skipped_no_gps'] += 1
            return True
        elif not site_data:
            self.stats['errors'] += 1
            return False
        
        print(f"   Name: {site_data['name']}")
        print(f"   Coordinates: {site_data['latitude']}, {site_data['longitude']}")
        if site_data.get('description'):
            print(f"   Description: {site_data['description']}")
        
        # Check for similar names and nearby sites
        similar_site, nearby_site = self.search_similar_dive_sites(
            site_data['name'], site_data['latitude'], site_data['longitude']
        )
        
        # Handle similar name
        if similar_site:
            similarity = self.calculate_similarity(site_data['name'], similar_site['name'])
            print(f"⚠️  Found similar dive site: {similar_site['name']} (ID: {similar_site['id']}, similarity: {similarity:.2f})")
            
            if self.skip_all:
                print("   Skipping due to --skip-all flag")
                self.stats['skipped_similar_name'] += 1
                return True
            
            if self.create_merge_all:
                merge_file = self.create_merge_file(similar_site, site_data, file_path.name)
                print(f"   📝 Created merge file: {merge_file}")
                self.stats['merge_files_created'] += 1
                return True
            
            if not self.force:
                choice = input(f"   Skip similar site? (y/n/m for merge file): ").lower().strip()
                if choice == 'y':
                    self.stats['skipped_similar_name'] += 1
                    return True
                elif choice == 'm':
                    merge_file = self.create_merge_file(similar_site, site_data, file_path.name)
                    print(f"   📝 Created merge file: {merge_file}")
                    self.stats['merge_files_created'] += 1
                    return True
            else:
                print("   Force mode: skipping similar site")
                self.stats['skipped_similar_name'] += 1
                return True
        
        # Handle nearby site
        if nearby_site:
            distance = self.calculate_distance(
                site_data['latitude'], site_data['longitude'],
                nearby_site['latitude'], nearby_site['longitude']
            )
            print(f"⚠️  Found nearby dive site: {nearby_site['name']} (ID: {nearby_site['id']}, {distance:.0f}m away)")
            
            if self.skip_all:
                print("   Skipping due to --skip-all flag")
                self.stats['skipped_nearby'] += 1
                return True
            
            if self.update_all:
                print("   Update-all mode: updating existing site")
                success = self.update_dive_site(nearby_site['id'], site_data)
                if success:
                    self.stats['updated'] += 1
                return success
            
            if self.create_merge_all:
                merge_file = self.create_merge_file(nearby_site, site_data, file_path.name)
                print(f"   📝 Created merge file: {merge_file}")
                self.stats['merge_files_created'] += 1
                return True
            
            if not self.force:
                choice = input(f"   Update existing site, create new one, or skip? (u/c/s/m for merge file): ").lower().strip()
                if choice == 'u':
                    success = self.update_dive_site(nearby_site['id'], site_data)
                    if success:
                        self.stats['updated'] += 1
                    return success
                elif choice == 'm':
                    merge_file = self.create_merge_file(nearby_site, site_data, file_path.name)
                    print(f"   📝 Created merge file: {merge_file}")
                    self.stats['merge_files_created'] += 1
                    return True
                elif choice == 's':
                    print("   Skipping...")
                    self.stats['skipped_nearby'] += 1
                    return True
                # If choice is 'c', continue to create new site
            else:
                print("   Force mode: creating new site")
        
        # Confirm creation (unless force mode)
        if not self.force and not self.dry_run:
            print(f"\n📋 About to create dive site:")
            print(f"   Name: {site_data['name']}")
            print(f"   Coordinates: {site_data['latitude']}, {site_data['longitude']}")
            if site_data.get('description'):
                print(f"   Description: {site_data['description']}")
            
            confirm = input("   Proceed? (y/n): ").lower().strip()
            if confirm != 'y':
                print("   Skipping...")
                return True
        
        # Create the dive site
        success = self.create_dive_site(site_data)
        if success:
            self.stats['created'] += 1
        else:
            self.stats['errors'] += 1
        
        return success

    def run(self):
        """Main execution method"""
        print("🚀 Enhanced Dive Site Import Script")
        print("=" * 50)
        
        # Login
        if not self.login():
            return False
        
        # Find dive site files
        sites_dir = Path("utils/01-Divesites")
        if not sites_dir.exists():
            print(f"❌ Directory not found: {sites_dir}")
            return False
        
        site_files = list(sites_dir.glob("Site-*"))
        if not site_files:
            print(f"❌ No dive site files found in {sites_dir}")
            return False
        
        print(f"📁 Found {len(site_files)} dive site files")
        
        if self.dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
        
        if self.force:
            print("⚡ FORCE MODE - Skipping confirmations")
        
        if self.skip_all:
            print("⏭️  SKIP ALL MODE - Skipping all conflicts")
        
        if self.update_all:
            print("🔄 UPDATE ALL MODE - Updating all existing sites")
        
        if self.create_merge_all:
            print("📝 CREATE MERGE ALL MODE - Creating merge files for all conflicts")
        
        # Process each file
        for file_path in sorted(site_files):
            self.stats['processed'] += 1
            self.process_dive_site(file_path)
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 Import Summary:")
        print(f"   Processed: {self.stats['processed']}")
        print(f"   Created: {self.stats['created']}")
        print(f"   Updated: {self.stats['updated']}")
        print(f"   Skipped (similar name): {self.stats['skipped_similar_name']}")
        print(f"   Skipped (nearby): {self.stats['skipped_nearby']}")
        print(f"   Skipped (no GPS): {self.stats['skipped_no_gps']}")
        print(f"   Merge files created: {self.stats['merge_files_created']}")
        print(f"   Errors: {self.stats['errors']}")
        
        return self.stats['errors'] == 0

def main():
    parser = argparse.ArgumentParser(description="Import dive sites from files")
    parser.add_argument("-f", "--force", action="store_true", 
                       help="Skip confirmation prompts")
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be imported without actually importing")
    parser.add_argument("--skip-all", action="store_true",
                       help="Skip all sites with conflicts")
    parser.add_argument("--update-all", action="store_true",
                       help="Update all existing sites with conflicts")
    parser.add_argument("--create-merge-all", action="store_true",
                       help="Create merge files for all sites that can be updated")
    parser.add_argument("--import-merge", type=str,
                       help="Import merge file to apply final changes")
    
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
        importer = DiveSiteImporter()
        if not importer.login():
            return 1
        
        success = importer.import_merge_file(args.import_merge)
        return 0 if success else 1
    
    # Run the importer
    importer = DiveSiteImporter(
        force=args.force, 
        dry_run=args.dry_run,
        skip_all=args.skip_all,
        update_all=args.update_all,
        create_merge_all=args.create_merge_all
    )
    success = importer.run()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main()) 
