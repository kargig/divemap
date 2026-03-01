import pytest
from unittest import mock
from cryptography.fernet import Fernet
from app.services.encryption_service import (
    generate_room_dek,
    encrypt_room_dek,
    decrypt_room_dek,
    encrypt_message,
    decrypt_message,
    EncryptionError
)

# A fixed dummy master key for testing
DUMMY_MASTER_KEY = Fernet.generate_key().decode('utf-8')

@pytest.fixture(autouse=True)
def mock_env_master_key():
    with mock.patch("os.getenv", return_value=DUMMY_MASTER_KEY):
        # Clear the lru_cache between tests just in case
        decrypt_room_dek.cache_clear()
        yield

def test_generate_room_dek():
    dek1 = generate_room_dek()
    dek2 = generate_room_dek()
    assert dek1 != dek2
    assert isinstance(dek1, str)
    # Ensure it's a valid fernet key
    Fernet(dek1.encode('utf-8'))

def test_encrypt_and_decrypt_room_dek():
    original_dek = generate_room_dek()
    
    # Encrypt it
    encrypted_dek = encrypt_room_dek(original_dek)
    assert encrypted_dek != original_dek
    assert isinstance(encrypted_dek, str)
    
    # Decrypt it
    decrypted_dek = decrypt_room_dek(encrypted_dek)
    assert decrypted_dek == original_dek

def test_decrypt_room_dek_caching():
    original_dek = generate_room_dek()
    encrypted_dek = encrypt_room_dek(original_dek)
    
    # First call - cache miss
    res1 = decrypt_room_dek(encrypted_dek)
    
    # Change the master key (which would normally cause decryption to fail)
    # But because of LRU cache, it should return the cached plaintext key
    with mock.patch("os.getenv", return_value=Fernet.generate_key().decode('utf-8')):
        res2 = decrypt_room_dek(encrypted_dek)
        
    assert res1 == original_dek
    assert res2 == original_dek

def test_decrypt_room_dek_invalid_token():
    with pytest.raises(EncryptionError, match="Invalid room encryption key"):
        decrypt_room_dek("invalid-token-string")

def test_encrypt_and_decrypt_message():
    dek = generate_room_dek()
    encrypted_dek = encrypt_room_dek(dek)
    
    plaintext = "Hello, secret world!"
    
    # Encrypt message
    ciphertext = encrypt_message(plaintext, encrypted_dek)
    assert isinstance(ciphertext, bytes)
    assert ciphertext != plaintext.encode('utf-8')
    
    # Decrypt message
    decrypted = decrypt_message(ciphertext, encrypted_dek)
    assert decrypted == plaintext

def test_decrypt_message_invalid_token():
    dek = generate_room_dek()
    encrypted_dek = encrypt_room_dek(dek)
    
    # Attempt to decrypt corrupted ciphertext
    corrupted_ciphertext = b"gAAAAAB...invalid...data"
    result = decrypt_message(corrupted_ciphertext, encrypted_dek)
    
    # Should fail gracefully
    assert result == "[Message unavailable]"

def test_decrypt_message_empty():
    dek = generate_room_dek()
    encrypted_dek = encrypt_room_dek(dek)
    
    assert decrypt_message(b"", encrypted_dek) == ""
    assert decrypt_message(None, encrypted_dek) == ""
