import sys
import os
import argparse

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, DiveSite, Dive

def transfer_data(source_username, target_username, dry_run=False, claim_unowned_sites=False, transfer_sites=False, transfer_dives=False):
    db = SessionLocal()
    try:
        target_user = db.query(User).filter(User.username == target_username).first()
        if not target_user:
            print(f"❌ Error: Target user '{target_username}' not found.")
            return
        
        print(f"👤 Target User: {target_user.username} (ID: {target_user.id})")

        source_user = None
        if source_username:
            source_user = db.query(User).filter(User.username == source_username).first()
            if not source_user:
                print(f"❌ Error: Source user '{source_username}' not found.")
                return
            print(f"👤 Source User: {source_user.username} (ID: {source_user.id})")

        # --- 1. DIVE SITES ---
        if transfer_sites or claim_unowned_sites:
            print("\n--- Processing Dive Sites ---")
            sites_to_update = []

            if transfer_sites and source_user:
                user_sites = db.query(DiveSite).filter(DiveSite.created_by == source_user.id).all()
                if user_sites:
                    print(f"🔍 Found {len(user_sites)} dive sites owned by '{source_username}'.")
                    sites_to_update.extend(user_sites)
                else:
                    print(f"ℹ️ No dive sites found for user '{source_username}'.")

            if claim_unowned_sites:
                unowned_sites = db.query(DiveSite).filter(DiveSite.created_by == None).all()
                if unowned_sites:
                    print(f"🔍 Found {len(unowned_sites)} unowned dive sites.")
                    sites_to_update.extend(unowned_sites)
                else:
                    print("ℹ️ No unowned dive sites found.")

            if sites_to_update:
                for ds in sites_to_update:
                    old_owner_id = ds.created_by
                    if not dry_run:
                        ds.created_by = target_user.id
                    owner_label = f"User ID {old_owner_id}" if old_owner_id else "UNOWNED"
                    print(f"  - {'[WOULD TRANSFER SITE]' if dry_run else '[TRANSFERRED SITE]'} '{ds.name}' (ID: {ds.id}) [From: {owner_label}]")
            else:
                print("ℹ️ No dive sites to transfer.")

        # --- 2. DIVES (Logbook entries) ---
        if transfer_dives:
            print("\n--- Processing Dives (Logbook Entries) ---")
            if not source_user:
                print("❌ Error: --source user is required to transfer dives.")
            else:
                dives_to_update = db.query(Dive).filter(Dive.user_id == source_user.id).all()
                if dives_to_update:
                    print(f"🔍 Found {len(dives_to_update)} dives owned by '{source_username}'.")
                    for dive in dives_to_update:
                        if not dry_run:
                            dive.user_id = target_user.id
                        site_name = dive.dive_site.name if dive.dive_site else "Unknown Site"
                        print(f"  - {'[WOULD TRANSFER DIVE]' if dry_run else '[TRANSFERRED DIVE]'} ID: {dive.id} (Date: {dive.dive_date}, Site: {site_name})")
                else:
                    print(f"ℹ️ No dives found for user '{source_username}'.")

        # --- Commit ---
        if not dry_run:
            db.commit()
            print("\n✅ Successfully committed changes to database.")
        else:
            print("\nℹ️ Dry run complete. No changes made.")

    except Exception as e:
        print(f"\n💥 An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transfer data (sites/dives) between users.")
    parser.add_argument("target", help="Username of the new owner")
    parser.add_argument("--source", help="Username of the current owner")
    parser.add_argument("--transfer-sites", action="store_true", help="Transfer dive site ownership")
    parser.add_argument("--transfer-dives", action="store_true", help="Transfer logbook dives")
    parser.add_argument("--claim-unowned", action="store_true", help="Include sites with no owner (created_by is NULL)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without making changes")
    
    args = parser.parse_args()
    
    if not args.transfer_sites and not args.transfer_dives and not args.claim_unowned:
        print("❌ Error: You must specify at least one action: --transfer-sites, --transfer-dives, or --claim-unowned")
        sys.exit(1)

    transfer_data(
        args.source, 
        args.target, 
        args.dry_run, 
        args.claim_unowned, 
        args.transfer_sites, 
        args.transfer_dives
    )