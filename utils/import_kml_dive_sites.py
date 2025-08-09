#!/usr/bin/env python3
"""
Script to import dive sites from KML file into the database.
This script parses the KML file and creates dive sites with appropriate tags based on icon categories.
"""

import xml.etree.ElementTree as ET
import re
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import SessionLocal, engine
from app.models import Base, DiveSite, AvailableTag, DiveSiteTag, SiteMedia

# Icon to tag mapping based on the KML file analysis
ICON_TO_TAG_MAPPING = {
    "icon-1.png": "Shore Dive",
    "icon-2.png": "Boat Dive",
    "icon-3.png": "Wreck",
    "icon-4.png": "Reef",
    "icon-5.png": "Wall",
    "icon-6.png": "Cave",
    "icon-7.png": "Drift",
    "icon-8.png": "Deep",
    "icon-9.png": "Shallow",
    "icon-10.png": "Night Dive",
    "icon-11.png": "Training",
    "icon-12.png": "Photography",
    "icon-13.png": "Marine Life",
    "icon-14.png": "Advanced",
    "icon-15.png": "Beginner",
    "icon-16.png": "Wreck",
    "icon-17.png": "Reef"
}

def parse_kml_file(kml_file_path: str) -> List[Dict]:
    """Parse the KML file and extract dive site information."""
    tree = ET.parse(kml_file_path)
    root = tree.getroot()

    # Define the namespace
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}

    dive_sites = []

    # Find all Placemark elements
    for placemark in root.findall('.//kml:Placemark', ns):
        site_data = {}

        # Get name
        name_elem = placemark.find('kml:name', ns)
        if name_elem is not None:
            site_data['name'] = name_elem.text.strip()
        else:
            continue  # Skip if no name

        # Get coordinates
        coords_elem = placemark.find('.//kml:coordinates', ns)
        if coords_elem is not None:
            coords_text = coords_elem.text.strip()
            # Parse coordinates (format: longitude,latitude,altitude)
            coords = coords_text.split(',')
            if len(coords) >= 2:
                site_data['longitude'] = Decimal(coords[0])
                site_data['latitude'] = Decimal(coords[1])

        # Get style URL to determine icon/tag
        style_elem = placemark.find('kml:styleUrl', ns)
        if style_elem is not None:
            style_url = style_elem.text.strip()
            # Extract icon from style URL (e.g., "#icon-1521-FFEA00" -> "icon-14.png")
            icon_match = re.search(r'icon-(\d+)', style_url)
            if icon_match:
                icon_num = icon_match.group(1)
                icon_name = f"icon-{icon_num}.png"
                site_data['icon'] = icon_name

        # Get ExtendedData for additional information
        extended_data = placemark.find('kml:ExtendedData', ns)
        if extended_data is not None:
            for data_elem in extended_data.findall('kml:Data', ns):
                name_attr = data_elem.get('name')
                value_elem = data_elem.find('kml:value', ns)
                if name_attr and value_elem is not None and value_elem.text is not None:
                    value = value_elem.text.strip()
                    # Only add non-empty values
                    if value:
                        site_data[name_attr.lower()] = value

        # Set description from ExtendedData, or empty string if not available
        site_data['description'] = site_data.get('description', '')

        dive_sites.append(site_data)

    return dive_sites

def create_tags(db_session) -> Dict[str, int]:
    """Create tags in the database and return a mapping of tag names to IDs."""
    tag_mapping = {}

    for tag_name in set(ICON_TO_TAG_MAPPING.values()):
        # Check if tag already exists
        existing_tag = db_session.query(AvailableTag).filter(AvailableTag.name == tag_name).first()
        if existing_tag:
            tag_mapping[tag_name] = existing_tag.id
        else:
            # Create new tag
            new_tag = AvailableTag(name=tag_name, description=f"Tag for {tag_name} dive sites")
            db_session.add(new_tag)
            db_session.commit()
            db_session.refresh(new_tag)
            tag_mapping[tag_name] = new_tag.id

    return tag_mapping

def import_dive_sites(dive_sites: List[Dict], db_session) -> None:
    """Import dive sites into the database."""
    # First, create all tags
    tag_mapping = create_tags(db_session)

    # Create icon to tag mapping
    icon_to_tag = {}
    for icon, tag_name in ICON_TO_TAG_MAPPING.items():
        if tag_name in tag_mapping:
            icon_to_tag[icon] = tag_mapping[tag_name]

    imported_count = 0
    updated_count = 0
    skipped_count = 0

    for site_data in dive_sites:
        # Check if dive site already exists (by name and coordinates)
        existing_site = db_session.query(DiveSite).filter(
            DiveSite.name == site_data['name'],
            DiveSite.latitude == site_data.get('latitude'),
            DiveSite.longitude == site_data.get('longitude')
        ).first()

        if existing_site:
            # Update existing site with proper description if it's empty or malformed
            if not existing_site.description or existing_site.description.startswith('description: <br>'):
                existing_site.description = site_data.get('description', '')
                db_session.commit()
                print(f"Updated description for: {site_data['name']}")
                updated_count += 1
            else:
                print(f"Skipping existing dive site: {site_data['name']}")
                skipped_count += 1
            continue

        # Create new dive site
        dive_site = DiveSite(
            name=site_data['name'],
            description=site_data.get('description', ''),
            latitude=site_data.get('latitude'),
            longitude=site_data.get('longitude'),
            access_instructions=site_data.get('directions', ''),
            difficulty_level='intermediate'  # Default difficulty
        )

        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)

        # Add tag if available
        icon = site_data.get('icon')
        if icon and icon in icon_to_tag:
            tag_id = icon_to_tag[icon]
            site_tag = DiveSiteTag(
                dive_site_id=dive_site.id,
                tag_id=tag_id
            )
            db_session.add(site_tag)

        # Add media links if available
        media_links = site_data.get('gx_media_links', '')
        if media_links:
            # Split multiple links if present
            links = [link.strip() for link in media_links.split(',') if link.strip()]
            for link in links:
                media = SiteMedia(
                    dive_site_id=dive_site.id,
                    media_type='video' if 'youtube' in link.lower() or 'video' in link.lower() else 'photo',
                    url=link,
                    description=f"Media for {dive_site.name}"
                )
                db_session.add(media)

        db_session.commit()
        imported_count += 1
        print(f"Imported: {site_data['name']} (lat: {site_data.get('latitude')}, lng: {site_data.get('longitude')})")

    print(f"\nImport completed:")
    print(f"  - Imported: {imported_count} dive sites")
    print(f"  - Updated: {updated_count} existing dive sites")
    print(f"  - Skipped: {skipped_count} existing dive sites")
    print(f"  - Total tags created: {len(tag_mapping)}")

def update_existing_descriptions(dive_sites: List[Dict], db_session) -> None:
    """Update descriptions for existing dive sites that have malformed descriptions."""
    updated_count = 0

    for site_data in dive_sites:
        # Find existing site by name and coordinates
        existing_site = db_session.query(DiveSite).filter(
            DiveSite.name == site_data['name'],
            DiveSite.latitude == site_data.get('latitude'),
            DiveSite.longitude == site_data.get('longitude')
        ).first()

        if existing_site:
            # Check if description is malformed or empty
            if not existing_site.description or existing_site.description.startswith('description: <br>'):
                existing_site.description = site_data.get('description', '')
                db_session.commit()
                print(f"Updated description for: {site_data['name']}")
                updated_count += 1

    print(f"\nDescription update completed:")
    print(f"  - Updated: {updated_count} dive sites")

def main():
    """Main function to run the import."""
    kml_file_path = "map/doc.kml"

    if not os.path.exists(kml_file_path):
        print(f"Error: KML file not found at {kml_file_path}")
        return

    print("Parsing KML file...")
    dive_sites = parse_kml_file(kml_file_path)
    print(f"Found {len(dive_sites)} dive sites in KML file")

    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Check command line arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--update-descriptions":
        # Just update descriptions for existing sites
        db_session = SessionLocal()
        try:
            update_existing_descriptions(dive_sites, db_session)
        finally:
            db_session.close()
    else:
        # Full import
        db_session = SessionLocal()
        try:
            import_dive_sites(dive_sites, db_session)
        finally:
            db_session.close()

if __name__ == "__main__":
    main()