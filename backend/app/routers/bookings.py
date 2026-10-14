import hashlib
import logging
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

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
    TripBriefing,
    UserMedicalProfile,
    CenterDiverMedicalApproval,
)
from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
from app.services.waiver_service import WaiverService
from app.services.briefing_service import BriefingService
from app.services.nitrox_service import check_nitrox_eligibility
from app.services.booking_pricing_service import compute_participant_octo_pricing
from app.services.medical_audit_service import log_medical_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bookings", tags=["Diver Bookings & Checkout"])

def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# --- Schemas ---

class SubmitPaperworkRequest(BaseModel):
    unitItemId: str
    dmscAnswers: Optional[Dict[str, Any]] = None
    signatureName: str
    selectedTankId: Optional[str] = "12"
    selectedGasMixId: Optional[str] = "air"
    equipmentSizing: Optional[Dict[str, Any]] = None
    useAnnualMedical: bool = False
    confirmNoMedicalChange: bool = False

class SaveAnnualMedicalRequest(BaseModel):
    dmscAnswers: Dict[str, Any]
    signatureName: str
    physicianCertificateUrl: Optional[str] = None

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
    vesselName: Optional[str] = None
    vesselRegistration: Optional[str] = None
    vesselCapacity: Optional[int] = None
    departureDate: str
    meetingTime: str
    departureTime: str
    meetingInstructions: Optional[str] = None
    qrCodeData: str
    unitItems: List[BookingVoucherUnitItem] = []

class MyBookingItemResponse(BaseModel):
    bookingUuid: str
    reference: str
    status: str
    paymentStatus: str
    paymentMode: str
    totalAmount: float
    currency: str
    tripDate: Optional[str] = None
    centerId: int
    centerName: str
    slotId: str
    tripId: Optional[int] = None
    participantsCount: int
    hasBriefing: bool


# --- Endpoints ---

@router.get("/my-bookings", response_model=List[MyBookingItemResponse])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    email_cond = (
        and_(
            OctoBooking.contact_email.isnot(None),
            func.lower(OctoBooking.contact_email) == current_user.email.lower()
        )
        if current_user.email
        else False
    )
    bookings = (
        db.query(OctoBooking)
        .filter(or_(OctoBooking.user_id == current_user.id, email_cond))
        .order_by(OctoBooking.created_at.desc())
        .all()
    )
    res = []
    for b in bookings:
        trip = b.slot.dive_trip if b.slot else None
        res.append(MyBookingItemResponse(
            bookingUuid=b.uuid,
            reference=f"DIVEMAP-{b.uuid[:8].upper()}",
            status=b.status,
            paymentStatus=b.payment_status or "PENDING",
            paymentMode=b.payment_mode or "PAY_ON_ARRIVAL",
            totalAmount=float(b.total_amount or 0.0),
            currency=b.currency or "EUR",
            tripDate=b.slot.start_datetime.isoformat() if b.slot else None,
            centerId=b.diving_center_id,
            centerName=b.center.name if b.center else "Diving Center",
            slotId=b.availability_id,
            tripId=trip.id if trip else None,
            participantsCount=len(b.unit_items),
            hasBriefing=bool(b.slot and b.slot.briefing)
        ))
    return res

def calculate_certification_rank(cert: UserCertification) -> tuple:
    """Computes a sorting tuple (depth_m, deco_score, stage_score, tech_score) for a certification."""
    depth_m = 0
    deco_score = 0
    stage_score = 0
    tech_score = 0

    link = cert.certification_level_link
    level_str = (cert.certification_level or "").lower()
    link_name = (link.name if link and link.name else "").lower()
    combined_name = f"{level_str} {link_name}"

    if link:
        if link.max_depth:
            match = re.search(r'(\d+)\s*m', link.max_depth.lower())
            if match:
                depth_m = int(match.group(1))

        if link.deco_time_limit:
            deco_str = link.deco_time_limit.lower()
            if "unlimited" in deco_str or "accelerated" in deco_str:
                deco_score = 999
            else:
                match = re.search(r'(\d+)', deco_str)
                if match:
                    deco_score = int(match.group(1))

        if link.tanks:
            tanks_str = link.tanks.lower()
            if "multi" in tanks_str or "stage" in tanks_str:
                stage_score = 3
            elif "double" in tanks_str or "twin" in tanks_str:
                stage_score = 2
            else:
                stage_score = 1

    if depth_m == 0:
        if "trimix" in combined_name or "hypoxic" in combined_name:
            depth_m = 100
            tech_score = 100
        elif "tec 50" in combined_name or "extended range" in combined_name:
            depth_m = 50
            tech_score = 80
        elif "tec 45" in combined_name or "decompression procedures" in combined_name:
            depth_m = 45
            tech_score = 70
        elif "tec 40" in combined_name:
            depth_m = 40
            tech_score = 60
        elif "deep" in combined_name or "master" in combined_name or "divemaster" in combined_name or "instructor" in combined_name:
            depth_m = 40
            tech_score = 40
        elif "rescue" in combined_name:
            depth_m = 30
            tech_score = 30
        elif "advanced" in combined_name or "aow" in combined_name or "adventure" in combined_name:
            depth_m = 30
            tech_score = 20
        elif "open water" in combined_name or "owd" in combined_name or "1 star" in combined_name:
            depth_m = 18
            tech_score = 10
        elif "scuba diver" in combined_name:
            depth_m = 12
            tech_score = 5

    return (depth_m, deco_score, stage_score, tech_score)


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
    user_gear_profiles = []
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
                "has_own_mask": gear_prof.has_own_mask,
                "has_own_wetsuit": gear_prof.has_own_wetsuit,
                "has_own_regulator": gear_prof.has_own_regulator,
                "has_own_bcd": gear_prof.has_own_bcd,
                "has_own_fins": gear_prof.has_own_fins,
                "has_own_boots": gear_prof.has_own_boots,
                "has_own_torch": gear_prof.has_own_torch,
                "has_own_lead_weights": gear_prof.has_own_lead_weights,
                "has_own_dive_computer": gear_prof.has_own_dive_computer,
                "has_own_smb": gear_prof.has_own_smb,
                "insurance_provider": gear_prof.insurance_provider,
                "insurance_policy_number": gear_prof.insurance_policy_number,
            }

        all_profs = (
            db.query(UserGearProfile)
            .filter(UserGearProfile.user_id == current_user.id)
            .order_by(UserGearProfile.is_default.desc(), UserGearProfile.id.asc())
            .all()
        )
        for p in all_profs:
            user_gear_profiles.append({
                "id": p.id,
                "name": p.name,
                "is_default": p.is_default,
                "preferred_unit_system": p.preferred_unit_system,
                "height_cm": p.height_cm,
                "weight_kg": float(p.weight_kg) if p.weight_kg is not None else None,
                "shoe_size_eu": float(p.shoe_size_eu) if p.shoe_size_eu is not None else None,
                "wetsuit_gender": p.wetsuit_gender,
                "wetsuit_size": p.wetsuit_size,
                "wetsuit_thickness": p.wetsuit_thickness,
                "bcd_size": p.bcd_size,
                "fin_type": p.fin_type,
                "regulator_fitting": p.regulator_fitting or "DIN",
                "preferred_tank_id": p.preferred_tank_id or "12",
                "preferred_gas_mix_id": p.preferred_gas_mix_id or "air",
                "estimated_lead_kg": float(p.estimated_lead_kg) if p.estimated_lead_kg is not None else 4.0,
                "has_own_mask": p.has_own_mask,
                "has_own_wetsuit": p.has_own_wetsuit,
                "has_own_regulator": p.has_own_regulator,
                "has_own_bcd": p.has_own_bcd,
                "has_own_fins": p.has_own_fins,
                "has_own_boots": p.has_own_boots,
                "has_own_torch": p.has_own_torch,
                "has_own_lead_weights": p.has_own_lead_weights,
                "has_own_dive_computer": p.has_own_dive_computer,
                "has_own_smb": p.has_own_smb,
                "insurance_provider": p.insurance_provider,
                "insurance_policy_number": p.insurance_policy_number,
                "insurance_expiry_date": p.insurance_expiry_date.isoformat() if p.insurance_expiry_date else None,
                "emergency_contact_name": p.emergency_contact_name,
                "emergency_contact_phone": p.emergency_contact_phone,
                "emergency_contact_relation": p.emergency_contact_relation,
            })

        certs = (
            db.query(UserCertification)
            .options(
                joinedload(UserCertification.certification_level_link),
                joinedload(UserCertification.diving_organization)
            )
            .filter(UserCertification.user_id == current_user.id)
            .all()
        )
        certs_sorted = sorted(certs, key=calculate_certification_rank, reverse=True)
        for i, c in enumerate(certs_sorted):
            org_name = c.diving_organization.name if c.diving_organization else "PADI"
            user_certifications.append({
                "agency": org_name,
                "level": c.certification_level,
                "number": getattr(c, "certification_number", None) or "",
                "is_most_advanced": i == 0,
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
        "vessel": {
            "id": slot.vessel.id,
            "name": slot.vessel.name,
            "registration_number": slot.vessel.registration_number,
            "licensed_capacity": slot.vessel.licensed_capacity,
        } if slot.vessel else None,
        "user": {
            "id": current_user.id,
            "full_name": current_user.name or current_user.username,
            "email": current_user.email if (current_user.email and not current_user.email.endswith('.invalid')) else None,
        } if current_user else None,
        "user_annual_medical": (
            {
                "has_record": True,
                "status": u_med.status,
                "is_expired": ensure_aware(u_med.expires_at) < datetime.now(timezone.utc),
                "completed_at": ensure_aware(u_med.completed_at).isoformat() if u_med.completed_at else None,
                "expires_at": ensure_aware(u_med.expires_at).isoformat() if u_med.expires_at else None,
                "days_remaining": max(0, (ensure_aware(u_med.expires_at) - datetime.now(timezone.utc)).days) if ensure_aware(u_med.expires_at) >= datetime.now(timezone.utc) else 0,
                "center_approved": bool(
                    [
                        ca for ca in db.query(CenterDiverMedicalApproval).filter(
                            CenterDiverMedicalApproval.diving_center_id == center.id,
                            CenterDiverMedicalApproval.user_id == current_user.id
                        ).all() if ensure_aware(ca.expires_at) >= datetime.now(timezone.utc)
                    ]
                ) if u_med.status != "CLEARED" else True,
                "center_approval_expires_at": (
                    ensure_aware(c_app[0].expires_at).isoformat()
                    if (c_app := [
                        ca for ca in db.query(CenterDiverMedicalApproval).filter(
                            CenterDiverMedicalApproval.diving_center_id == center.id,
                            CenterDiverMedicalApproval.user_id == current_user.id
                        ).all() if ensure_aware(ca.expires_at) >= datetime.now(timezone.utc)
                    ])
                    else None
                ),
            }
            if current_user and (u_med := db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first())
            else None
        ),
        "prefill_gear": prefill_gear,
        "user_gear_profiles": user_gear_profiles,
        "user_certifications": user_certifications,
        "dmsc_schema": dmsc_schema,
        "rental_pricing": (
            db.query(DivingCenterBookingSettings)
            .filter(DivingCenterBookingSettings.diving_center_id == center.id)
            .first()
            .rental_equipment_pricing
            if db.query(DivingCenterBookingSettings)
            .filter(DivingCenterBookingSettings.diving_center_id == center.id)
            .first()
            else None
        ),
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
    now_utc = datetime.now(timezone.utc)
    audit_str = f"{booking.uuid}:{unit_item.id}:{req.signatureName}:{now_utc.isoformat()}"
    audit_hash = hashlib.sha256(audit_str.encode('utf-8')).hexdigest()

    if req.useAnnualMedical:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required to use saved annual medical declaration")
        user_med = db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first()
        if not user_med or (user_med.expires_at and ensure_aware(user_med.expires_at) < now_utc):
            raise HTTPException(status_code=400, detail="No active annual medical declaration found or declaration has expired")
        if not req.confirmNoMedicalChange:
            raise HTTPException(status_code=400, detail="You must confirm your physical and medical condition has not changed since your last declaration")

        if user_med.status == "CLEARED":
            medical_status = "CLEARED"
        else:
            center_approvals = db.query(CenterDiverMedicalApproval).filter(
                CenterDiverMedicalApproval.diving_center_id == booking.diving_center_id,
                CenterDiverMedicalApproval.user_id == current_user.id,
            ).all()
            active_ca = [ca for ca in center_approvals if ca.expires_at and ensure_aware(ca.expires_at) >= now_utc]
            if active_ca:
                medical_status = "PHYSICIAN_APPROVED"
            else:
                medical_status = "FLAGGED_CONTACT_CENTER"

        enc_dek = user_med.encrypted_dek
        enc_answers = user_med.encrypted_answers
    else:
        if not req.dmscAnswers:
            raise HTTPException(status_code=400, detail="Medical questionnaire responses are required")
        waiver_svc = WaiverService()
        medical_status = waiver_svc.evaluate_dmsc_medical(req.dmscAnswers)
        encryption_svc = BookingMedicalEncryptionService()
        enc_dek, enc_answers = encryption_svc.encrypt_answers(req.dmscAnswers)

        # Automatically store or update annual declaration for logged-in diver
        if current_user:
            user_med = db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first()
            if not user_med:
                user_med = UserMedicalProfile(
                    user_id=current_user.id,
                    status="CLEARED" if medical_status == "CLEARED" else "FLAGGED",
                    encrypted_dek=enc_dek,
                    encrypted_answers=enc_answers,
                    completed_at=now_utc,
                    expires_at=now_utc + timedelta(days=365),
                    audit_signature_hash=audit_hash,
                )
                db.add(user_med)
            else:
                user_med.status = "CLEARED" if medical_status == "CLEARED" else "FLAGGED"
                user_med.encrypted_dek = enc_dek
                user_med.encrypted_answers = enc_answers
                user_med.completed_at = now_utc
                user_med.expires_at = now_utc + timedelta(days=365)
                user_med.audit_signature_hash = audit_hash

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
            expires_at=now_utc + timedelta(days=365),
            audit_signature_hash=audit_hash,
        )
        db.add(med_rec)

    # 2. Update unit item with gear sizing and waiver completion
    if req.selectedGasMixId and req.selectedGasMixId.lower() != "air":
        if not check_nitrox_eligibility(unit_item.certification_level, req.selectedGasMixId, db, user_id=unit_item.user_id):
            raise HTTPException(
                status_code=400,
                detail=f"Gas mix '{req.selectedGasMixId.upper()}' requires an Enriched Air Diver (Nitrox) or qualifying technical certification. Your current level '{unit_item.certification_level or 'Unspecified'}' does not permit Nitrox."
            )

    unit_item.selected_tank_id = req.selectedTankId or "12"
    unit_item.selected_gas_mix_id = req.selectedGasMixId or "air"
    if req.equipmentSizing:
        unit_item.equipment_sizing = req.equipmentSizing
    unit_item.waivers_complete = True
    unit_item.signed_at = datetime.now(timezone.utc)

    # Recalculate booking total_amount based on updated equipment sizing and add-ons
    settings = db.query(DivingCenterBookingSettings).filter(
        DivingCenterBookingSettings.diving_center_id == booking.diving_center_id
    ).first()
    recomputed_total = 0.0
    for it in booking.unit_items:
        it_sizing = req.equipmentSizing if it.id == unit_item.id else it.equipment_sizing
        pricing_calc = compute_participant_octo_pricing(
            center_settings=settings,
            unit=it.unit,
            equipment_sizing=it_sizing,
            currency=booking.currency or "EUR",
        )
        recomputed_total += pricing_calc["total_due"]
    booking.total_amount = round(recomputed_total, 2)

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

    # Ensure booking.total_amount is in sync with accurate pricing breakdown
    settings = db.query(DivingCenterBookingSettings).filter(
        DivingCenterBookingSettings.diving_center_id == booking.diving_center_id
    ).first()
    recomputed_total = 0.0
    for it in booking.unit_items:
        pricing_calc = compute_participant_octo_pricing(
            center_settings=settings,
            unit=it.unit,
            equipment_sizing=it.equipment_sizing,
            currency=booking.currency or "EUR",
        )
        recomputed_total += pricing_calc["total_due"]
    recomputed_total = round(recomputed_total, 2)
    if recomputed_total > 0 and float(booking.total_amount) != recomputed_total:
        booking.total_amount = recomputed_total
        db.commit()
        db.refresh(booking)

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

    vessel = slot.vessel if slot else None
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
        vesselName=vessel.name if vessel else None,
        vesselRegistration=vessel.registration_number if vessel else None,
        vesselCapacity=vessel.licensed_capacity if vessel else None,
        departureDate=slot.start_datetime.strftime("%Y-%m-%d"),
        meetingTime=option.meeting_time.strftime("%H:%M"),
        departureTime=option.departure_time.strftime("%H:%M"),
        meetingInstructions=getattr(center, "meeting_instructions", None) or "Please arrive 15 minutes before meeting time.",
        qrCodeData=qr_payload,
        unitItems=unit_items_res,
    )


@router.get("/{booking_uuid}/voucher/pdf")
def download_booking_voucher_pdf(
    booking_uuid: str,
    db: Session = Depends(get_db),
):
    """Generates official Boarding Voucher & QR Code Pass PDF for download."""
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    slot = booking.slot
    product = booking.product
    center = booking.center
    option = booking.option

    # Ensure booking.total_amount is in sync with accurate pricing breakdown
    settings = db.query(DivingCenterBookingSettings).filter(
        DivingCenterBookingSettings.diving_center_id == booking.diving_center_id
    ).first()
    recomputed_total = 0.0
    for it in booking.unit_items:
        pricing_calc = compute_participant_octo_pricing(
            center_settings=settings,
            unit=it.unit,
            equipment_sizing=it.equipment_sizing,
            currency=booking.currency or "EUR",
        )
        recomputed_total += pricing_calc["total_due"]
    recomputed_total = round(recomputed_total, 2)
    if recomputed_total > 0 and float(booking.total_amount) != recomputed_total:
        booking.total_amount = recomputed_total
        db.commit()
        db.refresh(booking)

    qr_payload = f"DIVEMAP-VOUCHER:{booking.uuid}:{booking.status}:{booking.payment_status}"
    vessel = slot.vessel if slot else None

    unit_items_data = []
    for item in booking.unit_items:
        sizing = item.equipment_sizing or {}
        unit_items_data.append({
            "diverFullName": item.diver_full_name,
            "unitTitle": item.unit.title if item.unit else "Certified Diver",
            "dateOfBirth": item.date_of_birth.strftime("%Y-%m-%d") if item.date_of_birth else None,
            "passportNumber": item.passport_number,
            "certificationAgency": item.certification_agency,
            "certificationLevel": item.certification_level,
            "certificationNumber": item.certification_number,
            "medicalClearanceStatus": item.medical_record.status if item.medical_record else "CLEARED",
            "waiversComplete": item.waivers_complete,
            "selectedTankId": item.selected_tank_id or "12",
            "selectedGasMixId": item.selected_gas_mix_id or "air",
            "regulatorFitting": getattr(item, "regulator_fitting", "DIN"),
            "estimatedLeadKg": sizing.get("estimated_lead_kg", 6),
            "wetsuitSize": sizing.get("wetsuit_size", "Own"),
            "bcdSize": sizing.get("bcd_size", "Own"),
            "finSize": sizing.get("fin_size", "Own"),
            "bootSize": sizing.get("boot_size", "Own"),
        })

    voucher_data = {
        "bookingUuid": booking.uuid,
        "reference": f"DIVEMAP-{booking.uuid[:8].upper()}",
        "status": booking.status,
        "paymentStatus": booking.payment_status,
        "paymentMode": booking.payment_mode,
        "totalAmount": float(booking.total_amount),
        "currency": booking.currency,
        "productTitle": product.title,
        "centerName": center.name,
        "centerAddress": getattr(center, "address", None) or f"{center.latitude}, {center.longitude}",
        "centerPhone": center.phone,
        "vesselName": vessel.name if vessel else None,
        "vesselRegistration": vessel.registration_number if vessel else None,
        "departureDate": slot.start_datetime.strftime("%Y-%m-%d"),
        "meetingTime": option.meeting_time.strftime("%H:%M") if option and option.meeting_time else "09:00",
        "departureTime": option.departure_time.strftime("%H:%M") if option and option.departure_time else "09:30",
        "meetingInstructions": getattr(center, "meeting_instructions", None) or "Please arrive at the dive center reception desk 15 minutes before meeting time.",
        "qrCodeData": qr_payload,
        "unitItems": unit_items_data,
    }

    from app.services.manifest_export_service import ManifestExportService
    pdf_bytes = ManifestExportService.generate_voucher_pdf(voucher_data)
    clean_ref = booking.uuid[:8].upper()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="dive_voucher_{clean_ref}.pdf"'
        }
    )


@router.get("/{booking_uuid}/briefing")
def download_booking_briefing_pdf(
    booking_uuid: str,
    db: Session = Depends(get_db),
):
    """Download pre-dive briefing PDF for a booked trip."""
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    slot_id = booking.availability_id
    briefing = db.query(TripBriefing).filter(TripBriefing.availability_id == slot_id).first()
    if not briefing:
        briefing = BriefingService.compile_draft_briefing(db, slot_id)

    pdf_bytes = BriefingService.generate_briefing_pdf(briefing, db)
    filename = f"pre_dive_briefing_{booking.uuid[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/medical/me")
def get_my_annual_medical_status(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the authenticated diver's current annual medical declaration status and center approvals."""
    med = db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first()
    now_utc = datetime.now(timezone.utc)

    log_medical_access(
        db=db,
        request=request,
        action="ANNUAL_MEDICAL_STATUS_VIEW",
        access_status="SUCCESS",
        reason=f"Diver {current_user.username} viewed their own annual medical status",
        accessor_user=current_user,
        target_diver_user_id=current_user.id,
        target_diver_name=current_user.name or current_user.username,
    )

    center_approvals = db.query(CenterDiverMedicalApproval).filter(
        CenterDiverMedicalApproval.user_id == current_user.id
    ).all()

    approvals_data = [
        {
            "center_id": ca.diving_center_id,
            "center_name": ca.diving_center.name if ca.diving_center else "Diving Center",
            "physician_name": ca.physician_name,
            "physician_clinic": ca.physician_clinic,
            "approved_at": ensure_aware(ca.approved_at).isoformat() if ca.approved_at else None,
            "expires_at": ensure_aware(ca.expires_at).isoformat() if ca.expires_at else None,
            "is_expired": ensure_aware(ca.expires_at) < now_utc if ca.expires_at else True,
        }
        for ca in center_approvals
    ]

    if not med:
        return {
            "has_record": False,
            "center_approvals": approvals_data,
        }

    exp = ensure_aware(med.expires_at)
    is_active = (exp >= now_utc) if exp else False
    return {
        "has_record": True,
        "status": med.status,
        "completed_at": ensure_aware(med.completed_at).isoformat() if med.completed_at else None,
        "expires_at": exp.isoformat() if exp else None,
        "is_expired": not is_active,
        "days_remaining": max(0, (exp - now_utc).days) if is_active and exp else 0,
        "physician_certificate_url": med.physician_certificate_url,
        "center_approvals": approvals_data,
    }


@router.delete("/medical/me")
def delete_my_annual_medical_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes the authenticated diver's annual medical declaration profile
    under GDPR Article 17(1) (Right to Erasure).
    Historical departure records linked to past dive trips are retained in an
    encrypted archive for statutory liability defense under GDPR Article 17(3)(e).
    """
    profile = db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first()
    if not profile:
        log_medical_access(
            db=db,
            request=request,
            action="ANNUAL_MEDICAL_DELETE",
            access_status="DENIED",
            reason="No annual medical profile found to delete",
            accessor_user=current_user,
            target_diver_user_id=current_user.id,
            target_diver_name=current_user.name or current_user.username,
        )
        raise HTTPException(status_code=404, detail="No annual medical profile found to delete")

    db.delete(profile)
    db.commit()

    log_medical_access(
        db=db,
        request=request,
        action="ANNUAL_MEDICAL_DELETE",
        access_status="SUCCESS",
        reason=f"Diver {current_user.username} deleted their annual medical profile under GDPR Art. 17",
        accessor_user=current_user,
        target_diver_user_id=current_user.id,
        target_diver_name=current_user.name or current_user.username,
    )

    logger.info(f"[GDPR_DELETION] User {current_user.id} ({current_user.username}) deleted annual medical profile.")
    return {
        "success": True,
        "message": "Annual medical declaration deleted. Future bookings will require a new declaration.",
    }


@router.post("/medical/me")
def save_my_annual_medical_declaration(
    req: SaveAnnualMedicalRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits or updates the authenticated diver's standalone annual DMSC 2020 medical declaration."""
    waiver_svc = WaiverService()
    medical_status = waiver_svc.evaluate_dmsc_medical(req.dmscAnswers)

    encryption_svc = BookingMedicalEncryptionService()
    enc_dek, enc_answers = encryption_svc.encrypt_answers(req.dmscAnswers)

    now_utc = datetime.now(timezone.utc)
    audit_str = f"annual_medical:{current_user.id}:{req.signatureName}:{now_utc.isoformat()}"
    audit_hash = hashlib.sha256(audit_str.encode('utf-8')).hexdigest()

    profile = db.query(UserMedicalProfile).filter(UserMedicalProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserMedicalProfile(
            user_id=current_user.id,
            status="CLEARED" if medical_status == "CLEARED" else "FLAGGED",
            encrypted_dek=enc_dek,
            encrypted_answers=enc_answers,
            physician_certificate_url=req.physicianCertificateUrl,
            completed_at=now_utc,
            expires_at=now_utc + timedelta(days=365),
            audit_signature_hash=audit_hash,
        )
        db.add(profile)
    else:
        profile.status = "CLEARED" if medical_status == "CLEARED" else "FLAGGED"
        profile.encrypted_dek = enc_dek
        profile.encrypted_answers = enc_answers
        if req.physicianCertificateUrl:
            profile.physician_certificate_url = req.physicianCertificateUrl
        profile.completed_at = now_utc
        profile.expires_at = now_utc + timedelta(days=365)
        profile.audit_signature_hash = audit_hash

    db.commit()
    db.refresh(profile)
    return {
        "success": True,
        "status": profile.status,
        "completed_at": profile.completed_at.isoformat(),
        "expires_at": profile.expires_at.isoformat(),
    }

