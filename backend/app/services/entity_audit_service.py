import logging
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import EntityAuditLog, User

logger = logging.getLogger(__name__)

SENSITIVE_FIELD_DENYLIST: set[str] = {
    "password",
    "password_hash",
    "token",
    "token_hash",
    "key_hash",
    "secret",
    "api_key",
    "api_key_value",
    "smtp_password",
    "card_token",
    "access_token",
    "refresh_token",
    "claim_token",
    "turnstile_secret",
}


def _is_sensitive_key(key: str | None) -> bool:
    """Return True when a dict/field key names a secret or credential."""
    if not isinstance(key, str):
        return False
    normalized = key.lower()
    return (
        normalized in SENSITIVE_FIELD_DENYLIST
        or "password" in normalized
        or "secret" in normalized
        or "token" in normalized
        or normalized.endswith("_hash")
        or normalized.endswith("_key")
    )


def _normalize_audit_value(value: Any) -> Any:
    """Coerce ORM/Python values into JSON-friendly forms for snapshots/diffs."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def snapshot_orm_fields(obj: Any, field_names: list[str] | set[str]) -> dict[str, Any]:
    """
    Snapshot selected attributes from an ORM instance for before/after audit diffs.
    Only includes fields that exist on the object.
    """
    snapshot: dict[str, Any] = {}
    for name in field_names:
        if hasattr(obj, name):
            snapshot[name] = _normalize_audit_value(getattr(obj, name))
    return snapshot


def _sanitize_value(key: str, value: Any) -> Any:
    """Mask sensitive fields or recursively sanitize nested dictionaries/lists."""
    if _is_sensitive_key(key):
        return "[REDACTED]"

    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)

    if isinstance(value, dict):
        return _sanitize_dict(value)
    if isinstance(value, list):
        return [_sanitize_value(key, item) for item in value]
    return value


def _sanitize_dict(d: dict[str, Any] | None) -> dict[str, Any] | None:
    """Recursively sanitize a dictionary by redacting sensitive values."""
    if d is None:
        return None
    sanitized: dict[str, Any] = {}
    for k, v in d.items():
        sanitized[k] = _sanitize_value(k, v)

    # Settings-shaped payloads store the setting name in "key" and the secret in "value".
    setting_name = d.get("key")
    if isinstance(setting_name, str) and _is_sensitive_key(setting_name):
        sanitized["value"] = "[REDACTED]"

    return sanitized


def _extract_ip(request: Request | None) -> str | None:
    """Extract client IP address handling proxies using project utility."""
    if not request:
        return None
    try:
        from app.utils import get_client_ip

        ip = get_client_ip(request)
        return ip if ip and ip != "-" else None
    except Exception:
        headers = getattr(request, "headers", {})
        x_forwarded_for = headers.get("x-forwarded-for")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        client = getattr(request, "client", None)
        return client.host if client else None


def _extract_user_agent(request: Request | None) -> str | None:
    """Extract client User-Agent string, truncated to 500 characters to prevent table bloat."""
    if not request:
        return None
    headers = getattr(request, "headers", {})
    ua = headers.get("user-agent")
    if ua:
        return ua[:500]
    return None


def _infer_client_type(request: Request | None, auth_method: str) -> str:
    """
    Infer client type from headers and authentication method.
    Returns: 'web', 'android_app', 'api_client', or 'system'.
    """
    if not request:
        return "system"

    headers = getattr(request, "headers", {})
    user_agent = (headers.get("user-agent") or "").lower()
    x_requested_with = (headers.get("x-requested-with") or "").lower()

    if "com.divemap.twa" in x_requested_with or "divemapapp" in user_agent:
        return "android_app"

    if auth_method == "pat":
        return "api_client"

    api_indicators = (
        "curl",
        "python-requests",
        "postman",
        "httpie",
        "axios",
        "aiohttp",
        "urllib",
    )
    if any(indicator in user_agent for indicator in api_indicators):
        return "api_client"

    return "web"


def _are_values_equal(val1: Any, val2: Any) -> bool:
    """Compare two values handling type coercion (Decimal vs float, Date vs str, etc.)."""
    if val1 is val2:
        return True
    if val1 is None or val2 is None:
        return val1 is val2

    # Handle Decimal and numeric comparison
    if isinstance(val1, Decimal):
        val1 = float(val1)
    if isinstance(val2, Decimal):
        val2 = float(val2)

    if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
        # Handle float precision tolerance
        if isinstance(val1, float) or isinstance(val2, float):
            return abs(float(val1) - float(val2)) < 1e-7
        return val1 == val2

    # Handle dates/datetimes/UUIDs vs string representations
    if isinstance(val1, Enum):
        val1 = val1.value
    if isinstance(val2, Enum):
        val2 = val2.value

    if isinstance(val1, (datetime, date, time)):
        val1 = val1.isoformat()
    if isinstance(val2, (datetime, date, time)):
        val2 = val2.isoformat()

    if isinstance(val1, uuid.UUID):
        val1 = str(val1)
    if isinstance(val2, uuid.UUID):
        val2 = str(val2)

    return val1 == val2


def _calculate_diff(
    action: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
) -> dict[str, Any]:
    """Calculate structured change payload for entity lifecycle actions."""
    sanitized_before = _sanitize_dict(before)
    sanitized_after = _sanitize_dict(after)
    sanitized_meta = _sanitize_dict(metadata) or {}

    if action == "create":
        payload = {"snapshot": sanitized_after}
        payload.update(sanitized_meta)
        return payload

    if action in ("delete", "hard_delete", "soft_delete"):
        payload = {"snapshot": sanitized_before}
        payload.update(sanitized_meta)
        return payload

    # update and other before/after actions (approve, confirm, ownership_*, etc.)
    if before is not None or after is not None:
        if before is not None and after is not None:
            changed_fields = []
            before_diff = {}
            after_diff = {}

            raw_before = before or {}
            raw_after = after or {}
            before_safe = sanitized_before or {}
            after_safe = sanitized_after or {}

            all_keys = set(raw_before.keys()) | set(raw_after.keys())
            for k in sorted(all_keys):
                val_before = raw_before.get(k)
                val_after = raw_after.get(k)
                if not _are_values_equal(val_before, val_after):
                    changed_fields.append(k)
                    if k in raw_before:
                        before_diff[k] = before_safe.get(k)
                    if k in raw_after:
                        after_diff[k] = after_safe.get(k)

            payload = {
                "changed_fields": changed_fields,
                "before": before_diff,
                "after": after_diff,
            }
            payload.update(sanitized_meta)
            return payload

        payload = {"snapshot": sanitized_after or sanitized_before}
        payload.update(sanitized_meta)
        return payload

    payload = {"snapshot": sanitized_after or sanitized_before}
    payload.update(sanitized_meta)
    return payload


def log_entity_mutation(
    db: Session,
    entity_type: str,
    entity_id: int | str,
    action: str,
    user: User | None,
    request: Request | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> EntityAuditLog:
    """
    Constructs and persists an EntityAuditLog row within the caller's database session.
    Participates atomically in the active transaction.
    """
    auth_method = "system"
    pat_id = None
    pat_name = None

    if request and hasattr(request, "state"):
        auth_method = getattr(
            request.state, "auth_method", ("jwt" if user else "guest")
        )
        pat_id = getattr(request.state, "pat_id", None)
        pat_name = getattr(request.state, "pat_name", None)
    elif user:
        auth_method = "jwt"

    user_role = None
    if user:
        if getattr(user, "is_admin", False):
            user_role = "admin"
        elif getattr(user, "is_moderator", False):
            user_role = "moderator"
        else:
            user_role = "user"
    elif auth_method == "guest":
        user_role = "guest"

    client_type = _infer_client_type(request, auth_method)
    ip_address = _extract_ip(request)
    user_agent = _extract_user_agent(request)
    changes = _calculate_diff(action, before_state, after_state, metadata)

    log_entry = EntityAuditLog(
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        user_id=user.id if user else None,
        user_role=user_role,
        auth_method=auth_method,
        pat_id=pat_id,
        pat_name=pat_name,
        ip_address=ip_address,
        user_agent=user_agent,
        client_type=client_type,
        changes=changes,
    )

    db.add(log_entry)
    return log_entry
