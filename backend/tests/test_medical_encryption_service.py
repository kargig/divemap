import os
import pytest
from cryptography.fernet import Fernet
from app.services.booking_medical_encryption_service import (
    BookingMedicalEncryptionService,
    MedicalEncryptionError,
)


def test_roundtrip_encryption_and_decryption(monkeypatch):
    primary_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", primary_key)

    service = BookingMedicalEncryptionService()

    sample_answers = {
        "q1": False,
        "q2": True,
        "details": {"q2_reason": "Mild asthma in childhood, cleared by doctor in 2022"},
    }

    encrypted_dek, encrypted_payload = service.encrypt_answers(sample_answers)

    assert isinstance(encrypted_dek, str)
    assert isinstance(encrypted_payload, bytes)
    # DEK should be different from payload
    assert encrypted_dek.encode() != encrypted_payload

    decrypted = service.decrypt_answers(encrypted_dek, encrypted_payload)
    assert decrypted == sample_answers


def test_multifernet_key_rotation(monkeypatch):
    old_key = Fernet.generate_key().decode()
    new_key = Fernet.generate_key().decode()

    # Initial state: only old key exists
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", old_key)
    service_old = BookingMedicalEncryptionService()

    sample_answers = {"q1": False, "q2": False}
    encrypted_dek, encrypted_payload = service_old.encrypt_answers(sample_answers)

    # Rotation state: new_key is primary, old_key is fallback
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", f"{new_key},{old_key}")
    service_rotating = BookingMedicalEncryptionService()

    # Zero-downtime read: decrypt using fallback key
    decrypted = service_rotating.decrypt_answers(encrypted_dek, encrypted_payload)
    assert decrypted == sample_answers

    # Rotate the DEK to be re-encrypted under the new primary key
    rotated_dek = service_rotating.rotate_dek(encrypted_dek)
    assert rotated_dek != encrypted_dek

    # Post-rotation: drop the old key completely
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", new_key)
    service_new = BookingMedicalEncryptionService()

    # The rotated DEK can now be decrypted with only the new key
    decrypted_after = service_new.decrypt_answers(rotated_dek, encrypted_payload)
    assert decrypted_after == sample_answers

    # But the old unrotated DEK fails with only the new key
    with pytest.raises(MedicalEncryptionError):
        service_new.decrypt_answers(encrypted_dek, encrypted_payload)


def test_missing_master_keys(monkeypatch):
    monkeypatch.delenv("BOOKING_MEDICAL_MASTER_KEYS", raising=False)
    monkeypatch.delenv("BOOKING_MEDICAL_MASTER_KEY", raising=False)
    service = BookingMedicalEncryptionService()

    with pytest.raises(MedicalEncryptionError, match="Missing master encryption keys"):
        service.encrypt_answers({"q1": True})

    with pytest.raises(MedicalEncryptionError, match="Missing master encryption keys"):
        service.decrypt_answers("fake_dek", b"fake_payload")

    with pytest.raises(MedicalEncryptionError, match="Missing master encryption keys"):
        service.rotate_dek("fake_dek")


def test_invalid_tokens_raise_medical_encryption_error(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", key)
    service = BookingMedicalEncryptionService()

    # Invalid DEK string
    with pytest.raises(MedicalEncryptionError):
        service.decrypt_answers("invalid_dek", b"some_bytes")

    # Valid DEK format but invalid payload
    encrypted_dek, _ = service.encrypt_answers({"q1": False})
    with pytest.raises(MedicalEncryptionError):
        service.decrypt_answers(encrypted_dek, b"corrupted_encrypted_payload")


def test_singular_master_key_env_support(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.delenv("BOOKING_MEDICAL_MASTER_KEYS", raising=False)
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEY", key)
    service = BookingMedicalEncryptionService()

    payload = {"clean": True}
    dek, encrypted = service.encrypt_answers(payload)
    decrypted = service.decrypt_answers(dek, encrypted)
    assert decrypted == payload
