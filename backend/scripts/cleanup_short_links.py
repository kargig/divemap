import sys
import os
import logging
from datetime import datetime, timezone

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.database import SessionLocal
from app.models import ShortLink

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("cleanup_short_links")

def cleanup_expired_links():
    """Delete expired short links from the database."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        logger.info(f"Starting cleanup of expired short links at {now}")
        
        # Find expired links
        expired_links_query = db.query(ShortLink).filter(ShortLink.expires_at < now)
        count = expired_links_query.count()
        
        if count > 0:
            # Delete them
            expired_links_query.delete(synchronize_session=False)
            db.commit()
            logger.info(f"Successfully deleted {count} expired short links.")
        else:
            logger.info("No expired short links found.")
            
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_expired_links()
