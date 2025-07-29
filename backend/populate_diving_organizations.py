#!/usr/bin/env python3
"""
Script to populate diving organizations with the top 10 diving organizations.
This script should be run after the migration has been applied.
"""

import os
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import DivingOrganization

# Top 10 diving organizations with their details
DIVING_ORGANIZATIONS = [
    {
        "name": "Professional Association of Diving Instructors",
        "acronym": "PADI",
        "website": "https://www.padi.com",
        "logo_url": "https://www.padi.com/sites/default/files/2019-01/padi-logo.png",
        "description": "PADI is the world's leading scuba diver training organization, with more than 6,600 PADI Dive Centers and Resorts worldwide.",
        "country": "United States",
        "founded_year": 1966
    },
    {
        "name": "Scuba Schools International",
        "acronym": "SSI",
        "website": "https://www.divessi.com",
        "logo_url": "https://www.divessi.com/images/ssi-logo.png",
        "description": "SSI is a global diving organization that provides training, certification, and educational materials for divers, dive instructors, and dive centers.",
        "country": "United States",
        "founded_year": 1970
    },
    {
        "name": "Global Underwater Explorers",
        "acronym": "GUE",
        "website": "https://www.gue.com",
        "logo_url": "https://www.gue.com/images/gue-logo.png",
        "description": "GUE is a non-profit organization dedicated to the exploration and conservation of the underwater world through research, education, and exploration.",
        "country": "United States",
        "founded_year": 1998
    },
    {
        "name": "Rebreather Association of International Divers",
        "acronym": "RAID",
        "website": "https://www.raid-diving.com",
        "logo_url": "https://www.raid-diving.com/images/raid-logo.png",
        "description": "RAID is a global diving training organization that offers comprehensive diver education programs from beginner to technical levels.",
        "country": "United Kingdom",
        "founded_year": 2007
    },
    {
        "name": "Confédération Mondiale des Activités Subaquatiques",
        "acronym": "CMAS",
        "website": "https://www.cmas.org",
        "logo_url": "https://www.cmas.org/images/cmas-logo.png",
        "description": "CMAS is the World Underwater Federation, an international organization that promotes underwater activities including scuba diving.",
        "country": "France",
        "founded_year": 1959
    },
    {
        "name": "Technical Diving International",
        "acronym": "TDI",
        "website": "https://www.tdisdi.com",
        "logo_url": "https://www.tdisdi.com/images/tdi-logo.png",
        "description": "TDI is a professional diving organization that specializes in technical diving education and certification.",
        "country": "United States",
        "founded_year": 1994
    },
    {
        "name": "National Association of Underwater Instructors",
        "acronym": "NAUI",
        "website": "https://www.naui.org",
        "logo_url": "https://www.naui.org/images/naui-logo.png",
        "description": "NAUI is a non-profit diving organization that provides training and certification for divers and diving professionals.",
        "country": "United States",
        "founded_year": 1960
    },
    {
        "name": "British Sub-Aqua Club",
        "acronym": "BSAC",
        "website": "https://www.bsac.com",
        "logo_url": "https://www.bsac.com/images/bsac-logo.png",
        "description": "BSAC is the UK's leading diving club and the sport's National Governing Body, providing training and support for divers.",
        "country": "United Kingdom",
        "founded_year": 1953
    },
    {
        "name": "Scuba Diving International",
        "acronym": "SDI",
        "website": "https://www.tdisdi.com/sdi",
        "logo_url": "https://www.tdisdi.com/images/sdi-logo.png",
        "description": "SDI is a recreational diving training organization that offers comprehensive diver education programs.",
        "country": "United States",
        "founded_year": 1999
    },
    {
        "name": "International Association of Nitrox and Technical Divers",
        "acronym": "IANTD",
        "website": "https://www.iantd.com",
        "logo_url": "https://www.iantd.com/images/iantd-logo.png",
        "description": "IANTD is a technical diving training organization that specializes in advanced diving techniques and equipment.",
        "country": "United States",
        "founded_year": 1985
    }
]

def populate_diving_organizations():
    """Populate the diving_organizations table with the top 10 diving organizations."""
    db = SessionLocal()
    try:
        # Check if organizations already exist
        existing_count = db.query(DivingOrganization).count()
        if existing_count > 0:
            print(f"⚠️  {existing_count} diving organizations already exist in the database.")
            print("Skipping population to avoid duplicates.")
            return

        print("🚀 Populating diving organizations table...")
        
        for org_data in DIVING_ORGANIZATIONS:
            # Check if organization already exists
            existing_org = db.query(DivingOrganization).filter(
                DivingOrganization.acronym == org_data["acronym"]
            ).first()
            
            if existing_org:
                print(f"⚠️  Organization {org_data['acronym']} already exists, skipping...")
                continue
            
            # Create new organization
            org = DivingOrganization(**org_data)
            db.add(org)
            print(f"✅ Added {org_data['acronym']} - {org_data['name']}")
        
        # Commit all changes
        db.commit()
        print(f"🎉 Successfully populated {len(DIVING_ORGANIZATIONS)} diving organizations!")
        
        # Display summary
        total_orgs = db.query(DivingOrganization).count()
        print(f"📊 Total diving organizations in database: {total_orgs}")
        
    except Exception as e:
        print(f"❌ Error populating diving organizations: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def list_diving_organizations():
    """List all diving organizations in the database."""
    db = SessionLocal()
    try:
        organizations = db.query(DivingOrganization).order_by(DivingOrganization.acronym).all()
        
        if not organizations:
            print("📭 No diving organizations found in the database.")
            return
        
        print(f"📋 Found {len(organizations)} diving organizations:")
        print("-" * 80)
        
        for org in organizations:
            print(f"🔹 {org.acronym} - {org.name}")
            print(f"   Website: {org.website}")
            print(f"   Country: {org.country}")
            print(f"   Founded: {org.founded_year}")
            print()
        
    except Exception as e:
        print(f"❌ Error listing diving organizations: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_diving_organizations()
    else:
        populate_diving_organizations() 