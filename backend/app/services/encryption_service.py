import os
import logging
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

class EncryptionError(Exception):
    """Custom exception for encryption/decryption errors."""
    pass

def get_master_key() -> bytes:
    """Get the Master Encryption Key (MEK) from environment variables."""
    key = os.getenv("CHAT_MASTER_KEY")
    if not key:
        raise ValueError("CHAT_MASTER_KEY environment variable is not set")
    return key.encode('utf-8')

def generate_room_dek() -> str:
    """Generate a new random Data Encryption Key (DEK) for a chat room."""
    return Fernet.generate_key().decode('utf-8')

def encrypt_room_dek(plaintext_dek: str) -> str:
    """Encrypt a room's DEK using the Master Encryption Key."""
    try:
        f = Fernet(get_master_key())
        encrypted = f.encrypt(plaintext_dek.encode('utf-8'))
        return encrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to encrypt room DEK: {e}")
        raise EncryptionError("Failed to encrypt room key")

@lru_cache(maxsize=1000)
def decrypt_room_dek(encrypted_dek: str) -> str:
    """
    Decrypt a room's DEK using the Master Encryption Key.
    Cached in-memory to prevent symmetric decryption CPU thrashing.
    """
    try:
        f = Fernet(get_master_key())
        decrypted = f.decrypt(encrypted_dek.encode('utf-8'))
        return decrypted.decode('utf-8')
    except InvalidToken:
        logger.error("Failed to decrypt room DEK: Invalid token")
        raise EncryptionError("Invalid room encryption key")
    except Exception as e:
        logger.error(f"Unexpected error decrypting room DEK: {e}")
        raise EncryptionError("Failed to decrypt room key")

def encrypt_message(plaintext: str, encrypted_dek: str) -> bytes:
    """Encrypt a chat message using the room's DEK."""
    try:
        dek = decrypt_room_dek(encrypted_dek)
        f = Fernet(dek.encode('utf-8'))
        return f.encrypt(plaintext.encode('utf-8'))
    except Exception as e:
        logger.error(f"Failed to encrypt message: {e}")
        raise EncryptionError("Message encryption failed")

def decrypt_message(ciphertext: bytes, encrypted_dek: str) -> str:
    """Decrypt a chat message using the room's DEK."""
    try:
        if not ciphertext:
            return ""
        dek = decrypt_room_dek(encrypted_dek)
        f = Fernet(dek.encode('utf-8'))
        return f.decrypt(ciphertext).decode('utf-8')
    except InvalidToken:
        # Gracefully handle corrupted ciphertexts
        return "[Message unavailable]"
    except Exception as e:
        logger.error(f"Failed to decrypt message: {e}")
        return "[Message unavailable]"
