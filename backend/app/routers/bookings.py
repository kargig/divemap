import hashlib
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user_optional, get_current_user
from app.models import (
    User,
    UserGearProfile,
    UserCertification,
    DivingCenter,
    DivingCenterBookingSettings,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    DiverMedicalRecord,
)
from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
from app.services.waiver_service import WaiverService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bookings", tags=["Diver Bookings & Checkout"])

# --- Schemas ---

class SubmitPaperworkRequest(BaseModel):
    unitItemId: str
    dmscAnswers: Dict[str, Any]
    signatureName: str
    selectedTankId: Optional[str] = "12"
    selectedGasMixId: Optional[str] = "air"
    equipmentSizing: Optional[Dict[str, Any]] = None

class SubmitPaperworkResponse(BaseModel):
    bookingUuid: str
    status: str
    medicalStatus: str
    waiversComplete: bool

class BookingVoucherUnitItem(BaseModel):
    diverFullName: str
    unitTitle: str
    selectedTankId: str
    selectedGasMixId: str
    equipmentSizing: Optional[Dict[str, Any]] = None

class BookingVoucherResponse(BaseModel):
    bookingUuid: str
    status: str
    paymentStatus: str
    paymentMode: str
    totalAmount: float
    currency: str
    productTitle: str
    centerName: str
    centerAddress: Optional[str] = None
    centerPhone: Optional[str] = None
    departureDate: str
    meetingTime: str
    departureTime: str
    meetingInstructions: Optional[str] = None
    qrCodeData: str
    unitItems: List[BookingVoucherUnitItem] = []


# --- Endpoints ---

@router.get("/checkout-context/{slot_id}")
def get_checkout_context(
    slot_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Provides slot details, auto-fill gear profile, and medical questionnaire schemas for checkout."""
    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == slot_id).first()
    if not slot or slot.is_closed:
        raise HTTPException(status_code=404, detail="Availability slot not found or closed")

    product = slot.product
    center = product.center

    # Pull user's primary/default gear profile if authenticated
    prefill_gear = None
    user_certifications = []
    if current_user:
        gear_prof = db.query(UserGearProfile).filter(
            UserGearProfile.user_id == current_user.id,
            UserGearProfile.is_default == True
        ).first()
        if not gear_prof:
            gear_prof = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()

        if gear_prof:
            prefill_gear = {
                "name": gear_prof.name,
                "preferred_unit_system": gear_prof.preferred_unit_system,
                "preferred_shoe_system": gear_prof.preferred_shoe_system,
                "height_cm": gear_prof.height_cm,
                "weight_kg": float(gear_prof.weight_kg) if gear_prof.weight_kg else None,
                "shoe_size_eu": float(gear_prof.shoe_size_eu) if gear_prof.shoe_size_eu else None,
                "wetsuit_gender": gear_prof.wetsuit_gender,
                "wetsuit_size": gear_prof.wetsuit_size,
                "wetsuit_thickness": gear_prof.wetsuit_thickness,
                "bcd_size": gear_prof.bcd_size,
                "fin_type": gear_prof.fin_type,
                "regulator_fitting": gear_prof.regulator_fitting,
                "preferred_tank_id": gear_prof.preferred_tank_id,
                "preferred_gas_mix_id": gear_prof.preferred_gas_mix_id,
                "estimated_lead_kg": float(gear_prof.estimated_lead_kg) if gear_prof.estimated_lead_kg else None,
                "has_own_dive_computer": gear_prof.has_own_dive_computer,
                "has_own_smb": gear_prof.has_own_smb,
                "insurance_provider": gear_prof.insurance_provider,
                "insurance_policy_number": gear_prof.insurance_policy_number,
            }

        certs = db.query(UserCertification).filter(UserCertification.user_id == current_user.id).all()
        for c in certs:
            org_name = c.diving_organization.name if c.diving_organization else "PADI"
            user_certifications.append({
                "agency": org_name,
                "level": c.certification_level,
                "number": getattr(c, "certification_number", None) or "",
            })

    waiver_svc = WaiverService()
    dmsc_schema = waiver_svc.get_questionnaire_schema("dmsc_2020_medical")

    return {
        "slot": {
            "id": slot.id,
            "start_datetime": slot.start_datetime.isoformat(),
            "end_datetime": slot.end_datetime.isoformat(),
            "seats_available": slot.seats_available,
        },
        "product": {
            "id": product.id,
            "title": product.title,
            "description": product.description,
            "product_type": product.product_type,
            "waiver_bundle_id": product.waiver_bundle_id,
        },
        "option": {
            "id": slot.option.id,
            "title": slot.option.title,
            "meeting_time": slot.option.meeting_time.strftime("%H:%M"),
            "departure_time": slot.option.departure_time.strftime("%H:%M"),
        },
        "units": [
            {
                "id": u.id,
                "type": u.unit_type,
                "title": u.title,
                "retail_price": float(u.retail_price),
                "currency": u.currency,
            } for u in product.units if u.is_active
        ],
        "center": {
            "id": center.id,
            "name": center.name,
            "phone": center.phone,
            "email": center.email,
        },
        "prefill_gear": prefill_gear,
        "user_certifications": user_certifications,
        "dmsc_schema": dmsc_schema,
    }


@router.post("/{booking_uuid}/submit-paperwork", response_model=SubmitPaperworkResponse)
def submit_diver_paperwork(
    booking_uuid: str,
    req: SubmitPaperworkRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Evaluates medical responses, encrypts medical records at rest, marks waivers complete, and confirms booking."""
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    unit_item = db.query(OctoBookingUnitItem).filter(
        OctoBookingUnitItem.id == req.unitItemId,
        OctoBookingUnitItem.booking_uuid == booking.uuid
    ).first()
    if not unit_item:
        raise HTTPException(status_code=404, detail="Booking participant item not found")

    # 1. Medical Evaluation & Envelope Encryption
    waiver_svc = WaiverService()
    medical_status = waiver_svc.evaluate_dmsc_medical(req.dmscAnswers)

    encryption_svc = BookingMedicalEncryptionService()
    enc_dek, enc_answers = encryption_svc.encrypt_answers(req.dmscAnswers)

    # Audit signature hash (SHA-256 of submission envelope)
    audit_str = f"{booking.uuid}:{unit_item.id}:{req.signatureName}:{datetime.now(timezone.utc).isoformat()}"
    audit_hash = hashlib.sha256(audit_str.encode('utf-8')).hexdigest()

    existing_med = db.query(DiverMedicalRecord).filter(
        DiverMedicalRecord.booking_unit_item_id == unit_item.id
    ).first()

    if existing_med:
        existing_med.status = medical_status
        existing_med.encrypted_dek = enc_dek
        existing_med.encrypted_answers = enc_answers
        existing_med.audit_signature_hash = audit_hash
    else:
        med_rec = DiverMedicalRecord(
            booking_unit_item_id=unit_item.id,
            user_id=current_user.id if current_user else None,
            status=medical_status,
            encrypted_dek=enc_dek,
            encrypted_answers=enc_answers,
            expires_at=datetime.now(timezone.utc) + timedelta(days=365),
            audit_signature_hash=audit_hash,
        )
        db.add(med_rec)

    # 2. Update unit item with gear sizing and waiver completion
    unit_item.selected_tank_id = req.selectedTankId or "12"
    unit_item.selected_gas_mix_id = req.selectedGasMixId or "air"
    if req.equipmentSizing:
        unit_item.equipmentSizing = req.equipmentSizing
    unit_item.waivers_complete = True
    unit_item.signed_at = datetime.now(timezone.utc)

    # 3. Transition booking status
    booking.status = "CONFIRMED"
    booking.payment_status = "PENDING_AT_CHECKIN"
    booking.utc_hold_expiration = None

    db.commit()
    db.refresh(booking)

    return SubmitPaperworkResponse(
        bookingUuid=booking.uuid,
        status=booking.status,
        medicalStatus=medical_status,
        waiversComplete=True,
    )


@router.get("/{booking_uuid}/voucher", response_model=BookingVoucherResponse)
def get_booking_voucher(booking_uuid: str, db: Session = Depends(get_db)):
    """Returns printable voucher details and digital QR-code verification token."""
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    product = booking.product
    center = booking.center
    option = booking.option
    slot = booking.slot

    qr_payload = f"DIVEMAP:BOOKING:{booking.uuid}:{center.id}"

    unit_items_res = [
        BookingVoucherUnitItem(
            diverFullName=item.diver_full_name,
            unitTitle=item.unit.title if item.unit else "Diver Slot",
            selectedTankId=item.selected_tank_id or "12",
            selectedGasMixId=item.selected_gas_mix_id or "air",
            equipmentSizing=item.equipment_sizing,
        ) for item in booking.unit_items
    ]

    return BookingVoucherResponse(
        bookingUuid=booking.uuid,
        status=booking.status,
        paymentStatus=booking.payment_status,
        paymentMode=booking.payment_mode,
        totalAmount=float(booking.total_amount),
        currency=booking.currency,
        productTitle=product.title,
        centerName=center.name,
        centerAddress=getattr(center, "address", None) or f"{center.latitude}, {center.longitude}",
        centerPhone=center.phone,
        departureDate=slot.start_datetime.strftime("%Y-%m-%d"),
        meetingTime=option.meeting_time.strftime("%H:%M"),
        departureTime=option.departure_time.strftime("%H:%M"),
        meetingInstructions=getattr(center, "meeting_instructions", None) or "Please arrive 15 minutes before meeting time.",
        qrCodeData=qr_payload,
        unitItems=unit_items_res,
    )
