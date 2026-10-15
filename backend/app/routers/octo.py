import logging
import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user_optional
from app.database import get_db
from app.models import (
    DivingCenter,
    DivingCenterBookingSettings,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoProduct,
    OctoUnit,
    User,
)
from app.services.booking_access_service import (
    bump_linked_trip_current_bookings,
    clear_booking_access_token,
    extend_access_token_for_voucher_window,
    extract_access_token,
    mint_booking_access_token,
    mint_claim_token,
    require_booking_principal,
)
from app.services.booking_pricing_service import compute_participant_octo_pricing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/octo", tags=["OCTO 1.0 Supplier"])

# --- Pydantic Schemas ---


class OctoContactSchema(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class OctoSupplierResponse(BaseModel):
    id: str
    name: str
    endpoint: str
    contact: OctoContactSchema
    capabilities: List[str]


class OctoUnitResponse(BaseModel):
    id: str
    internalName: str
    type: str
    title: str
    retailPrice: float
    currency: str


class OctoOptionResponse(BaseModel):
    id: str
    default: bool = False
    internalName: str
    title: str
    meetingTime: str
    departureTime: str
    durationMinutes: int
    maxCapacity: int
    units: List[OctoUnitResponse] = []


class OctoProductResponse(BaseModel):
    id: str
    internalName: str
    title: str
    description: Optional[str] = None
    productType: str
    agencyCode: Optional[str] = None
    waiverBundleId: str
    minLoggedDives: int = 0
    maxDepthMeters: Optional[float] = None
    options: List[OctoOptionResponse] = []
    units: List[OctoUnitResponse] = []


class OctoAvailabilityRequest(BaseModel):
    productId: str
    optionId: str
    localDateStart: str  # YYYY-MM-DD
    localDateEnd: str  # YYYY-MM-DD


class OctoAvailabilityResponse(BaseModel):
    id: str
    productId: str
    optionId: str
    startDatetime: str
    endDatetime: str
    seatsTotal: int
    seatsAvailable: int
    status: str  # AVAILABLE, SOLD_OUT, CLOSED


class OctoBookingUnitItemCreate(BaseModel):
    unitId: str
    diverFullName: Optional[str] = "Guest Diver"
    diverEmail: Optional[str] = None
    diverPhone: Optional[str] = None
    diverNationality: Optional[str] = None
    passportNumber: Optional[str] = None
    dateOfBirth: Optional[str] = None
    certificationAgency: Optional[str] = None
    certificationLevel: Optional[str] = None
    certificationNumber: Optional[str] = None
    selectedTankId: Optional[str] = "12"
    selectedGasMixId: Optional[str] = "air"
    equipmentSizing: Optional[Dict[str, Any]] = None


class OctoBookingRequest(BaseModel):
    productId: str
    optionId: str
    availabilityId: str
    unitItems: List[OctoBookingUnitItemCreate]
    contact: Optional[OctoContactSchema] = None
    notes: Optional[str] = None


class OctoBookingUnitItemResponse(BaseModel):
    id: str
    unitId: str
    diverFullName: str
    diverEmail: Optional[str] = None
    diverPhone: Optional[str] = None
    dateOfBirth: Optional[str] = None
    certificationAgency: Optional[str] = None
    certificationLevel: Optional[str] = None
    waiversComplete: bool = False


class OctoClaimInviteTokenResponse(BaseModel):
    unitItemId: str
    claimToken: str


class OctoBookingResponse(BaseModel):
    uuid: str
    status: str
    utcHoldExpiration: Optional[str] = None
    totalAmount: float
    currency: str
    contact: Optional[OctoContactSchema] = None
    unitItems: List[OctoBookingUnitItemResponse] = []
    accessToken: Optional[str] = None
    claimInviteTokens: Optional[List[OctoClaimInviteTokenResponse]] = None


class OctoConfirmBookingRequest(BaseModel):
    contact: Optional[OctoContactSchema] = None
    notes: Optional[str] = None


class OctoCancelBookingRequest(BaseModel):
    reason: Optional[str] = "Customer requested cancellation"


class OctoExtendBookingRequest(BaseModel):
    expirationMinutes: Optional[int] = 20


# --- Endpoints ---


@router.get("/suppliers/{center_id}", response_model=OctoSupplierResponse)
def get_supplier_profile(center_id: int, db: Session = Depends(get_db)):
    center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Supplier diving center not found")

    return OctoSupplierResponse(
        id=str(center.id),
        name=center.name,
        endpoint=f"/api/v1/octo/suppliers/{center.id}",
        contact=OctoContactSchema(
            fullName=center.name, email=center.email, phone=center.phone
        ),
        capabilities=[
            "octo/pricing",
            "octo/content",
            "octo/questions",
            "octo/waivers",
            "octo/identities",
        ],
    )


@router.get("/suppliers/{center_id}/products", response_model=List[OctoProductResponse])
def list_supplier_products(center_id: int, db: Session = Depends(get_db)):
    products = (
        db.query(OctoProduct)
        .filter(
            OctoProduct.diving_center_id == center_id, OctoProduct.is_active == True
        )
        .all()
    )

    res = []
    for p in products:
        res.append(
            OctoProductResponse(
                id=p.id,
                internalName=p.title,
                title=p.title,
                description=p.description,
                productType=p.product_type,
                agencyCode=p.agency_code,
                waiverBundleId=p.waiver_bundle_id,
                minLoggedDives=p.min_logged_dives,
                maxDepthMeters=float(p.max_depth_meters)
                if p.max_depth_meters
                else None,
                options=[
                    OctoOptionResponse(
                        id=opt.id,
                        internalName=opt.title,
                        title=opt.title,
                        meetingTime=opt.meeting_time.strftime("%H:%M"),
                        departureTime=opt.departure_time.strftime("%H:%M"),
                        durationMinutes=opt.duration_minutes,
                        maxCapacity=opt.max_capacity,
                    )
                    for opt in p.options
                    if opt.is_active
                ],
                units=[
                    OctoUnitResponse(
                        id=u.id,
                        internalName=u.title,
                        type=u.unit_type,
                        title=u.title,
                        retailPrice=float(u.retail_price),
                        currency=u.currency,
                    )
                    for u in p.units
                    if u.is_active
                ],
            )
        )
    return res


@router.get(
    "/suppliers/{center_id}/products/{product_id}", response_model=OctoProductResponse
)
def get_supplier_product(
    center_id: int, product_id: str, db: Session = Depends(get_db)
):
    p = (
        db.query(OctoProduct)
        .filter(
            OctoProduct.id == product_id,
            OctoProduct.diving_center_id == center_id,
            OctoProduct.is_active == True,
        )
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    return OctoProductResponse(
        id=p.id,
        internalName=p.title,
        title=p.title,
        description=p.description,
        productType=p.product_type,
        agencyCode=p.agency_code,
        waiverBundleId=p.waiver_bundle_id,
        minLoggedDives=p.min_logged_dives,
        maxDepthMeters=float(p.max_depth_meters) if p.max_depth_meters else None,
        options=[
            OctoOptionResponse(
                id=opt.id,
                internalName=opt.title,
                title=opt.title,
                meetingTime=opt.meeting_time.strftime("%H:%M"),
                departureTime=opt.departure_time.strftime("%H:%M"),
                durationMinutes=opt.duration_minutes,
                maxCapacity=opt.max_capacity,
            )
            for opt in p.options
            if opt.is_active
        ],
        units=[
            OctoUnitResponse(
                id=u.id,
                internalName=u.title,
                type=u.unit_type,
                title=u.title,
                retailPrice=float(u.retail_price),
                currency=u.currency,
            )
            for u in p.units
            if u.is_active
        ],
    )


@router.post("/availability", response_model=List[OctoAvailabilityResponse])
def query_availability(query: OctoAvailabilityRequest, db: Session = Depends(get_db)):
    try:
        start_date = datetime.strptime(query.localDateStart, "%Y-%m-%d").date()
        end_date = datetime.strptime(query.localDateEnd, "%Y-%m-%d").date() + timedelta(
            days=1
        )
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
        )

    slots = (
        db.query(OctoAvailabilitySlot)
        .filter(
            OctoAvailabilitySlot.product_id == query.productId,
            OctoAvailabilitySlot.option_id == query.optionId,
            OctoAvailabilitySlot.start_datetime
            >= datetime.combine(start_date, time.min),
            OctoAvailabilitySlot.start_datetime <= datetime.combine(end_date, time.max),
        )
        .order_by(OctoAvailabilitySlot.start_datetime.asc())
        .all()
    )

    res = []
    for s in slots:
        status_str = (
            "AVAILABLE"
            if s.seats_available > 0 and not s.is_closed
            else ("CLOSED" if s.is_closed else "SOLD_OUT")
        )
        res.append(
            OctoAvailabilityResponse(
                id=s.id,
                productId=s.product_id,
                optionId=s.option_id,
                startDatetime=s.start_datetime.isoformat(),
                endDatetime=s.end_datetime.isoformat(),
                seatsTotal=s.seats_total,
                seatsAvailable=s.seats_available,
                status=status_str,
            )
        )
    return res


@router.post(
    "/bookings", response_model=OctoBookingResponse, status_code=status.HTTP_201_CREATED
)
def create_booking_hold(
    req: OctoBookingRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Holds seats in an availability slot and creates a booking in ON_HOLD status."""
    needed_seats = len(req.unitItems)
    if needed_seats <= 0:
        raise HTTPException(status_code=400, detail="At least one unitItem is required")

    # Concurrency-safe slot lookup with row lock + expire stale holds under the lock
    slot = (
        db.query(OctoAvailabilitySlot)
        .options(joinedload(OctoAvailabilitySlot.product))
        .filter(OctoAvailabilitySlot.id == req.availabilityId)
        .with_for_update()
        .first()
    )

    if not slot or slot.is_closed:
        raise HTTPException(
            status_code=404, detail="Availability slot not found or closed"
        )

    if req.productId != slot.product_id:
        raise HTTPException(
            status_code=400,
            detail="productId does not match the availability slot's product",
        )
    if req.optionId != slot.option_id:
        raise HTTPException(
            status_code=400,
            detail="optionId does not match the availability slot's option",
        )

    # Lazy import avoids circular import with center_booking_ops
    from app.routers.center_booking_ops import reconcile_slot_seats

    reconcile_slot_seats(db, slot, commit=False, already_locked=True)

    if slot.seats_available < needed_seats:
        raise HTTPException(
            status_code=400,
            detail=(
                "This trip is fully booked online. Please contact the diving center "
                "directly — they may still have reserved spots or a waitlist."
            ),
        )

    product = slot.product
    if not product:
        product = (
            db.query(OctoProduct).filter(OctoProduct.id == slot.product_id).first()
        )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    settings = (
        db.query(DivingCenterBookingSettings)
        .filter(
            DivingCenterBookingSettings.diving_center_id == product.diving_center_id
        )
        .first()
    )
    hold_minutes = settings.hold_duration_minutes if settings else 20

    # Calculate total and unit pricing — units must belong to this product
    unit_ids = [item.unitId for item in req.unitItems]
    units = db.query(OctoUnit).filter(OctoUnit.id.in_(unit_ids)).all()
    unit_map = {u.id: u for u in units}
    for uid in unit_ids:
        unit = unit_map.get(uid)
        if not unit or unit.product_id != product.id:
            raise HTTPException(
                status_code=400,
                detail=f"unitId '{uid}' is invalid or does not belong to this product",
            )

    # Validate that at least one of email, phone, or passport is provided for each diver
    for item in req.unitItems:
        has_contact_or_id = bool(
            (item.diverEmail and item.diverEmail.strip())
            or (item.diverPhone and item.diverPhone.strip())
            or (item.passportNumber and item.passportNumber.strip())
            or (
                req.contact
                and (
                    (req.contact.email and req.contact.email.strip())
                    or (req.contact.phone and req.contact.phone.strip())
                )
            )
        )
        if not has_contact_or_id:
            raise HTTPException(
                status_code=400,
                detail=f"At least one of Email, Phone, or Passport/National ID is required for participant '{item.diverFullName or 'Guest Diver'}'.",
            )

    currency = units[0].currency if units else "EUR"
    total_amount = 0.0
    for item in req.unitItems:
        unit = unit_map[item.unitId]
        # Ignore client-controlled package flags; tier comes from DB unit only
        sizing = dict(item.equipmentSizing or {})
        sizing.pop("is_rental_package", None)
        pricing_calc = compute_participant_octo_pricing(
            center_settings=settings,
            unit=unit,
            equipment_sizing=sizing,
            currency=currency,
        )
        total_amount += pricing_calc["total_due"]
    total_amount = round(total_amount, 2)

    # Decrement seats in slot
    slot.seats_available -= needed_seats

    booking_uuid = str(uuid.uuid4())
    expiration = datetime.now(UTC) + timedelta(minutes=hold_minutes)

    # Only attach authenticated session user — never bind by unverified contact email
    user_id = current_user.id if current_user else None

    booking = OctoBooking(
        uuid=booking_uuid,
        user_id=user_id,
        diving_center_id=product.diving_center_id,
        product_id=product.id,
        option_id=slot.option_id,
        availability_id=slot.id,
        status="ON_HOLD",
        utc_hold_expiration=expiration,
        total_amount=total_amount,
        currency=currency,
        contact_full_name=req.contact.fullName if req.contact else None,
        contact_email=req.contact.email if req.contact else None,
        contact_phone=req.contact.phone if req.contact else None,
        booking_notes=req.notes,
    )
    db.add(booking)
    db.flush()

    access_token_raw = mint_booking_access_token(booking, expiration)

    response_items = []
    claim_invite_tokens: List[OctoClaimInviteTokenResponse] = []
    for seat_index, item in enumerate(req.unitItems):
        item_id = str(uuid.uuid4())
        parsed_dob = None
        if item.dateOfBirth:
            try:
                parsed_dob = datetime.strptime(
                    item.dateOfBirth.strip(), "%Y-%m-%d"
                ).date()
            except Exception:
                pass

        unit_item = OctoBookingUnitItem(
            id=item_id,
            booking_uuid=booking.uuid,
            unit_id=item.unitId,
            diver_full_name=item.diverFullName or "Guest Diver",
            diver_email=item.diverEmail,
            diver_phone=item.diverPhone,
            diver_nationality=item.diverNationality,
            passport_number=item.passportNumber,
            date_of_birth=parsed_dob,
            certification_agency=item.certificationAgency,
            certification_level=item.certificationLevel,
            certification_number=item.certificationNumber,
            selected_tank_id=item.selectedTankId or "12",
            selected_gas_mix_id=item.selectedGasMixId or "air",
            equipment_sizing=item.equipmentSizing,
        )
        db.add(unit_item)
        if seat_index > 0:
            claim_raw = mint_claim_token(unit_item)
            claim_invite_tokens.append(
                OctoClaimInviteTokenResponse(unitItemId=item_id, claimToken=claim_raw)
            )
        response_items.append(
            OctoBookingUnitItemResponse(
                id=item_id,
                unitId=item.unitId,
                diverFullName=unit_item.diver_full_name,
                diverEmail=unit_item.diver_email,
                diverPhone=unit_item.diver_phone,
                dateOfBirth=str(unit_item.date_of_birth)
                if unit_item.date_of_birth
                else None,
                certificationAgency=unit_item.certification_agency,
                certificationLevel=unit_item.certification_level,
                waiversComplete=False,
            )
        )

    db.commit()

    return OctoBookingResponse(
        uuid=booking.uuid,
        status=booking.status,
        utcHoldExpiration=expiration.isoformat(),
        totalAmount=total_amount,
        currency=currency,
        contact=req.contact,
        unitItems=response_items,
        accessToken=access_token_raw,
        claimInviteTokens=claim_invite_tokens if claim_invite_tokens else None,
    )


@router.get("/bookings/{booking_uuid}", response_model=OctoBookingResponse)
def get_booking_details(
    booking_uuid: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    x_booking_access_token: Optional[str] = Header(
        None, alias="X-Booking-Access-Token"
    ),
    access_token: Optional[str] = Query(None),
):
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    require_booking_principal(
        booking,
        current_user,
        extract_access_token(x_booking_access_token, access_token),
    )

    items = [
        OctoBookingUnitItemResponse(
            id=item.id,
            unitId=item.unit_id,
            diverFullName=item.diver_full_name,
            diverEmail=item.diver_email,
            diverPhone=item.diver_phone,
            certificationAgency=item.certification_agency,
            certificationLevel=item.certification_level,
            waiversComplete=item.waivers_complete,
        )
        for item in booking.unit_items
    ]

    return OctoBookingResponse(
        uuid=booking.uuid,
        status=booking.status,
        utcHoldExpiration=booking.utc_hold_expiration.isoformat()
        if booking.utc_hold_expiration
        else None,
        totalAmount=float(booking.total_amount),
        currency=booking.currency,
        contact=OctoContactSchema(
            fullName=booking.contact_full_name,
            email=booking.contact_email,
            phone=booking.contact_phone,
        ),
        unitItems=items,
    )


@router.post("/bookings/{booking_uuid}/confirm", response_model=OctoBookingResponse)
def confirm_booking(
    booking_uuid: str,
    req: Optional[OctoConfirmBookingRequest] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    x_booking_access_token: Optional[str] = Header(
        None, alias="X-Booking-Access-Token"
    ),
    access_token: Optional[str] = Query(None),
):
    booking = (
        db.query(OctoBooking)
        .options(
            joinedload(OctoBooking.slot).joinedload(OctoAvailabilitySlot.dive_trip)
        )
        .filter(OctoBooking.uuid == booking_uuid)
        .with_for_update()
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    require_booking_principal(
        booking,
        current_user,
        extract_access_token(x_booking_access_token, access_token),
    )

    if booking.status != "ON_HOLD":
        raise HTTPException(
            status_code=400,
            detail=f"Only ON_HOLD bookings can be confirmed (current status: {booking.status})",
        )

    now = datetime.now(UTC)
    if booking.utc_hold_expiration:
        exp = booking.utc_hold_expiration
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
        if exp < now:
            booking.status = "EXPIRED"
            db.commit()
            raise HTTPException(
                status_code=400, detail="Hold has expired and cannot be confirmed"
            )

    if req and req.contact:
        if req.contact.fullName:
            booking.contact_full_name = req.contact.fullName
        if req.contact.email:
            booking.contact_email = req.contact.email
        if req.contact.phone:
            booking.contact_phone = req.contact.phone
    if req and req.notes:
        booking.booking_notes = req.notes

    # Only bind authenticated session user; never attach by unverified contact email
    if not booking.user_id and current_user:
        booking.user_id = current_user.id

    booking.status = "CONFIRMED"
    booking.utc_hold_expiration = None
    extend_access_token_for_voucher_window(booking)
    bump_linked_trip_current_bookings(booking, len(booking.unit_items or []))

    db.commit()
    db.refresh(booking)

    items = [
        OctoBookingUnitItemResponse(
            id=item.id,
            unitId=item.unit_id,
            diverFullName=item.diver_full_name,
            diverEmail=item.diver_email,
            diverPhone=item.diver_phone,
            certificationAgency=item.certification_agency,
            certificationLevel=item.certification_level,
            waiversComplete=item.waivers_complete,
        )
        for item in booking.unit_items
    ]

    return OctoBookingResponse(
        uuid=booking.uuid,
        status=booking.status,
        utcHoldExpiration=None,
        totalAmount=float(booking.total_amount),
        currency=booking.currency,
        contact=OctoContactSchema(
            fullName=booking.contact_full_name,
            email=booking.contact_email,
            phone=booking.contact_phone,
        ),
        unitItems=items,
    )


@router.post("/bookings/{booking_uuid}/cancel", response_model=OctoBookingResponse)
def cancel_booking(
    booking_uuid: str,
    req: Optional[OctoCancelBookingRequest] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    x_booking_access_token: Optional[str] = Header(
        None, alias="X-Booking-Access-Token"
    ),
    access_token: Optional[str] = Query(None),
):
    booking = (
        db.query(OctoBooking)
        .options(
            joinedload(OctoBooking.slot).joinedload(OctoAvailabilitySlot.dive_trip)
        )
        .filter(OctoBooking.uuid == booking_uuid)
        .with_for_update()
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    require_booking_principal(
        booking,
        current_user,
        extract_access_token(x_booking_access_token, access_token),
    )

    from app.routers.center_booking_ops import reconcile_slot_seats

    prev_status = booking.status
    if prev_status != "CANCELLED":
        slot = (
            db.query(OctoAvailabilitySlot)
            .filter(OctoAvailabilitySlot.id == booking.availability_id)
            .with_for_update()
            .first()
        )

        if prev_status == "CONFIRMED":
            bump_linked_trip_current_bookings(booking, -len(booking.unit_items or []))

        booking.status = "CANCELLED"
        if req and req.reason:
            booking.cancellation_reason = req.reason
        booking.utc_hold_expiration = None
        clear_booking_access_token(booking)

        # Recompute seats under lock. EXPIRED holds already returned seats via reconcile —
        # never blind-increment. ON_HOLD/CONFIRMED are excluded once status is CANCELLED.
        if slot and prev_status in ("ON_HOLD", "CONFIRMED", "EXPIRED"):
            reconcile_slot_seats(db, slot, commit=False, already_locked=True)

        db.commit()
        db.refresh(booking)

    items = [
        OctoBookingUnitItemResponse(
            id=item.id,
            unitId=item.unit_id,
            diverFullName=item.diver_full_name,
            diverEmail=item.diver_email,
            diverPhone=item.diver_phone,
            certificationAgency=item.certification_agency,
            certificationLevel=item.certification_level,
            waiversComplete=item.waivers_complete,
        )
        for item in booking.unit_items
    ]

    return OctoBookingResponse(
        uuid=booking.uuid,
        status=booking.status,
        utcHoldExpiration=None,
        totalAmount=float(booking.total_amount),
        currency=booking.currency,
        contact=OctoContactSchema(
            fullName=booking.contact_full_name,
            email=booking.contact_email,
            phone=booking.contact_phone,
        ),
        unitItems=items,
    )


@router.post("/bookings/{booking_uuid}/extend", response_model=OctoBookingResponse)
def extend_booking_hold(
    booking_uuid: str,
    req: Optional[OctoExtendBookingRequest] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    x_booking_access_token: Optional[str] = Header(
        None, alias="X-Booking-Access-Token"
    ),
    access_token: Optional[str] = Query(None),
):
    booking = db.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    if not booking or booking.status != "ON_HOLD":
        raise HTTPException(
            status_code=400, detail="Only ON_HOLD bookings can be extended"
        )

    require_booking_principal(
        booking,
        current_user,
        extract_access_token(x_booking_access_token, access_token),
    )

    extra_minutes = req.expirationMinutes if req and req.expirationMinutes else 20
    new_exp = datetime.now(UTC) + timedelta(minutes=extra_minutes)
    booking.utc_hold_expiration = new_exp
    if booking.access_token_hash:
        booking.access_token_expires_at = new_exp
    db.commit()
    db.refresh(booking)

    return get_booking_details(
        booking.uuid,
        db,
        current_user,
        x_booking_access_token,
        access_token,
    )
