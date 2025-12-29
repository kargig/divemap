import os
import sys
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, DivingOrganization, CertificationLevel
from app.database import DATABASE_URL

# Setup database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def load_data_from_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def populate_db(data):
    db = SessionLocal()
    try:
        for org_data in data:
            print(f"Processing {org_data['acronym']}...")
            
            # Check or Create Organization
            org = db.query(DivingOrganization).filter(DivingOrganization.acronym == org_data['acronym']).first()
            if not org:
                print(f"Creating organization: {org_data['name']}")
                org = DivingOrganization(
                    name=org_data['name'],
                    acronym=org_data['acronym']
                )
                db.add(org)
                db.commit()
                db.refresh(org)
            else:
                print(f"Organization {org_data['acronym']} exists.")
                # Update name if it changed
                if org.name != org_data['name']:
                    org.name = org_data['name']
                    db.commit()

            # Update Certifications
            for cert_data in org_data['certifications']:
                # Check if exists
                cert = db.query(CertificationLevel).filter(
                    CertificationLevel.diving_organization_id == org.id,
                    CertificationLevel.name == cert_data['name']
                ).first()
                
                if cert:
                    # Update existing
                    cert.category = cert_data.get('category')
                    cert.max_depth = cert_data.get('max_depth')
                    cert.gases = cert_data.get('gases')
                    cert.tanks = cert_data.get('tanks')
                    cert.prerequisites = cert_data.get('prerequisites')
                else:
                    # Create new
                    cert = CertificationLevel(
                        diving_organization_id=org.id,
                        name=cert_data['name'],
                        category=cert_data.get('category'),
                        max_depth=cert_data.get('max_depth'),
                        gases=cert_data.get('gases'),
                        tanks=cert_data.get('tanks'),
                        prerequisites=cert_data.get('prerequisites')
                    )
                    db.add(cert)
            
            db.commit()
            print(f"Updated certifications for {org_data['acronym']}.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    file_path = "backend/diving_certifications_data.json"
    if not os.path.exists(file_path):
        file_path = "docs/diving_certifications_data.json"
    if not os.path.exists(file_path):
        # Fallback for running from backend dir
        file_path = "../docs/diving_certifications_data.json"
    
    if not os.path.exists(file_path):
        print(f"Data file not found at {file_path}")
        sys.exit(1)
        
    print(f"Loading data from {file_path}...")
    data = load_data_from_json(file_path)
    
    print("Populating database...")
    populate_db(data)
    print("Done!")
