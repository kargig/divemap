#!/usr/bin/env python3
"""
Script to generate thumbnails and medium-sized variants for existing photos.

This script scans the database for photos (SiteMedia and DiveMedia) that lack
generated thumbnails/medium variants, processes them, uploads the new sizes to R2,
and updates the database records.

Usage:
    python backend/scripts/generate_thumbnails.py [--dry-run] [--force] [--limit N]

Environment Variables:
    R2_BUCKET_NAME, R2_ACCESS_KEY_ID, etc. must be set (standard backend env).
"""

import os
import sys
import logging
import argparse
import time
from datetime import datetime
from sqlalchemy import or_
from sqlalchemy.orm import Session

# Add backend directory to path to allow imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.database import SessionLocal
from app.models import SiteMedia, DiveMedia, MediaType
from app.services.r2_storage_service import r2_storage
from app.services.image_processing import image_processing

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

def get_timestamp():
    return datetime.now().strftime("%H:%M:%S")

class ThumbnailGenerator:
    def __init__(self, dry_run: bool = False, force: bool = False, limit: int = 0):
        self.dry_run = dry_run
        self.force = force
        self.limit = limit
        self.db = SessionLocal()
        self.processed_count = 0
        self.success_count = 0
        self.fail_count = 0
        self.skip_count = 0

    def process_media_item(self, media_item, media_type_label: str):
        """Process a single media item (SiteMedia or DiveMedia)."""
        media_id = media_item.id
        original_url = media_item.url
        
        # Skip if not a photo
        if isinstance(media_item.media_type, str):
             if media_item.media_type != 'photo':
                 return
        else:
             if media_item.media_type.value != 'photo':
                 return

        # Skip if already has medium_url (unless forced)
        if media_item.medium_url and not self.force:
            self.skip_count += 1
            return

        logger.info(f"[{get_timestamp()}] 🖼️  Processing {media_type_label} ID {media_id}...")

        if self.dry_run:
            logger.info(f"   [DRY RUN] Would process: {original_url}")
            self.success_count += 1
            return

        try:
            # 1. Download Original
            # Extract path from URL if it's a full URL, or use as is if relative/key
            file_path = original_url
            if file_path.startswith('http'):
                # Basic heuristic to get key from URL if possible, or just fail if external
                if 'r2.dev' in file_path or os.getenv('R2_PUBLIC_DOMAIN', 'xxx') in file_path:
                    # Try to extract key? Complex.
                    # For now, assume stored paths are relative keys in DB like "user_1/..."
                    # If it's a full http URL, it might be external (Flickr), which we skip
                    logger.info(f"   ⏭️  Skipping external URL: {original_url}")
                    self.skip_count += 1
                    return
            
            content = r2_storage.download_profile(0, file_path) # user_id 0 as generic, download logic handles it
            if not content:
                logger.error(f"   ❌ Failed to download original: {file_path}")
                self.fail_count += 1
                return

            # 2. Process
            # Use original filename from path
            filename = os.path.basename(file_path)
            
            try:
                # We relax size check for migration as existing files might be large? 
                # No, strict limit is good. If it fails, we log it.
                image_streams = image_processing.process_image(content, filename)
            except Exception as e:
                logger.error(f"   ❌ Image processing failed: {e}")
                self.fail_count += 1
                return

            # 3. Upload Variants
            # We need user_id to construct path. 
            # DiveMedia has dive -> user_id
            # SiteMedia might be admin (no user_id) or have created_by?
            # SiteMedia doesn't have user_id column directly usually.
            # Let's check how upload_photo works. It usually requires user_id.
            
            user_id = 0
            dive_id = None
            dive_site_id = None
            
            if media_type_label == 'DiveMedia':
                # Fetch dive to get user_id
                dive_id = media_item.dive_id
                # accessing relationship might be slow if not loaded, but ok for script
                if media_item.dive:
                    user_id = media_item.dive.user_id
                else:
                    # Fallback logic
                    logger.warning("   ⚠️  Dive relationship missing, assuming admin/system")
                    user_id = 1 
            else:
                # SiteMedia
                dive_site_id = media_item.dive_site_id
                # SiteMedia uploads usually go to admin user or specific structure
                # We need to preserve the existing path structure!
                # The existing path is like "user_{id}/photos/..."
                # We should extract user_id from the existing path if possible
                if 'user_' in file_path:
                    try:
                        parts = file_path.split('/')
                        for part in parts:
                            if part.startswith('user_'):
                                user_id = int(part.split('_')[1])
                                break
                    except:
                        pass
            
            if user_id == 0:
                logger.warning(f"   ⚠️  Could not determine user_id from path {file_path}, skipping upload to avoid misplacement")
                self.fail_count += 1
                return

            # Upload set
            uploaded_paths = r2_storage.upload_photo_set(
                user_id=user_id,
                original_filename=filename,
                image_streams=image_streams,
                dive_id=dive_id,
                dive_site_id=dive_site_id
            )

            # 4. Update Database
            # Helper to generate URL/Path to store
            def get_db_value(path):
                if not path: return None
                return path # We store raw paths in DB for R2

            media_item.medium_url = get_db_value(uploaded_paths.get("medium"))
            media_item.thumbnail_url = get_db_value(uploaded_paths.get("thumbnail"))
            
            # If original was re-encoded/sanitized, we *could* update the main url too
            # But that changes the file extension potentially (jpg -> jpg)
            # Let's keep main URL as is to avoid breaking references, unless we want to enforce sanitization
            # Ideally we update it if the filename changed.
            # For now, update only new columns.
            
            self.db.commit()
            logger.info("   ✅ Success")
            self.success_count += 1

        except Exception as e:
            logger.error(f"   ❌ Unexpected error: {e}")
            self.fail_count += 1

    def run(self):
        logger.info(f"[{get_timestamp()}] 🚀 Starting thumbnail generation (Dry Run: {self.dry_run})...")
        
        # Fetch Media
        # Site Media
        site_media_query = self.db.query(SiteMedia).filter(
            or_(SiteMedia.medium_url.is_(None), SiteMedia.thumbnail_url.is_(None))
        )
        if self.limit > 0:
            site_media_query = site_media_query.limit(self.limit)
        site_media_items = site_media_query.all()
        
        # Dive Media
        dive_media_query = self.db.query(DiveMedia).filter(
            or_(DiveMedia.medium_url.is_(None), DiveMedia.thumbnail_url.is_(None))
        )
        if self.limit > 0:
            remaining_limit = self.limit - len(site_media_items)
            if remaining_limit > 0:
                dive_media_query = dive_media_query.limit(remaining_limit)
            else:
                dive_media_query = None
        
        dive_media_items = dive_media_query.all() if dive_media_query else []
        
        total_items = len(site_media_items) + len(dive_media_items)
        logger.info(f"[{get_timestamp()}] 📊 Found {total_items} items to process")

        # Process Site Media
        for item in site_media_items:
            self.process_media_item(item, 'SiteMedia')
            if self.limit > 0 and (self.success_count + self.fail_count) >= self.limit:
                break

        # Process Dive Media
        for item in dive_media_items:
            if self.limit > 0 and (self.success_count + self.fail_count) >= self.limit:
                break
            self.process_media_item(item, 'DiveMedia')

        logger.info("-" * 40)
        logger.info(f"[{get_timestamp()}] 🎉 Finished")
        logger.info(f"   Success: {self.success_count}")
        logger.info(f"   Skipped: {self.skip_count}")
        logger.info(f"   Failed:  {self.fail_count}")

def main():
    parser = argparse.ArgumentParser(description="Generate thumbnails for existing photos")
    parser.add_argument("--dry-run", action="store_true", help=" Simulate processing")
    parser.add_argument("--force", action="store_true", help="Process even if thumbnails exist")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of items to process")
    
    args = parser.parse_args()
    
    generator = ThumbnailGenerator(dry_run=args.dry_run, force=args.force, limit=args.limit)
    generator.run()

if __name__ == "__main__":
    main()
