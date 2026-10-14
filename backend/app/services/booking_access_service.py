"""Booking access-control helpers for guest tokens, ownership, and center isolation."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models import (
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoProduct,
    User,
)


def hash_booking_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def mint_booking_access_token(booking: OctoBooking, expires_at: Optional[datetime] = None) -> str:
    raw = secrets.token_urlsafe(32)
    booking.access_token_hash = hash_booking_token(raw)
    booking.access_token_expires_at = expires_at or booking.utc_hold_expiration or (
        _utcnow() + timedelta(minutes=20)
    )
    return raw


def mint_claim_token(unit_item: OctoBookingUnitItem) -> str:
    raw = secrets.token_urlsafe(32)
    unit_item.claim_token_hash = hash_booking_token(raw)
    unit_item.claim_status = "INVITED"
    unit_item.claim_invited_at = _utcnow()
    unit_item.claim_completed_at = None
    return raw


def verify_booking_access(booking: OctoBooking, raw_token: Optional[str]) -> bool:
    if not raw_token or not booking.access_token_hash:
        return False
    if booking.status in ("CANCELLED", "EXPIRED"):
        return False
    if booking.access_token_expires_at:
        exp = booking.access_token_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _utcnow():
            return False
    return secrets.compare_digest(booking.access_token_hash, hash_booking_token(raw_token))


def verify_claim_token(unit_item: OctoBookingUnitItem, raw_token: Optional[str]) -> bool:
    if not raw_token or not unit_item.claim_token_hash:
        return False
    return secrets.compare_digest(unit_item.claim_token_hash, hash_booking_token(raw_token))


def emails_equal(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return False
    return a.strip().lower() == b.strip().lower()


def is_booking_owner(booking: OctoBooking, user: Optional[User]) -> bool:
    if not user:
        return False
    if booking.user_id and booking.user_id == user.id:
        return True
    if (
        getattr(user, "email_verified", False)
        and booking.contact_email
        and user.email
        and emails_equal(booking.contact_email, user.email)
    ):
        return True
    return False


def require_booking_principal(
    booking: OctoBooking,
    current_user: Optional[User],
    access_token: Optional[str],
) -> None:
    """Raise 401/403 unless session owner or valid booking access token."""
    if is_booking_owner(booking, current_user):
        return
    if verify_booking_access(booking, access_token):
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication or valid booking access token required",
    )


def extend_access_token_for_voucher_window(booking: OctoBooking, days: int = 7) -> None:
    """After confirm, keep access token valid for voucher/briefing retrieval."""
    if not booking.access_token_hash:
        return
    base = _utcnow()
    if booking.slot and booking.slot.start_datetime:
        start = booking.slot.start_datetime
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        base = start
    booking.access_token_expires_at = base + timedelta(days=days)


def clear_booking_access_token(booking: OctoBooking) -> None:
    booking.access_token_hash = None
    booking.access_token_expires_at = _utcnow()


def all_participants_paperwork_complete(booking: OctoBooking) -> bool:
    items = list(booking.unit_items or [])
    if not items:
        return False
    for item in items:
        if not item.waivers_complete:
            return False
        if getattr(item, "medical_record", None) is None:
            return False
    return True


def assert_slot_belongs_to_center(
    db: Session,
    slot_id: str,
    center_id: int,
) -> OctoAvailabilitySlot:
    slot = (
        db.query(OctoAvailabilitySlot)
        .options(joinedload(OctoAvailabilitySlot.product))
        .filter(OctoAvailabilitySlot.id == slot_id)
        .first()
    )
    product = slot.product if slot else None
    if not slot or not product or product.diving_center_id != center_id:
        raise HTTPException(status_code=404, detail="Trip availability slot not found")
    return slot


def assert_participant_on_center_trip(
    db: Session,
    participant_id: str,
    trip_id: str,
    center_id: int,
) -> OctoBookingUnitItem:
    assert_slot_belongs_to_center(db, trip_id, center_id)
    item = (
        db.query(OctoBookingUnitItem)
        .options(joinedload(OctoBookingUnitItem.booking))
        .filter(OctoBookingUnitItem.id == participant_id)
        .first()
    )
    if (
        not item
        or not item.booking
        or item.booking.diving_center_id != center_id
        or item.booking.availability_id != trip_id
    ):
        raise HTTPException(status_code=404, detail="Participant not found for this diving center trip")
    return item


def get_physician_certificate_allowed_hosts() -> Tuple[str, ...]:
    raw = os.environ.get(
        "PHYSICIAN_CERTIFICATE_ALLOWED_HOSTS",
        "divemap.blue,www.divemap.blue,uploads.divemap.blue,localhost,127.0.0.1",
    )
    return tuple(h.strip().lower() for h in raw.split(",") if h.strip())


def validate_physician_certificate_url(url: Optional[str]) -> Optional[str]:
    if url is None:
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() != "https":
        raise HTTPException(
            status_code=400,
            detail="Physician certificate URL must use HTTPS",
        )
    host = (parsed.hostname or "").lower()
    allowed = get_physician_certificate_allowed_hosts()
    if host not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Physician certificate URL host is not on the allowlist",
        )
    return cleaned


def extract_access_token(
    header_token: Optional[str] = None,
    query_token: Optional[str] = None,
) -> Optional[str]:
    if header_token and header_token.strip():
        return header_token.strip()
    if query_token and query_token.strip():
        return query_token.strip()
    return None
