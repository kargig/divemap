import hashlib
import logging
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
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
)
from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
from app.services.waiver_service import WaiverService
from app.services.briefing_service import BriefingService
from app.services.nitrox_service import check_nitrox_eligibility

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
        "prefill_gear": prefill_gear,
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
    if req.selectedGasMixId and req.selectedGasMixId.lower() != "air":
        if not check_nitrox_eligibility(unit_item.certification_level, req.selectedGasMixId, db, user_id=unit_item.user_id):
            raise HTTPException(
                status_code=400,
                detail=f"Gas mix '{req.selectedGasMixId.upper()}' requires an Enriched Air Diver (Nitrox) or qualifying technical certification. Your current level '{unit_item.certification_level or 'Unspecified'}' does not permit Nitrox."
            )

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
