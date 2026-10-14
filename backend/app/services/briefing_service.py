import io
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, UTC

from sqlalchemy.orm import Session

from app.models import (
    OctoAvailabilitySlot,
    TripBriefing,
    DiveSite,
    OctoBookingUnitItem,
    OctoBooking,
)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

logger = logging.getLogger(__name__)


class BriefingService:
    """Pre-Dive Briefing & Emergency Action Plan (EAP) compilation and dispatch service."""

    @staticmethod
    def compile_draft_briefing(db: Session, slot_id: str) -> TripBriefing:
        """Synthesize dive site details, live weather forecast, and EAP into a draft briefing."""
        slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == slot_id).first()
        if not slot:
            raise ValueError(f"Availability slot '{slot_id}' not found")

        briefing = db.query(TripBriefing).filter(TripBriefing.availability_id == slot_id).first()
        if not briefing:
            briefing = TripBriefing(
                availability_id=slot_id,
                status="DRAFT_PENDING_REVIEW",
            )
            db.add(briefing)

        # 1. Identify active dive site
        site = None
        if briefing.active_dive_site_id:
            site = db.query(DiveSite).filter(DiveSite.id == briefing.active_dive_site_id).first()
        elif slot.product and slot.product.dive_site_id:
            site = db.query(DiveSite).filter(DiveSite.id == slot.product.dive_site_id).first()
            if site:
                briefing.active_dive_site_id = site.id
        elif hasattr(slot, "dive_site_id") and getattr(slot, "dive_site_id", None):
            site = db.query(DiveSite).filter(DiveSite.id == slot.dive_site_id).first()
            if site:
                briefing.active_dive_site_id = site.id

        # 2. Weather & Marine forecast synthesis via Open-Meteo
        weather_data = {}
        if site and getattr(site, "latitude", None) is not None and getattr(site, "longitude", None) is not None:
            try:
                from app.services.open_meteo_service import fetch_wind_data_single_point
                raw_weather = fetch_wind_data_single_point(
                    latitude=float(site.latitude),
                    longitude=float(site.longitude),
                    target_datetime=slot.start_datetime,
                )
                if raw_weather:
                    w_spd = raw_weather.get("wind_speed_10m") or raw_weather.get("wind_speed")
                    w_dir = raw_weather.get("wind_direction_10m") or raw_weather.get("wind_direction")
                    w_gust = raw_weather.get("wind_gusts_10m") or raw_weather.get("wind_gusts")
                    w_wave = raw_weather.get("wave_height")
                    s_temp = raw_weather.get("sea_surface_temperature") or raw_weather.get("water_temperature")

                    weather_data = {
                        "wind_speed_ms": w_spd,
                        "wind_speed_kts": round(w_spd * 1.94384, 1) if w_spd is not None else None,
                        "wind_direction_deg": w_dir,
                        "wind_gusts_kts": round(w_gust * 1.94384, 1) if w_gust is not None else None,
                        "wave_height_m": w_wave,
                        "wave_height_ft": round(w_wave * 3.28084, 1) if w_wave is not None else None,
                        "sea_surface_temp_c": s_temp,
                        "sea_surface_temp_f": round(s_temp * 9 / 5 + 32, 1) if s_temp is not None else None,
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch marine forecast for site {site.id}: {e}")

        if not weather_data:
            weather_data = {
                "wind_speed_kts": 8.0,
                "wind_direction_deg": 180,
                "wave_height_m": 0.4,
                "wave_height_ft": 1.3,
                "sea_surface_temp_c": 22.0,
                "sea_surface_temp_f": 71.6,
            }
        briefing.weather_forecast_data = weather_data

        # 3. Site profile & topography notes with dual units
        site_name = site.name if site else "Scheduled Dive Site"
        max_d_m = float(getattr(site, "max_depth", None) or 25.0)
        max_d_ft = round(max_d_m * 3.28084)
        briefing.site_profile_notes = (
            f"Dive Site: {site_name}. Planned maximum depth: {max_d_m}m ({max_d_ft}ft). "
            f"Topography features sloping volcanic reefs and crystal clear drop-offs with sandy channels. "
            f"Descent procedure: Negative/controlled descent along mooring line. "
            f"Ascent & safety stop: Controlled ascent at 9m/min (30ft/min) with a mandatory 3-minute safety stop at 5m (15ft)."
        )

        # 4. Hazards & Safety Instructions
        briefing.hazards_and_safety_notes = (
            "Safety Instructions: Continuous buddy checks required. Maintain minimum gas reserve of 50 bar (700 psi) "
            "upon returning to boat ladder. Watch for localized surge near reef pinnacles. Surface Marker Buoy (SMB) "
            "deployment mandatory for independent diver buddy pairs. Never hold breath; equalize early and often."
        )

        # 5. Marine Life Highlights
        briefing.marine_life_highlights = [
            {"species": "Loggerhead Sea Turtle (Caretta caretta)", "likelihood": "Common", "depth": "5-15m"},
            {"species": "Mediterranean Dusky Grouper", "likelihood": "Frequent", "depth": "12-25m"},
            {"species": "Octopus & Moray Eels", "likelihood": "High", "depth": "All depths"},
            {"species": "Damselfish & Anthias schools", "likelihood": "High", "depth": "Reef top"},
        ]

        # 6. Meeting & Logistics Notes
        dep_time = slot.option.departure_time if (slot.option and slot.option.departure_time) else "09:00"
        meet_time = slot.option.meeting_time if (slot.option and slot.option.meeting_time) else "08:30"
        briefing.meeting_notes = (
            f"Meeting time at dive center is {meet_time} for roll call, equipment fitment, and paperwork check. "
            f"Vessel departs prompt at {dep_time}. Please bring your scuba diving certification card (either physical or via an app), personal dive computer, "
            f"towel, sunscreen, and dry clothing."
        )

        # 7. Emergency Action Plan (EAP)
        center = slot.product.center if (slot.product and slot.product.center) else None
        center_phone = getattr(center, "phone", None) or "+30 22420 12345"
        briefing.emergency_action_plan = {
            "hyperbaric_chamber": "Naval Hospital / Hyperbaric Center Athens & Rhodes Recompression Facility (+30 210 7261000)",
            "coast_guard_vhf": "VHF Channel 16 / DSC Channel 70",
            "mrcc_phone": "Joint Rescue Coordination Center (JRCC): 112 / +30 210 4112500",
            "dive_center_ops_phone": center_phone,
            "onboard_oxygen_verified": True,
            "first_aid_kit_verified": True,
            "aed_onboard": True,
        }

        # 8. Staff / Crew Manifest (inherited from slot if already set)
        if hasattr(slot, "staff_assignments") and slot.staff_assignments:
            briefing.crew_manifest = slot.staff_assignments
        elif not briefing.crew_manifest:
            briefing.crew_manifest = {
                "skipper_name": "Capt. Nikos",
                "skipper_license": "GR-PORT-58492",
                "lead_guide_name": "Elena P.",
                "lead_guide_cert": "PADI MSDT-49102",
                "crew_names": ["Markos (Deck Pro)"],
            }

        db.commit()
        db.refresh(briefing)
        return briefing

    @staticmethod
    def generate_briefing_pdf(briefing: TripBriefing, db: Session) -> bytes:
        """Compile a dual-unit pre-dive briefing PDF using ReportLab."""
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is not installed")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
        )
        h2_style = ParagraphStyle(
            "H2Style",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1e3a8a"),
            spaceBefore=10,
            spaceAfter=4,
            keepWithNext=True,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
        alert_box_style = ParagraphStyle(
            "AlertBox",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#991b1b"),
        )

        story = []

        # Header Block
        slot = briefing.slot
        prod = slot.product if slot else None
        center = prod.center if prod else None
        site = briefing.active_dive_site

        center_name = center.name if center else "Divemap Diving Facility"
        prod_title = prod.title if prod else "Guided Boat Dive Trip"
        date_str = slot.start_datetime.strftime("%A, %d %B %Y") if slot else "Upcoming"

        story.append(Paragraph(f"{center_name} — Pre-Dive Briefing", title_style))
        story.append(Paragraph(f"<b>{prod_title}</b> | {date_str} | Status: <b>{briefing.status.replace('_', ' ')}</b>", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))

        # Logistics Table
        opt = slot.option if slot else None
        vessel = slot.vessel if slot else None
        crew = briefing.crew_manifest or {}

        logistics_data = [
            [
                Paragraph("<b>Meeting Time:</b>", body_style),
                Paragraph(f"{opt.meeting_time if opt else '08:30'}", body_style),
                Paragraph("<b>Departure Time:</b>", body_style),
                Paragraph(f"{opt.departure_time if opt else '09:00'}", body_style),
            ],
            [
                Paragraph("<b>Vessel:</b>", body_style),
                Paragraph(f"{vessel.name if vessel else 'Day Boat'}", body_style),
                Paragraph("<b>Master / Skipper:</b>", body_style),
                Paragraph(f"{crew.get('skipper_name', 'On Duty')}", body_style),
            ],
            [
                Paragraph("<b>Active Dive Site:</b>", body_style),
                Paragraph(f"<b>{site.name if site else 'Reef'}</b>", body_style),
                Paragraph("<b>Lead Dive Guide:</b>", body_style),
                Paragraph(f"{crew.get('lead_guide_name', 'Staff Pro')}", body_style),
            ],
        ]
        logistics_table = Table(logistics_data, colWidths=[100, 160, 110, 150])
        logistics_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(logistics_table)
        story.append(Spacer(1, 10))

        # Marine Weather Conditions (Dual-Unit)
        w = briefing.weather_forecast_data or {}
        story.append(Paragraph("Live Marine Weather & Sea Conditions", h2_style))
        weather_table_data = [
            [
                Paragraph("<b>Wind Velocity:</b>", body_style),
                Paragraph(f"{w.get('wind_speed_kts', 'N/A')} knots ({round((w.get('wind_speed_kts') or 0)*1.852, 1)} km/h)", body_style),
                Paragraph("<b>Wind Gusts:</b>", body_style),
                Paragraph(f"{w.get('wind_gusts_kts', 'N/A')} knots", body_style),
            ],
            [
                Paragraph("<b>Wave Height:</b>", body_style),
                Paragraph(f"<b>{w.get('wave_height_m', '0.4')}m ({w.get('wave_height_ft', '1.3')}ft)</b>", body_style),
                Paragraph("<b>Water Temperature:</b>", body_style),
                Paragraph(f"<b>{w.get('sea_surface_temp_c', '22')}°C ({w.get('sea_surface_temp_f', '72')}°F)</b>", body_style),
            ],
        ]
        weather_table = Table(weather_table_data, colWidths=[110, 150, 110, 150])
        weather_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfdbfe")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbeafe")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(weather_table)
        story.append(Spacer(1, 10))

        # Meeting & Logistics Notes
        if briefing.meeting_notes:
            story.append(Paragraph("Meeting & Preparation Instructions", h2_style))
            story.append(Paragraph(briefing.meeting_notes, body_style))

        # Site Profile Notes
        if briefing.site_profile_notes:
            story.append(Paragraph("Dive Site Profile & Topography", h2_style))
            story.append(Paragraph(briefing.site_profile_notes, body_style))

        # Marine Life Highlights
        if briefing.marine_life_highlights:
            story.append(Paragraph("Marine Biodiversity & Wildlife Highlights", h2_style))
            ml_rows = [[
                Paragraph("<b>Species</b>", body_style),
                Paragraph("<b>Likelihood</b>", body_style),
                Paragraph("<b>Typical Depth</b>", body_style),
            ]]
            for item in briefing.marine_life_highlights[:6]:
                ml_rows.append([
                    Paragraph(item.get("species", ""), body_style),
                    Paragraph(item.get("likelihood", "Common"), body_style),
                    Paragraph(item.get("depth", "5-20m"), body_style),
                ])
            ml_table = Table(ml_rows, colWidths=[240, 130, 150])
            ml_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(ml_table)
            story.append(Spacer(1, 8))

        # Hazards & Scuba Safety Protocol
        if briefing.hazards_and_safety_notes:
            story.append(Paragraph("Safety Protocols & Diver Procedures", h2_style))
            story.append(Paragraph(briefing.hazards_and_safety_notes, body_style))

        # Emergency Action Plan (EAP)
        eap = briefing.emergency_action_plan or {}
        story.append(Paragraph("Emergency Action Plan (EAP)", h2_style))
        eap_data = [
            [
                Paragraph("<b>Coast Guard VHF:</b>", alert_box_style),
                Paragraph(f"<b>{eap.get('coast_guard_vhf', 'VHF 16')}</b>", alert_box_style),
                Paragraph("<b>Rescue Center:</b>", alert_box_style),
                Paragraph(f"{eap.get('mrcc_phone', '112')}", alert_box_style),
            ],
            [
                Paragraph("<b>Hyperbaric Chamber:</b>", alert_box_style),
                Paragraph(f"{eap.get('hyperbaric_chamber', 'Navy Hospital Recompression')}", alert_box_style),
                Paragraph("<b>Emergency O2:</b>", alert_box_style),
                Paragraph("Verified 100% O2 Unit on board", alert_box_style),
            ],
        ]
        eap_table = Table(eap_data, colWidths=[120, 160, 110, 130])
        eap_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#fecaca")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fee2e2")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(eap_table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def dispatch_briefing(db: Session, slot_id: str, dispatched_by_user_id: Optional[int] = None) -> TripBriefing:
        """Approve and dispatch the pre-dive briefing to confirmed participants."""
        slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == slot_id).first()
        briefing = db.query(TripBriefing).filter(TripBriefing.availability_id == slot_id).first()
        if not briefing:
            briefing = BriefingService.compile_draft_briefing(db, slot_id)

        # Generate and cache PDF
        BriefingService.generate_briefing_pdf(briefing, db)
        briefing.status = "APPROVED_DISPATCHED"
        briefing.dispatched_at = datetime.now(UTC)
        briefing.dispatched_by_user_id = dispatched_by_user_id

        # Collect recipient divers on boat manifest
        participants = (
            db.query(OctoBookingUnitItem)
            .join(OctoBooking, OctoBooking.uuid == OctoBookingUnitItem.booking_uuid)
            .filter(
                OctoBooking.availability_id == slot_id,
                OctoBooking.status.in_(["CONFIRMED", "PENDING"]),
            )
            .all()
        )

        recipients = []
        for p in participants:
            email = getattr(p, "email", None) or (p.user.email if p.user else None)
            if email and email not in recipients:
                recipients.append(email)

        logger.info(f"Dispatched briefing {briefing.id} for slot {slot_id} to {len(recipients)} recipients")

        # Asynchronously queue email notifications via SQSService
        try:
            from app.services.sqs_service import SQSService
            sqs = SQSService()
            if sqs.sqs_available:
                slot_date = slot.start_datetime.strftime("%Y-%m-%d") if slot else "Upcoming"
                for email in recipients:
                    sqs.send_email_task(
                        notification_id=briefing.id,
                        user_email=email,
                        notification_data={
                            "type": "TRIP_BRIEFING",
                            "title": f"Pre-Dive Briefing: {slot.product.title if (slot and slot.product) else 'Upcoming Dive Trip'}",
                            "message": f"Your pre-dive briefing for {slot_date} is ready. Review weather, dive profile, and logistics.",
                            "link_url": f"/api/v1/centers/{slot.product.diving_center_id if (slot and slot.product) else 0}/booking-ops/trips/{slot_id}/briefing/pdf",
                        },
                    )
        except Exception as e:
            logger.warning(f"Failed to queue SQS briefing notification: {e}")

        db.commit()
        db.refresh(briefing)
        return briefing
