from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timezone
import uuid
import logging

from app.database import get_db
from app.auth import get_current_user
from app.models import (
    User,
    DivingCenter,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoUnit,
    DiverMedicalRecord,
    DivingCenterVessel,
)
from app.routers.diving_centers import is_center_manager
from app.services.manifest_export_service import ManifestExportService
from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
from app.services.nitrox_service import check_nitrox_eligibility

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/centers/{center_id}/booking-ops", tags=["Center Booking Operations"])

DMSC_QUESTION_TEXTS = {
    "q1": "1. Problems with lungs/breathing, heart, or blood affecting normal performance.",
    "q2": "2. Over 45 years of age and smoke, high cholesterol, high blood pressure, or family history of heart disease.",
    "q3": "3. Struggle to perform moderate exercise (e.g. walk 1 mile in 14 mins or swim 200m).",
    "q4": "4. Problems with eyes, ears, or nasal passages/sinuses.",
    "q5": "5. Surgery within the last 12 months, or ongoing problems related to past surgery.",
    "q6": "6. Lost consciousness, migraines, seizures, stroke, significant head injury, or neurological disease.",
    "q7": "7. Currently undergoing treatment for psychological problems, panic attacks, anxiety, or addiction.",
    "q8": "8. Back problems, hernia, ulcers, or diabetes.",
    "q9": "9. Stomach or intestine problems, including recent diarrhea.",
    "q10": "10. Taking prescription medications (excluding standard birth control or malaria prophylaxis).",
}


# --- Schemas ---

class ClearMedicalOverrideRequest(BaseModel):
    physician_name: str
    physician_clinic: Optional[str] = None
    clearance_date: Optional[date] = None
    notes: Optional[str] = None
    confirmed_physical_form_inspected: bool = True

class WalkInParticipantCreate(BaseModel):
    diver_full_name: str
    diver_email: Optional[str] = None
    diver_phone: Optional[str] = None
    diver_nationality: Optional[str] = None
    passport_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    certification_agency: Optional[str] = "PADI"
    certification_level: Optional[str] = "Open Water"
    certification_number: Optional[str] = None
    selected_tank_id: Optional[str] = "12"
    selected_gas_mix_id: Optional[str] = "air"
    equipment_sizing: Optional[Dict[str, Any]] = None
    mark_as_paid: Optional[bool] = True
    onboard_checkin_status: Optional[bool] = False


class ParticipantUpdateRequest(BaseModel):
    diver_full_name: Optional[str] = None
    diver_email: Optional[str] = None
    diver_phone: Optional[str] = None
    diver_nationality: Optional[str] = None
    passport_number: Optional[str] = None
    certification_agency: Optional[str] = None
    certification_level: Optional[str] = None
    certification_number: Optional[str] = None
    selected_tank_id: Optional[str] = None
    selected_gas_mix_id: Optional[str] = None
    equipment_sizing: Optional[Dict[str, Any]] = None


class StaffUpdateRequest(BaseModel):
    skipper_name: Optional[str] = "Captain"
    skipper_license: Optional[str] = None
    lead_guide_name: Optional[str] = "Lead Divemaster"
    lead_guide_cert: Optional[str] = None
    crew_names: Optional[List[str]] = []


# --- Helper ---

def get_slot_manifest_data(db: Session, center: DivingCenter, slot: OctoAvailabilitySlot) -> Dict[str, Any]:
    vessel = slot.vessel
    vessel_data = {
        "id": vessel.id if vessel else None,
        "name": vessel.name if vessel else (slot.product.title if slot.product else "Dive Boat"),
        "registration_number": vessel.registration_number if vessel else "GR-DIVE-LOCAL",
        "licensed_capacity": vessel.licensed_capacity if vessel else slot.seats_total,
        "has_emergency_oxygen": vessel.has_emergency_oxygen if vessel else True,
        "has_first_aid_kit": vessel.has_first_aid_kit if vessel else True,
    }

    center_data = {
        "id": center.id,
        "name": center.name,
        "address": center.address,
        "phone": center.phone,
        "email": center.email,
    }

    slot_data = {
        "id": slot.id,
        "departure_date": slot.start_datetime.strftime("%Y-%m-%d"),
        "meeting_time": slot.start_datetime.strftime("%H:%M"),
        "departure_time": slot.start_datetime.strftime("%H:%M"),
        "seats_total": slot.seats_total,
        "seats_available": slot.seats_available,
        "seats_confirmed": sum(
            len(b.unit_items) for b in slot.bookings if b.status in ("CONFIRMED", "COMPLETED")
        ),
        "is_closed": slot.is_closed,
        "product_title": slot.product.title if slot.product else "Dive Trip",
    }

    # Staff / Crew metadata
    staff_meta = slot.assigned_guide_user_ids if isinstance(slot.assigned_guide_user_ids, dict) else {}
    staff_data = {
        "skipper_name": staff_meta.get("skipper_name", "Captain (Center Staff)"),
        "skipper_license": staff_meta.get("skipper_license", "N/A"),
        "lead_guide_name": staff_meta.get("lead_guide_name", "Lead Instructor / DM"),
        "lead_guide_cert": staff_meta.get("lead_guide_cert", "N/A"),
        "crew_names": staff_meta.get("crew_names", []),
    }

    participants = []
    tanks_summary = {}
    suits_summary = {}
    bcds_summary = {}
    fins_summary = {}
    total_lead_kg = 0.0

    # Denomination tallies for weights & valve fittings
    blocks_1kg = 0
    blocks_2kg = 0
    belts_needed = 0
    integrated_divers = 0
    din_count = 0
    yoke_count = 0

    for b in slot.bookings:
        if b.status == "CANCELLED":
            continue

        for item in b.unit_items:
            med = db.query(DiverMedicalRecord).filter(
                DiverMedicalRecord.booking_unit_item_id == item.id
            ).first()
            med_status = med.status if med else ("CLEARED" if b.status == "CONFIRMED" else "PENDING")

            med_audit = None
            if med and med.status == "PHYSICIAN_APPROVED":
                med_audit = {
                    "cleared_by_name": med.cleared_by_user.username if med.cleared_by_user else "Manager",
                    "cleared_at": med.cleared_at.isoformat() if med.cleared_at else None,
                    "physician_name": med.cleared_physician_name,
                    "physician_clinic": med.cleared_physician_clinic,
                    "reason": med.cleared_reason,
                }

            eq = item.equipment_sizing or {}
            lead = float(eq.get("estimated_lead_kg") or 0.0)
            total_lead_kg += lead

            # Valve fitting analysis
            fitting = str(eq.get("regulator_fitting", "DIN")).upper()
            if "YOKE" in fitting or "INT" in fitting:
                yoke_count += 1
            else:
                din_count += 1

            # Weight distribution analysis
            if eq.get("weight_system") == "BELT" or not eq.get("bcd_size"):
                belts_needed += 1
            else:
                integrated_divers += 1

            # Symmetry weight pocket distribution:
            if lead > 0:
                twos = int(lead // 2)
                ones = int(round(lead % 2))
                # For 2kg, prefer 2x 1kg for balance if small
                if twos == 1 and ones == 0 and eq.get("bcd_size") in ("XS", "S"):
                    blocks_1kg += 2
                else:
                    blocks_2kg += twos
                    blocks_1kg += ones

            # Cylinder breakdown with explicit valve and adapter requirement
            valve_desc = (
                "YOKE (Fit DIN-to-Yoke Insert)"
                if ("YOKE" in fitting or "INT" in fitting)
                else "DIN (Native Valve)"
            )
            tank_label = f"{item.selected_tank_id or '12'}L {(item.selected_gas_mix_id or 'AIR').upper()} — {valve_desc}"
            tanks_summary[tank_label] = tanks_summary.get(tank_label, 0) + 1

            # Rental gear breakdown
            if eq.get("wetsuit_size"):
                suit_label = f"{eq.get('wetsuit_size')} ({eq.get('wetsuit_thickness', '5mm')})"
                suits_summary[suit_label] = suits_summary.get(suit_label, 0) + 1

            if eq.get("bcd_size"):
                bcd_label = str(eq.get("bcd_size"))
                bcds_summary[bcd_label] = bcds_summary.get(bcd_label, 0) + 1

            if eq.get("shoe_size_eu"):
                shoe_label = f"EU {eq.get('shoe_size_eu')}"
                fins_summary[shoe_label] = fins_summary.get(shoe_label, 0) + 1

            participants.append({
                "id": item.id,
                "booking_id": b.uuid,
                "diver_full_name": item.diver_full_name,
                "diver_email": item.diver_email,
                "diver_phone": item.diver_phone,
                "diver_nationality": item.diver_nationality,
                "passport_number": item.passport_number,
                "date_of_birth": str(item.date_of_birth) if item.date_of_birth else None,
                "certification_agency": item.certification_agency or "PADI",
                "certification_level": item.certification_level or "Open Water",
                "certification_number": item.certification_number,
                "selected_tank_id": item.selected_tank_id or "12",
                "selected_gas_mix_id": item.selected_gas_mix_id or "air",
                "estimated_lead_kg": lead,
                "equipment_sizing": eq,
                "medical_status": med_status,
                "medical_clearance_audit": med_audit,
                "waivers_complete": item.waivers_complete,
                "onboard_checkin_status": item.onboard_checkin_status,
                "payment_status": b.payment_status,
                "payment_mode": b.payment_mode,
                "booking_status": b.status,
            })

    # Spare lead buffer calculation (+15% extra ballast)
    spare_kg = max(4.0, round(total_lead_kg * 0.15, 1))
    spare_2kg = int(spare_kg // 2)
    spare_1kg = int(round(spare_kg % 2))

    lead_breakdown = {
        "total_lead_kg": total_lead_kg,
        "total_lead_lbs": round(total_lead_kg * 2.20462, 1),
        "blocks_1kg": blocks_1kg,
        "blocks_2kg": blocks_2kg,
        "spare_buffer_kg": spare_kg,
        "spare_blocks_1kg": spare_1kg,
        "spare_blocks_2kg": spare_2kg,
        "belts_needed": belts_needed,
        "integrated_weight_divers": integrated_divers,
    }

    valve_fittings = {
        "din_count": din_count,
        "yoke_count": yoke_count,
        "yoke_inserts_needed": yoke_count,
        "tool_notes": (
            f"Pack {yoke_count}x DIN-to-Yoke threaded insert(s) + 8mm hex key in boat tool box."
            if yoke_count > 0
            else "All divers using native DIN first stages."
        ),
    }

    return {
        "center": center_data,
        "vessel": vessel_data,
        "slot": slot_data,
        "staff": staff_data,
        "participants": participants,
        "crate_packing_summary": {
            "cylinders": tanks_summary,
            "wetsuits": suits_summary,
            "bcds": bcds_summary,
            "fins": fins_summary,
            "total_lead_kg": total_lead_kg,
            "total_participants": len(participants),
            "lead_breakdown": lead_breakdown,
            "valve_fittings": valve_fittings,
        },
    }


# --- Endpoints ---

@router.get("/trips/{trip_id}/manifest")
def get_trip_manifest(
    center_id: int,
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns trip roster, participant biometrics, live capacity gauge, and aggregated crate packing summary."""
    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Trip availability slot not found")

    return get_slot_manifest_data(db, center, slot)


@router.put("/trips/{trip_id}/staff")
def update_trip_staff(
    center_id: int,
    trip_id: str,
    req: StaffUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates skipper, lead instructor, and crew assignments for the trip."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Trip availability slot not found")

    staff_dict = {
        "skipper_name": req.skipper_name or "Captain",
        "skipper_license": req.skipper_license or "N/A",
        "lead_guide_name": req.lead_guide_name or "Lead Divemaster",
        "lead_guide_cert": req.lead_guide_cert or "N/A",
        "crew_names": req.crew_names or [],
    }
    slot.assigned_guide_user_ids = staff_dict
    db.commit()
    return {"trip_id": slot.id, "staff": staff_dict}


@router.post("/trips/{trip_id}/participants", status_code=status.HTTP_201_CREATED)
def add_walkin_participant(
    center_id: int,
    trip_id: str,
    req: WalkInParticipantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registers a walk-in diver at the desk, decrementing available seats and creating booking record."""
    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip_id).first()
    if not slot or slot.is_closed:
        raise HTTPException(status_code=400, detail="Trip is not available or closed")

    if slot.seats_available <= 0:
        raise HTTPException(status_code=400, detail="Trip is fully booked. No seats available.")

    # Check Nitrox Eligibility
    if req.selected_gas_mix_id and req.selected_gas_mix_id.lower() != "air":
        if not check_nitrox_eligibility(req.certification_level, req.selected_gas_mix_id, db):
            raise HTTPException(
                status_code=400,
                detail=f"Gas mix '{req.selected_gas_mix_id.upper()}' requires an Enriched Air Diver (Nitrox) or qualifying technical certification. Diver holds '{req.certification_level or 'Unspecified'}', which is not certified for Nitrox."
            )

    # Find default product unit for pricing
    unit = db.query(OctoUnit).filter(OctoUnit.product_id == slot.product_id).first()
    unit_id = unit.id if unit else "walkin_unit"
    price = float(unit.retail_price) if unit else 75.0

    # Decrement available seat
    slot.seats_available -= 1

    # Create Booking
    booking = OctoBooking(
        uuid=str(uuid.uuid4()),
        diving_center_id=center_id,
        product_id=slot.product_id,
        option_id=slot.option_id,
        availability_id=slot.id,
        user_id=None, # Walk-in
        contact_full_name=req.diver_full_name,
        contact_email=req.diver_email,
        contact_phone=req.diver_phone,
        status="CONFIRMED",
        payment_mode="PAY_ON_ARRIVAL",
        payment_status="PAID_IN_FULL" if req.mark_as_paid else "PENDING_AT_CHECKIN",
        total_amount=price,
        currency="EUR",
        booking_notes="Desk Walk-in Booking",
    )
    db.add(booking)
    db.flush()

    # Create Unit Item
    unit_item = OctoBookingUnitItem(
        id=str(uuid.uuid4()),
        booking_uuid=booking.uuid,
        unit_id=unit_id,
        user_id=None,
        diver_full_name=req.diver_full_name,
        diver_email=req.diver_email,
        diver_phone=req.diver_phone,
        diver_nationality=req.diver_nationality,
        passport_number=req.passport_number,
        date_of_birth=req.date_of_birth,
        certification_agency=req.certification_agency or "PADI",
        certification_level=req.certification_level or "Open Water",
        certification_number=req.certification_number,
        selected_tank_id=req.selected_tank_id or "12",
        selected_gas_mix_id=req.selected_gas_mix_id or "air",
        equipment_sizing=req.equipment_sizing or {},
        waivers_complete=True,
        signed_at=datetime.now(timezone.utc),
        onboard_checkin_status=req.onboard_checkin_status or False,
    )
    db.add(unit_item)
    db.commit()
    db.refresh(unit_item)

    return {
        "id": unit_item.id,
        "booking_id": booking.uuid,
        "diver_full_name": unit_item.diver_full_name,
        "status": "CONFIRMED",
        "seats_available": slot.seats_available,
    }


@router.put("/trips/{trip_id}/participants/{participant_id}")
def update_participant(
    center_id: int,
    trip_id: str,
    participant_id: str,
    req: ParticipantUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates participant equipment sizing, cylinder assignment, or certification details."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    item = db.query(OctoBookingUnitItem).filter(OctoBookingUnitItem.id == participant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Participant not found")

    if req.diver_full_name is not None:
        item.diver_full_name = req.diver_full_name
    if req.diver_email is not None:
        item.diver_email = req.diver_email
    if req.diver_phone is not None:
        item.diver_phone = req.diver_phone
    if req.diver_nationality is not None:
        item.diver_nationality = req.diver_nationality
    if req.passport_number is not None:
        item.passport_number = req.passport_number
    if req.certification_agency is not None:
        item.certification_agency = req.certification_agency
    if req.certification_level is not None:
        item.certification_level = req.certification_level
    if req.certification_number is not None:
        item.certification_number = req.certification_number
    if req.selected_tank_id is not None:
        item.selected_tank_id = req.selected_tank_id
    if req.selected_gas_mix_id is not None:
        if req.selected_gas_mix_id.lower() != "air":
            cert_to_check = req.certification_level or item.certification_level
            if not check_nitrox_eligibility(cert_to_check, req.selected_gas_mix_id, db, user_id=item.user_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Gas mix '{req.selected_gas_mix_id.upper()}' requires an Enriched Air Diver (Nitrox) or qualifying technical certification."
                )
        item.selected_gas_mix_id = req.selected_gas_mix_id
    if req.equipment_sizing is not None:
        item.equipment_sizing = req.equipment_sizing

    db.commit()
    db.refresh(item)
    return {"id": item.id, "diver_full_name": item.diver_full_name, "updated": True}


@router.get("/trips/{trip_id}/participants/{participant_id}/medical-review")
def get_participant_medical_review(
    center_id: int,
    trip_id: str,
    participant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allows authorized center managers to inspect flagged medical screening conditions."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    item = db.query(OctoBookingUnitItem).filter(OctoBookingUnitItem.id == participant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Participant not found")

    med = db.query(DiverMedicalRecord).filter(
        DiverMedicalRecord.booking_unit_item_id == participant_id
    ).first()
    if not med:
        return {
            "participant_id": participant_id,
            "diver_full_name": item.diver_full_name,
            "status": "CLEARED" if item.booking.status == "CONFIRMED" else "PENDING",
            "flagged_questions": [],
            "clearance_audit": None,
        }

    flagged_questions = []
    if med.encrypted_answers and med.encrypted_dek:
        try:
            encryption_svc = BookingMedicalEncryptionService()
            decrypted = encryption_svc.decrypt_answers(med.encrypted_dek, med.encrypted_answers)
            for q_id, is_yes in decrypted.items():
                if is_yes is True:
                    flagged_questions.append({
                        "id": q_id,
                        "text": DMSC_QUESTION_TEXTS.get(q_id, f"Condition: {q_id}"),
                        "answered_yes": True,
                    })
        except Exception as e:
            logger.error(f"Failed to decrypt medical review answers: {e}")

    audit_info = None
    if med.status == "PHYSICIAN_APPROVED":
        audit_info = {
            "cleared_by_name": med.cleared_by_user.username if med.cleared_by_user else "Manager",
            "cleared_at": med.cleared_at.isoformat() if med.cleared_at else None,
            "physician_name": med.cleared_physician_name,
            "physician_clinic": med.cleared_physician_clinic,
            "reason": med.cleared_reason,
        }

    return {
        "participant_id": participant_id,
        "diver_full_name": item.diver_full_name,
        "status": med.status,
        "flagged_questions": flagged_questions,
        "clearance_audit": audit_info,
    }


@router.post("/trips/{trip_id}/participants/{participant_id}/clear-medical")
def clear_participant_medical(
    center_id: int,
    trip_id: str,
    participant_id: str,
    req: ClearMedicalOverrideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Formally clears a diver's medical condition prior to boarding upon verification of signed physician clearance.
    Creates an immutable audit record documenting which staff member cleared the diver and on what date.
    """
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    if not req.confirmed_physical_form_inspected:
        raise HTTPException(
            status_code=400,
            detail="Staff must confirm physical verification of the signed physician medical clearance form."
        )

    if not req.physician_name or not req.physician_name.strip():
        raise HTTPException(status_code=400, detail="Physician name is required.")

    item = db.query(OctoBookingUnitItem).filter(OctoBookingUnitItem.id == participant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Participant not found")

    med = db.query(DiverMedicalRecord).filter(
        DiverMedicalRecord.booking_unit_item_id == participant_id
    ).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medical record not found for this participant")

    med.status = "PHYSICIAN_APPROVED"
    med.cleared_by_user_id = current_user.id
    med.cleared_at = datetime.now(timezone.utc)
    med.cleared_physician_name = req.physician_name.strip()
    med.cleared_physician_clinic = req.physician_clinic.strip() if req.physician_clinic else None
    med.cleared_reason = req.notes or f"Physician clearance by Dr. {req.physician_name.strip()} verified by {current_user.username}"

    db.commit()
    db.refresh(med)

    logger.info(
        f"[MEDICAL_CLEARANCE_AUDIT] Diver '{item.diver_full_name}' (item_id={item.id}) cleared by manager "
        f"'{current_user.username}' (user_id={current_user.id}). Physician: Dr. {med.cleared_physician_name}."
    )

    return {
        "participant_id": item.id,
        "diver_full_name": item.diver_full_name,
        "status": med.status,
        "cleared_by": current_user.username,
        "cleared_at": med.cleared_at.isoformat(),
        "physician_name": med.cleared_physician_name,
    }


@router.delete("/trips/{trip_id}/participants/{participant_id}")
def delete_participant(
    center_id: int,
    trip_id: str,
    participant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancels a participant and immediately releases the seat back to the trip availability slot."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    item = db.query(OctoBookingUnitItem).filter(OctoBookingUnitItem.id == participant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Participant not found")

    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip_id).first()
    if slot:
        slot.seats_available = min(slot.seats_total, slot.seats_available + 1)

    booking = item.booking
    db.delete(item)

    # If booking has no more participants, cancel booking
    if booking and len(booking.unit_items) <= 1:
        booking.status = "CANCELLED"
        booking.cancellation_reason = "Cancelled by center manager"

    db.commit()
    return {"message": "Participant cancelled and seat released.", "seats_available": slot.seats_available if slot else None}


@router.post("/trips/{trip_id}/participants/{participant_id}/toggle-checkin")
def toggle_participant_checkin(
    center_id: int,
    trip_id: str,
    participant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggles the onboard boarding / roll-call check-in status for a diver."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    item = db.query(OctoBookingUnitItem).filter(OctoBookingUnitItem.id == participant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Scuba Safety Gate: Diver with unresolved medical condition CANNOT be boarded
    if not item.onboard_checkin_status: # Diver is currently not boarded, attempting to board
        med = db.query(DiverMedicalRecord).filter(
            DiverMedicalRecord.booking_unit_item_id == item.id
        ).first()
        if med and med.status == "FLAGGED_CONTACT_CENTER":
            raise HTTPException(
                status_code=400,
                detail=f"Safety Gate: Diver '{item.diver_full_name}' has an unresolved medical flag. Verified physician clearance must be approved before boarding."
            )

    item.onboard_checkin_status = not item.onboard_checkin_status
    db.commit()
    return {"participant_id": item.id, "onboard_checkin_status": item.onboard_checkin_status}


@router.post("/bookings/{booking_id}/mark-paid")
@router.post("/bookings/{booking_id}/toggle-payment")
def toggle_booking_payment(
    center_id: int,
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggles counter payment between PAID_IN_FULL and PENDING_AT_CHECKIN."""
    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    booking = db.query(OctoBooking).filter(
        OctoBooking.uuid == booking_id,
        OctoBooking.diving_center_id == center_id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.payment_status in ("PAID_IN_FULL", "PAID_ONLINE"):
        booking.payment_status = "PENDING_AT_CHECKIN"
    else:
        booking.payment_status = "PAID_IN_FULL"

    db.commit()
    return {"booking_id": booking.uuid, "payment_status": booking.payment_status}


@router.get("/trips/{trip_id}/manifest/export-port-authority")
def export_port_authority_manifest(
    center_id: int,
    trip_id: str,
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exports compliant Port Authority passenger & diver manifest in CSV or PDF format."""
    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    if not is_center_manager(db, center_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to manage this center")

    slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Trip availability slot not found")

    data = get_slot_manifest_data(db, center, slot)

    date_str = slot.start_datetime.strftime("%Y%m%d")
    clean_vessel = (data.get("vessel", {}).get("name") or "vessel").replace(" ", "_")

    if format == "pdf":
        pdf_bytes = ManifestExportService.generate_pdf(data)
        filename = f"port_manifest_{clean_vessel}_{date_str}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        csv_str = ManifestExportService.generate_csv(data)
        filename = f"port_manifest_{clean_vessel}_{date_str}.csv"
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
