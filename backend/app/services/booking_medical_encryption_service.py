import logging
import os
from typing import Any

import orjson
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

logger = logging.getLogger(__name__)


class MedicalEncryptionError(Exception):
    """Raised when encryption, decryption, or key rotation of sensitive medical data fails."""

    pass


class BookingMedicalEncryptionService:
    def __init__(self, master_keys: list[str] | None = None):
        self._explicit_keys = master_keys

    def _get_fernets(self) -> MultiFernet:
        if self._explicit_keys is not None:
            keys = self._explicit_keys
        else:
            raw_keys = (
                os.environ.get("BOOKING_MEDICAL_MASTER_KEYS")
                or os.environ.get("BOOKING_MEDICAL_MASTER_KEY", "")
            ).strip()
            if not raw_keys:
                raise MedicalEncryptionError(
                    "Missing master encryption keys in environment (BOOKING_MEDICAL_MASTER_KEYS)"
                )
            keys = [k.strip() for k in raw_keys.split(",") if k.strip()]

        if not keys:
            raise MedicalEncryptionError(
                "Missing master encryption keys in environment (BOOKING_MEDICAL_MASTER_KEYS)"
            )

        try:
            return MultiFernet(
                [Fernet(k.encode("utf-8") if isinstance(k, str) else k) for k in keys]
            )
        except Exception as e:
            logger.error(f"Failed to initialize MultiFernet keys: {e}")
            raise MedicalEncryptionError(
                f"Invalid master encryption key configuration: {e}"
            )

    def encrypt_answers(self, answers: dict[str, Any]) -> tuple[str, bytes]:
        multi_fernet = self._get_fernets()
        try:
            dek = Fernet.generate_key()
            data_fernet = Fernet(dek)

            payload_bytes = orjson.dumps(answers)
            encrypted_payload = data_fernet.encrypt(payload_bytes)

            encrypted_dek = multi_fernet.encrypt(dek).decode("utf-8")
            return encrypted_dek, encrypted_payload
        except Exception as e:
            logger.error(f"Failed to encrypt medical record: {e}")
            raise MedicalEncryptionError(f"Medical data encryption failed: {str(e)}")

    def decrypt_answers(
        self, encrypted_dek: str, encrypted_payload: bytes
    ) -> dict[str, Any]:
        multi_fernet = self._get_fernets()
        try:
            dek = multi_fernet.decrypt(encrypted_dek.encode("utf-8"))
            data_fernet = Fernet(dek)

            decrypted_bytes = data_fernet.decrypt(encrypted_payload)
            return orjson.loads(decrypted_bytes)
        except InvalidToken:
            logger.warning(
                "Invalid token when decrypting medical record DEK or payload"
            )
            raise MedicalEncryptionError(
                "Invalid decryption key or corrupted medical ciphertext"
            )
        except MedicalEncryptionError:
            raise
        except Exception as e:
            logger.error(f"Failed to decrypt medical record: {e}")
            raise MedicalEncryptionError(f"Medical data decryption failed: {str(e)}")

    def rotate_dek(self, encrypted_dek: str) -> str:
        multi_fernet = self._get_fernets()
        try:
            return multi_fernet.rotate(encrypted_dek.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            logger.warning("Invalid token during DEK rotation")
            raise MedicalEncryptionError("Invalid token during DEK rotation")
        except MedicalEncryptionError:
            raise
        except Exception as e:
            logger.error(f"Failed to rotate encrypted DEK: {e}")
            raise MedicalEncryptionError(f"DEK rotation failed: {str(e)}")
