import sys
import os
import logging
import argparse
from cryptography.fernet import Fernet, InvalidToken

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.database import SessionLocal
from app.models import UserChatRoom

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("rotate_chat_master_key")

def rotate_keys(old_mek_str: str, new_mek_str: str):
    """
    Decrypt all room DEKs with old MEK and re-encrypt with new MEK.
    """
    db = SessionLocal()
    try:
        old_f = Fernet(old_mek_str.encode('utf-8'))
        new_f = Fernet(new_mek_str.encode('utf-8'))
        
        rooms = db.query(UserChatRoom).all()
        logger.info(f"Found {len(rooms)} chat rooms to process.")
        
        updated_count = 0
        failed_count = 0
        
        for room in rooms:
            try:
                # Decrypt DEK with old MEK
                plaintext_dek = old_f.decrypt(room.encrypted_dek.encode('utf-8'))
                
                # Re-encrypt with new MEK
                new_encrypted_dek = new_f.encrypt(plaintext_dek)
                
                # Update room
                room.encrypted_dek = new_encrypted_dek.decode('utf-8')
                updated_count += 1
                
                if updated_count % 10 == 0:
                    logger.info(f"Processed {updated_count} rooms...")
                    
            except InvalidToken:
                logger.error(f"Failed to decrypt DEK for room {room.id}: Invalid old MEK or corrupted data.")
                failed_count += 1
            except Exception as e:
                logger.error(f"Unexpected error for room {room.id}: {e}")
                failed_count += 1
        
        if updated_count > 0:
            db.commit()
            logger.info(f"Successfully rotated keys for {updated_count} rooms.")
        
        if failed_count > 0:
            logger.warning(f"Failed to process {failed_count} rooms.")
            
    except Exception as e:
        logger.error(f"Critical error during rotation: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rotate Chat Master Encryption Key (MEK)")
    parser.add_argument("--old-key", help="The old CHAT_MASTER_KEY")
    
    args = parser.parse_args()
    
    old_key = args.old_key or os.getenv("OLD_CHAT_MASTER_KEY")
    new_key = os.getenv("CHAT_MASTER_KEY")
    
    if not old_key:
        logger.error("Missing old CHAT_MASTER_KEY. Provide it via --old-key or OLD_CHAT_MASTER_KEY env var.")
        sys.exit(1)
        
    if not new_key:
        logger.error("Missing new CHAT_MASTER_KEY in environment (CHAT_MASTER_KEY).")
        sys.exit(1)
        
    if old_key == new_key:
        logger.error("Old key and new key are identical. No rotation needed.")
        sys.exit(0)
        
    logger.info("Starting Chat MEK rotation...")
    rotate_keys(old_key, new_key)
    logger.info("Rotation completed.")
