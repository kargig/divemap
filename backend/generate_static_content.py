import os
import sys
import time
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

# Ensure backend directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import DiveSite, DiveRoute, DivingCenter, Dive, ParsedDiveTrip

# R2 Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

OUTPUT_DIR = os.path.join(current_dir, "llm_content")
REQUIRED_FILES = ["dive-sites.md", "dive-routes.md", "diving-centers.md", "dives.md", "llms.txt", "sitemap.xml"]

def get_r2_client():
    if R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME:
        try:
            return boto3.client(
                's3',
                endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
                aws_access_key_id=R2_ACCESS_KEY_ID,
                aws_secret_access_key=R2_SECRET_ACCESS_KEY,
                region_name='auto'
            )
        except Exception as e:
            print(f"⚠️ Failed to create R2 client: {e}")
    return None

def check_r2_freshness(client):
    """Check if llms.txt exists on R2 and is less than 24 hours old."""
    try:
        response = client.head_object(Bucket=R2_BUCKET_NAME, Key="llm_content/llms.txt")
        last_modified = response['LastModified'].timestamp()
        age_seconds = time.time() - last_modified

        if age_seconds < 86400:
            print(f"✅ R2 content is fresh ({age_seconds/3600:.1f} hours old). Skipping generation.")
            return True
        else:
            print(f"R2 content is stale ({age_seconds/3600:.1f} hours old). Regenerating...")
            return False
    except ClientError:
        print("Content not found in R2. Generating...")
        return False

def upload_to_r2(client, filename, content):
    """Upload content string to R2."""
    try:
        content_type = 'text/plain'
        if filename.endswith('.md'):
            content_type = 'text/markdown'
        elif filename.endswith('.xml'):
            content_type = 'application/xml'

        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=f"llm_content/{filename}",
            Body=content.encode('utf-8'),
            ContentType=content_type
        )
        print(f"⬆️ Uploaded {filename} to R2")
    except Exception as e:
        print(f"⚠️ Failed to upload {filename} to R2: {e}")

def should_generate_local():
    """Fallback local check."""
    # Check if all files exist
    for filename in REQUIRED_FILES:
        if not os.path.exists(os.path.join(OUTPUT_DIR, filename)):
            return True

    # Check age of llms.txt
    llms_txt_path = os.path.join(OUTPUT_DIR, "llms.txt")
    mtime = os.path.getmtime(llms_txt_path)
    age_seconds = time.time() - mtime

    if age_seconds < 86400:
        print(f"Skipping generation: Local content is recent ({age_seconds/3600:.1f} hours old).")
        return False
    return True

def download_from_r2(client):
    """Download all required files from R2 to local directory."""
    print("⬇️ Downloading LLM content from R2...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    success = True
    for filename in REQUIRED_FILES:
        try:
            client.download_file(
                Bucket=R2_BUCKET_NAME,
                Key=f"llm_content/{filename}",
                Filename=os.path.join(OUTPUT_DIR, filename)
            )
        except Exception as e:
            print(f"⚠️ Failed to download {filename}: {e}")
            success = False

    if success:
        print(f"✅ All content downloaded to {OUTPUT_DIR}.")
    return success

def generate_content(db: Session, r2_client=None):
    # Data gathering
    sites = db.query(DiveSite).all()
    routes = db.query(DiveRoute).filter(DiveRoute.deleted_at == None).all()
    centers = db.query(DivingCenter).all()
    dives = db.query(Dive).filter(Dive.is_private == False).all()

    # 1. Dive Sites
    content_sites = ["# Dive Sites\n\n> Comprehensive registry of dive sites including GPS coordinates, depth profiles, difficulty, and marine life.\n\n"]
    for site in sites:
        # Contextual Header: Name (Region, Country)
        location_suffix = []
        if site.region: location_suffix.append(site.region)
        if site.country: location_suffix.append(site.country)
        location_str = f" ({', '.join(location_suffix)})" if location_suffix else ""

        content_sites.append(f"## {site.name}{location_str}\n\n")

        # Standardized Metadata Block
        if site.latitude is not None and site.longitude is not None:
            content_sites.append(f"**Coordinates**: {float(site.latitude):.6f}, {float(site.longitude):.6f}\n")

        # Stats Line
        stats = []
        if site.max_depth: stats.append(f"**Max Depth**: {site.max_depth}m")
        if site.difficulty: stats.append(f"**Difficulty**: {site.difficulty.label}")
        if stats: content_sites.append(" | ".join(stats) + "\n")

        # Description & Details
        if site.description:
            content_sites.append(f"\n{site.description}\n")

        if site.marine_life:
            content_sites.append(f"\n**Marine Life**:\n{site.marine_life}\n")

        if site.safety_information:
            content_sites.append(f"\n**Safety Information**:\n{site.safety_information}\n")

        if site.access_instructions:
            content_sites.append(f"\n**Access**:\n{site.access_instructions}\n")

        content_sites.append("\n---\n\n")

    # 2. Dive Routes
    content_routes = ["# Dive Routes\n\n> Specific underwater navigation paths and routes for dive sites.\n\n"]
    for route in routes:
        content_routes.append(f"## {route.name}\n\n")
        if route.dive_site: content_routes.append(f"**Dive Site**: {route.dive_site.name}\n\n")
        content_routes.append(f"**Type**: {route.route_type.name if route.route_type else 'Unknown'}\n\n")
        if route.description: content_routes.append(f"{route.description}\n\n")
        content_routes.append("---\n\n")

    # 3. Diving Centers
    content_centers = ["# Diving Centers\n\n> Directory of professional diving centers, schools, and shops.\n\n"]
    for center in centers:
        # Contextual Header: Name (City/Region, Country)
        location_suffix = []
        if center.city: location_suffix.append(center.city)
        elif center.region: location_suffix.append(center.region)
        if center.country: location_suffix.append(center.country)
        location_str = f" ({', '.join(location_suffix)})" if location_suffix else ""

        content_centers.append(f"## {center.name}{location_str}\n\n")

        if center.address: content_centers.append(f"**Address**: {center.address}\n")
        if center.website: content_centers.append(f"**Website**: {center.website}\n")

        if center.description:
            content_centers.append(f"\n{center.description}\n")

        content_centers.append("\n---\n\n")

    # 4. Public Dives
    content_dives = ["# Public Dive Logs\n\n> Collection of recent public dive logs sharing conditions, visibility, and user ratings.\n\n"]
    for dive in dives:
        title = dive.name if dive.name else "Dive Log"
        date_str = dive.dive_date.strftime("%Y-%m-%d") if dive.dive_date else "Unknown Date"

        content_dives.append(f"## {title} - {date_str}\n\n")

        if dive.dive_site: content_dives.append(f"**Site**: {dive.dive_site.name}\n")
        if dive.user_rating: content_dives.append(f"**Rating**: {dive.user_rating}/10\n")
        if dive.dive_information: content_dives.append(f"\n{dive.dive_information}\n")
        content_dives.append("---\n\n")

    # 5. llms.txt
    content_llms = [
        "# Divemap Knowledge Base\n\n",
        "> Divemap is a platform for discovering, logging, and reviewing scuba dive sites and centers.\n\n",

        "## Capabilities\n",
        "- **Core Platform**: User Management (OAuth), Dive Sites CRUD, Dive Logging, and Interactive Maps using OpenLayers.\n",
        "- **Weather & Environment**: Real-time wind data overlay with intelligent dive site suitability recommendations based on weather conditions.\n",
        "- **Advanced Search**: Multi-criteria search (name, difficulty, location, tags) and wind-based suitability filtering.\n",
        "- **Newsletter System**: AI-powered parsing of newsletters to extract dive trips, match diving centers, and link dive sites automatically.\n",
        "- **Professional Network**: Management of global diving organizations (PADI, SSI, GUE, etc.) and comprehensive tracking of user certifications.\n",
        "- **Diving Calculators**: Suite of tools including Best Mix, Gas Planning, MOD, SAC Rate, ICD, and Weight estimation. Powered by a high-precision physics engine.\n",
        "- **Mobile Experience**: Progressive Web App (PWA) support with offline capabilities and touch-optimized tools for field use.\n",
        "- **Calculators & Tools**: Geographic distance calculations using the Haversine formula and user location integration with manual fallback.\n",
        "- **Admin Dashboard**: Real-time platform statistics, health monitoring, RBAC, and bulk management operations.\n",
        "- **Tech Stack**: React Frontend, FastAPI Backend (Python), MySQL Database, and Cloudflare R2 Storage.\n\n",

        "## Core Databases\n",
        "- [Dive Sites](/dive-sites.md): Comprehensive registry of dive sites including GPS coordinates, max depth, difficulty levels, and marine life observations.\n",
        "- [Diving Centers](/diving-centers.md): Directory of dive shops and schools, including location services and contact information.\n\n",

        "## Dive Data\n",
        "- [Dive Routes](/dive-routes.md): Specific underwater paths and navigation routes for selected sites.\n",
        "- [Public Dive Logs](/dives.md): Collection of public dive logs sharing visibility conditions, water temperature, and user ratings.\n\n",

        "## Documentation & Resources\n",
        "- [API Documentation](/docs): OpenAPI specification and interactive API documentation.\n",
        "- [About Divemap](/about): Project mission, team, and contact information.\n",
        "- [GitHub Repository](https://github.com/kargig/divemap): Source code, issue tracker, and contribution guidelines.\n"
    ]

    # 6. sitemap.xml
    BASE_URL = "https://divemap.gr"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    sitemap_entries = []

    # Static pages
    static_paths = ["/", "/about", "/dive-sites", "/diving-centers", "/dives", "/dive-trips", "/api-docs", "/help", "/privacy"]
    for path in static_paths:
        sitemap_entries.append(f"  <url>\n    <loc>{BASE_URL}{path}</loc>\n    <lastmod>{now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>")

    # Dive Sites
    for site in sites:
        lastmod = site.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(site, 'updated_at') and site.updated_at else now
        sitemap_entries.append(f"  <url>\n    <loc>{BASE_URL}/dive-sites/{site.id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>")

    # Diving Centers
    for center in centers:
        lastmod = center.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(center, 'updated_at') and center.updated_at else now
        sitemap_entries.append(f"  <url>\n    <loc>{BASE_URL}/diving-centers/{center.id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>")

    # Public Dives
    for dive in dives:
        lastmod = dive.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(dive, 'updated_at') and dive.updated_at else now
        sitemap_entries.append(f"  <url>\n    <loc>{BASE_URL}/dives/{dive.id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>")

    # Dive Trips
    trips = db.query(ParsedDiveTrip).all()
    for trip in trips:
        lastmod = trip.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(trip, 'updated_at') and trip.updated_at else now
        sitemap_entries.append(f"  <url>\n    <loc>{BASE_URL}/dive-trips/{trip.id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>")

    sitemap_xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        *sitemap_entries,
        '</urlset>'
    ]

    files = {
        "dive-sites.md": "".join(content_sites),
        "dive-routes.md": "".join(content_routes),
        "diving-centers.md": "".join(content_centers),
        "dives.md": "".join(content_dives),
        "llms.txt": "".join(content_llms),
        "sitemap.xml": "\n".join(sitemap_xml)
    }

    # Always write to local directory (for serving via Nginx -> Backend proxy)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for fname, content in files.items():
        with open(os.path.join(OUTPUT_DIR, fname), "w", encoding="utf-8") as f:
            f.write(content)
    print(f"✅ All content written to {OUTPUT_DIR}.")

    # Optionally upload to R2
    if r2_client:
        for fname, content in files.items():
            upload_to_r2(r2_client, fname, content)
        print("✅ All content uploaded to R2.")

import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate LLM content for Divemap.")
    parser.add_argument("--force", action="store_true", help="Force regeneration of content regardless of freshness.")
    args = parser.parse_args()

    r2 = get_r2_client()

    if not args.force:
        if r2:
            if check_r2_freshness(r2):
                download_from_r2(r2)
                sys.exit(0)
        else:
            # Local check
            if not should_generate_local():
                sys.exit(0)

    db = SessionLocal()
    try:
        generate_content(db, r2)
    except Exception as e:
        print(f"Error generating content: {e}")
        sys.exit(1)
    finally:
        db.close()



