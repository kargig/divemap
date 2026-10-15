import logging

import orjson
from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuthAuditLog, User

logger = logging.getLogger("medical_audit")


def log_medical_access(
    db: Session,
    action: str,
    access_status: str,  # "SUCCESS" or "DENIED"
    reason: str | None = None,
    request: Request | None = None,
    accessor_user: User | None = None,
    target_diver_user_id: int | None = None,
    target_diver_name: str | None = None,
    participant_id: str | None = None,
    diving_center_id: int | None = None,
    trip_id: str | None = None,
    booking_uuid: str | None = None,
) -> AuthAuditLog | None:
    """
    Creates an audit log entry in the existing AuthAuditLog table for any attempt
    (successful or denied) to inspect, view, export, or mutate a user's medical questionnaire.
    Visible directly in the Admin Audit Logs dashboard (/admin/audit-logs).

    Guest/anonymous accessors use user_id=NULL (never invent user_id=1).
    """
    ip_address = None
    user_agent = None
    if request:
        client = getattr(request, "client", None)
        ip_address = client.host if client else None
        headers = getattr(request, "headers", {})
        user_agent = headers.get("user-agent")

    accessor_id = accessor_user.id if accessor_user else None
    accessor_name = accessor_user.username if accessor_user else "guest"
    accessor_role = (
        "admin"
        if (accessor_user and accessor_user.is_admin)
        else ("user" if accessor_user else "guest")
    )

    # Normalize action name to snake_case matching auth audit log conventions
    normalized_action = action.lower()
    if not normalized_action.startswith("medical_"):
        normalized_action = f"medical_{normalized_action}"

    details_payload = {
        "event_type": "MEDICAL_SCREENING_AUDIT",
        "accessor_username": accessor_name,
        "accessor_role": accessor_role,
        "target_diver_user_id": target_diver_user_id,
        "target_diver_name": target_diver_name,
        "participant_id": participant_id,
        "diving_center_id": diving_center_id,
        "trip_id": trip_id,
        "booking_uuid": booking_uuid,
        "status": access_status,
        "reason": reason,
    }

    log_entry = AuthAuditLog(
        user_id=accessor_id,
        action=normalized_action,
        ip_address=ip_address,
        user_agent=user_agent,
        success=(access_status == "SUCCESS"),
        details=orjson.dumps(details_payload).decode("utf-8"),
    )
    db.add(log_entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist medical audit log: {e}")

    # Structured application log — IDs only (avoid PII names in app logs)
    log_msg = (
        f"[MEDICAL_ACCESS_AUDIT] status={access_status} action={normalized_action} "
        f"accessor_id={accessor_id} role={accessor_role} "
        f"target_diver_user_id={target_diver_user_id} participant_id={participant_id} "
        f"booking_uuid={booking_uuid} center_id={diving_center_id} trip_id={trip_id} "
        f"ip={ip_address} reason='{reason}'"
    )
    if access_status == "SUCCESS":
        logger.info(log_msg)
    else:
        logger.warning(log_msg)

    return log_entry
