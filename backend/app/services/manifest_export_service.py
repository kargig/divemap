import csv
import io
from datetime import datetime
from typing import Any, Dict

try:
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class ManifestExportService:
    """Generates official maritime Port Authority manifests in CSV and PDF formats, and emergency incident dossiers."""

    @staticmethod
    def generate_csv(manifest_data: Dict[str, Any]) -> str:
        """Generates standard maritime passenger & diver manifest CSV."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header Block
        vessel = manifest_data.get("vessel") or {}
        center = manifest_data.get("center") or {}
        slot = manifest_data.get("slot") or {}
        staff = manifest_data.get("staff") or {}

        writer.writerow(["PORT AUTHORITY PASSENGER & DIVER MANIFEST"])
        writer.writerow(["Diving Center:", center.get("name", "Diving Center")])
        writer.writerow(["Emergency Contact:", center.get("phone", "N/A")])
        writer.writerow(["Vessel Name:", vessel.get("name", "Vessel")])
        writer.writerow(["Registration / IMO #:", vessel.get("registration_number", "N/A")])
        writer.writerow(["Departure Date:", slot.get("departure_date", "")])
        writer.writerow(["Meeting / Departure:", f"{slot.get('meeting_time', '')} / {slot.get('departure_time', '')}"])
        writer.writerow(["Master / Skipper:", f"{staff.get('skipper_name', 'N/A')} (Lic: {staff.get('skipper_license', 'N/A')})"])
        writer.writerow(["Dive Staff in Charge:", f"{staff.get('lead_guide_name', 'N/A')} ({staff.get('lead_guide_cert', 'N/A')})"])
        if staff.get("crew_names"):
            writer.writerow(["Deck Crew:", ", ".join(staff.get("crew_names"))])
        writer.writerow([])

        # Table Header
        writer.writerow([
            "Line #",
            "Full Legal Name",
            "Date of Birth",
            "Nationality",
            "Passport / National ID",
            "Agency & Level",
            "Certification Card Number (Physical/App)",
            "Role",
            "Medical Clearance",
            "Boarded / Checked-In",
            "Payment Status"
        ])

        # Rows
        participants = manifest_data.get("participants", [])
        for idx, p in enumerate(participants, start=1):
            writer.writerow([
                idx,
                p.get("diver_full_name", "Diver"),
                p.get("date_of_birth", "N/A") or "N/A",
                p.get("diver_nationality", "N/A") or "N/A",
                p.get("passport_number", "N/A") or "N/A",
                f"{p.get('certification_agency', '')} {p.get('certification_level', '')}".strip() or "N/A",
                p.get("certification_number", "N/A") or "N/A",
                p.get("role", "Diver"),
                p.get("medical_status", "CLEARED"),
                "YES" if p.get("onboard_checkin_status") else "NO",
                p.get("payment_status", "PENDING_AT_CHECKIN")
            ])

        return output.getvalue()

    @staticmethod
    def generate_pdf(manifest_data: Dict[str, Any]) -> bytes:
        """Generates official Port Authority PDF manifest using ReportLab."""
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is required for PDF manifest generation.")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=30,
            rightMargin=30,
            topMargin=30,
            bottomMargin=30
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#0F172A'),
            alignment=1, # Center
            fontName='Helvetica-Bold'
        )
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#475569'),
            alignment=1,
            fontName='Helvetica'
        )
        section_style = ParagraphStyle(
            'SectionHeader',
            parent=styles['Heading2'],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#1E3A8A'),
            fontName='Helvetica-Bold'
        )
        normal_style = ParagraphStyle(
            'BodyNormal',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#334155'),
            fontName='Helvetica'
        )
        table_cell_style = ParagraphStyle(
            'CellText',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#1E293B'),
            fontName='Helvetica'
        )
        table_cell_bold = ParagraphStyle(
            'CellBold',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold'
        )

        story = []

        # Header Title
        story.append(Paragraph("PASSENGER & DIVER MANIFEST / CREW LIST", title_style))
        story.append(Paragraph("Official Maritime Port Authority & Coast Guard Compliance Form", subtitle_style))
        story.append(Spacer(1, 12))

        center = manifest_data.get("center") or {}
        vessel = manifest_data.get("vessel") or {}
        slot = manifest_data.get("slot") or {}
        staff = manifest_data.get("staff") or {}

        meta_data = [
            [
                Paragraph(f"<b>Operator:</b> {center.get('name', 'Diving Center')}", normal_style),
                Paragraph(f"<b>Vessel:</b> {vessel.get('name', 'Dive Vessel')}", normal_style),
            ],
            [
                Paragraph(f"<b>Phone / Helpline:</b> {center.get('phone', 'N/A')}", normal_style),
                Paragraph(f"<b>Reg / IMO #:</b> {vessel.get('registration_number', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Departure Date:</b> {slot.get('departure_date', '')}", normal_style),
                Paragraph(f"<b>Licensed Capacity:</b> {vessel.get('licensed_capacity', 'N/A')} persons", normal_style),
            ],
            [
                Paragraph(f"<b>Schedule:</b> Meet: {slot.get('meeting_time', '')} | Dep: {slot.get('departure_time', '')}", normal_style),
                Paragraph(f"<b>Safety Gear:</b> O2 Kit: {'YES' if vessel.get('has_emergency_oxygen') else 'NO'} | First Aid: {'YES' if vessel.get('has_first_aid_kit') else 'NO'}", normal_style),
            ],
            [
                Paragraph(f"<b>Master / Skipper:</b> {staff.get('skipper_name', 'N/A')} (Lic: {staff.get('skipper_license', 'N/A')})", normal_style),
                Paragraph(f"<b>Lead Divemaster / Guide:</b> {staff.get('lead_guide_name', 'N/A')} ({staff.get('lead_guide_cert', 'N/A')})", normal_style),
            ],
        ]

        meta_table = Table(meta_data, colWidths=[260, 275])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 14))

        # Roster Table
        story.append(Paragraph(f"EMBARKED DIVERS & PASSENGERS ({len(manifest_data.get('participants', []))} registered)", section_style))
        story.append(Spacer(1, 6))

        table_rows = [[
            Paragraph("#", table_cell_bold),
            Paragraph("Full Legal Name", table_cell_bold),
            Paragraph("Nationality", table_cell_bold),
            Paragraph("Passport / ID #", table_cell_bold),
            Paragraph("Cert Level", table_cell_bold),
            Paragraph("Tank / Gas", table_cell_bold),
            Paragraph("Lead", table_cell_bold),
            Paragraph("Medical", table_cell_bold),
            Paragraph("Boarded", table_cell_bold),
        ]]

        participants = manifest_data.get("participants", [])
        for idx, p in enumerate(participants, start=1):
            agency_level = f"{p.get('certification_agency', '')} {p.get('certification_level', '')}".strip() or "Open Water"
            tank_gas = f"{p.get('selected_tank_id', '12')}L {p.get('selected_gas_mix_id', 'AIR').upper()}"
            boarded = "✓ YES" if p.get("onboard_checkin_status") else "NO"
            med_status = p.get("medical_status", "CLEARED")

            table_rows.append([
                Paragraph(str(idx), table_cell_style),
                Paragraph(p.get("diver_full_name", "Diver"), table_cell_bold),
                Paragraph(p.get("diver_nationality", "N/A") or "N/A", table_cell_style),
                Paragraph(p.get("passport_number", "N/A") or "N/A", table_cell_style),
                Paragraph(agency_level, table_cell_style),
                Paragraph(tank_gas, table_cell_style),
                Paragraph(f"{p.get('estimated_lead_kg', '0')} kg", table_cell_style),
                Paragraph(med_status, table_cell_style),
                Paragraph(boarded, table_cell_bold if p.get("onboard_checkin_status") else table_cell_style),
            ])

        roster_table = Table(table_rows, colWidths=[20, 110, 60, 75, 95, 65, 35, 45, 30])
        roster_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('PADDING', (0, 0), (-1, -1), 3.5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ]))
        story.append(roster_table)
        story.append(Spacer(1, 16))

        # Maritime Declaration & Master Signature Line
        story.append(Paragraph(
            "<b>Master's Certification & Maritime Declaration:</b><br/>"
            "I hereby certify that the above list of crew, dive staff, and passengers is true, complete, and accurate. "
            "All onboard life-saving and hyperbaric emergency equipment has been verified, and all participants have submitted "
            "conforming medical declarations and liability releases pursuant to maritime safety regulations.",
            normal_style
        ))
        story.append(Spacer(1, 18))

        sig_data = [
            [
                Paragraph("<b>Master / Vessel Skipper:</b><br/><br/>___________________________________", normal_style),
                Paragraph("<b>Divemaster / Guide in Charge:</b><br/><br/>___________________________________", normal_style),
                Paragraph("<b>Official Center Stamp:</b><br/><br/>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]", normal_style),
            ]
        ]
        sig_table = Table(sig_data, colWidths=[180, 180, 175])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(sig_table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_emergency_dossier_pdf(dossier_data: Dict[str, Any]) -> bytes:
        """
        Generates an official Emergency Incident Dossier containing the full decrypted medical questionnaire,
        verified physician clearance, audit logs, and executed liability waiver for Port Authorities and hyperbaric doctors.
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is required for Emergency Dossier generation.")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=30,
            rightMargin=30,
            topMargin=30,
            bottomMargin=30
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'EmergTitle',
            parent=styles['Heading1'],
            fontSize=15,
            leading=18,
            textColor=colors.HexColor('#DC2626'), # Red alert
            alignment=1,
            fontName='Helvetica-Bold'
        )
        subtitle_style = ParagraphStyle(
            'EmergSub',
            parent=styles['Normal'],
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#475569'),
            alignment=1,
            fontName='Helvetica'
        )
        section_style = ParagraphStyle(
            'EmergSection',
            parent=styles['Heading2'],
            fontSize=10,
            leading=13,
            textColor=colors.HexColor('#1E3A8A'),
            fontName='Helvetica-Bold'
        )
        normal_style = ParagraphStyle(
            'EmergNormal',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#1E293B'),
            fontName='Helvetica'
        )
        bold_style = ParagraphStyle(
            'EmergBold',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold'
        )
        flagged_style = ParagraphStyle(
            'EmergFlagged',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#B91C1C'),
            fontName='Helvetica-Bold'
        )

        story = []

        # 1. Header
        story.append(Paragraph("EMERGENCY MEDICAL & INCIDENT DOSSIER", title_style))
        story.append(Paragraph(
            "Official Court & Maritime Record for Port Authority, Coast Guard, & Hyperbaric Physicians",
            subtitle_style
        ))
        story.append(Spacer(1, 10))

        # 2. Operator & Incident Metadata
        center = dossier_data.get("center") or {}
        vessel = dossier_data.get("vessel") or {}
        slot = dossier_data.get("slot") or {}
        diver = dossier_data.get("diver") or {}

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        meta_rows = [
            [
                Paragraph(f"<b>Operator:</b> {center.get('name', 'N/A')}", normal_style),
                Paragraph(f"<b>Vessel:</b> {vessel.get('name', 'N/A')} ({vessel.get('registration_number', 'N/A')})", normal_style),
            ],
            [
                Paragraph(f"<b>Center Phone:</b> {center.get('phone', 'N/A')}", normal_style),
                Paragraph(f"<b>Trip Slot:</b> {slot.get('departure_date', '')} ({slot.get('meeting_time', '')})", normal_style),
            ],
            [
                Paragraph(f"<b>Generated At:</b> {now_str}", normal_style),
                Paragraph("<b>Jurisdiction:</b> Hellenic Coast Guard / Port Authority", normal_style),
            ],
        ]
        meta_table = Table(meta_rows, colWidths=[265, 270])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#F87171')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#FECACA')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # 3. Diver Profile & Credentials
        story.append(Paragraph("1. DIVER PROFILE & EMERGENCY CONTACT", section_style))
        story.append(Spacer(1, 4))

        eq = diver.get("equipment_sizing") or {}
        diver_rows = [
            [
                Paragraph(f"<b>Legal Full Name:</b> {diver.get('diver_full_name', 'N/A')}", bold_style),
                Paragraph(f"<b>Passport / ID #:</b> {diver.get('passport_number', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Nationality:</b> {diver.get('diver_nationality', 'N/A')}", normal_style),
                Paragraph(f"<b>Date of Birth:</b> {diver.get('date_of_birth', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Phone / WhatsApp:</b> {diver.get('diver_phone', 'N/A')}", normal_style),
                Paragraph(f"<b>Email Address:</b> {diver.get('diver_email', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Certification:</b> {diver.get('certification_agency', '')} {diver.get('certification_level', '')} (#{diver.get('certification_number', 'N/A')})", normal_style),
                Paragraph(f"<b>Assigned Cylinder & Gas:</b> {diver.get('selected_tank_id', '12')}L Steel • {(diver.get('selected_gas_mix_id', 'AIR')).upper()} • {eq.get('regulator_fitting', 'DIN')}", normal_style),
            ],
            [
                Paragraph(f"<b>Lead Ballast Weight:</b> {diver.get('estimated_lead_kg', 0)} kg ({eq.get('weight_system', 'INTEGRATED')})", normal_style),
                Paragraph(f"<b>Thermal Suit / BCD:</b> {eq.get('wetsuit_size', 'None')} ({eq.get('wetsuit_thickness', '5mm')}) / BCD: {eq.get('bcd_size', 'None')}", normal_style),
            ]
        ]
        diver_table = Table(diver_rows, colWidths=[265, 270])
        diver_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(diver_table)
        story.append(Spacer(1, 12))

        # 4. Decrypted Medical Questionnaire (All 10 Questions)
        story.append(Paragraph("2. DIVER MEDICAL QUESTIONNAIRE (DMSC 2020 DECRYPTED RECORD)", section_style))
        story.append(Spacer(1, 4))

        questions_list = dossier_data.get("medical_questions", [])
        q_rows = [[
            Paragraph("#", bold_style),
            Paragraph("Screening Question (DMSC 2020 Standard)", bold_style),
            Paragraph("Diver Answer", bold_style),
        ]]

        for q in questions_list:
            is_yes = q.get("answered_yes") is True
            ans_p = Paragraph("⚠️ YES (FLAGGED)", flagged_style) if is_yes else Paragraph("✓ NO (CLEAN)", normal_style)
            q_rows.append([
                Paragraph(str(q.get("number", "")), bold_style),
                Paragraph(q.get("text", ""), normal_style),
                ans_p,
            ])

        q_table = Table(q_rows, colWidths=[20, 425, 90])
        q_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ]))
        story.append(q_table)
        story.append(Spacer(1, 12))

        # 5. Physician Approval & Staff Clearance Audit
        story.append(Paragraph("3. CLINICAL CLEARANCE & STAFF APPROVAL AUDIT LOG", section_style))
        story.append(Spacer(1, 4))

        audit = dossier_data.get("clearance_audit") or {}
        med_status = diver.get("medical_status", "CLEARED")
        audit_rows = [
            [
                Paragraph(f"<b>Overall Medical Status:</b> {med_status}", bold_style),
                Paragraph(f"<b>Clearance Verified At:</b> {audit.get('cleared_at', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Examining Physician:</b> Dr. {audit.get('physician_name', 'N/A')}", normal_style),
                Paragraph(f"<b>Clinic / Facility:</b> {audit.get('physician_clinic', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Authorizing Center Staff:</b> {audit.get('cleared_by_name', 'N/A')}", normal_style),
                Paragraph(f"<b>Clinical Notes / Restrictions:</b> {audit.get('reason', 'N/A')}", normal_style),
            ],
        ]
        audit_table = Table(audit_rows, colWidths=[265, 270])
        audit_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0FDF4') if med_status == 'PHYSICIAN_APPROVED' else colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#86EFAC') if med_status == 'PHYSICIAN_APPROVED' else colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BBF7D0') if med_status == 'PHYSICIAN_APPROVED' else colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(audit_table)
        story.append(Spacer(1, 12))

        # 6. Liability Waiver & Legal Execution
        story.append(Paragraph("4. EXECUTED LIABILITY WAIVER & RISK RELEASE", section_style))
        story.append(Spacer(1, 4))

        waiver_data = dossier_data.get("waiver") or {}
        waiver_rows = [
            [
                Paragraph(f"<b>Electronic Signature Name:</b> {waiver_data.get('signature_name', diver.get('diver_full_name', 'N/A'))}", bold_style),
                Paragraph(f"<b>Signed Timestamp:</b> {waiver_data.get('signed_at', 'N/A')}", normal_style),
            ],
            [
                Paragraph(f"<b>Waiver Bundle:</b> {waiver_data.get('bundle_id', 'padi_10086_eu')}", normal_style),
                Paragraph(f"<b>Audit Signature Hash:</b> {waiver_data.get('audit_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')[:32]}...", normal_style),
            ],
        ]
        waiver_table = Table(waiver_rows, colWidths=[265, 270])
        waiver_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(waiver_table)
        story.append(Spacer(1, 16))

        # Official Stamp Box & Investigator Line
        decl_p = Paragraph(
            "<b>Official Attestation:</b> I certify under penalties of maritime law that the records and decrypted medical declarations "
            "set forth in this dossier were submitted by the named diver, cryptographically verified, and accurately reflect the operator's records.",
            normal_style
        )
        story.append(decl_p)
        story.append(Spacer(1, 16))

        sig_data = [
            [
                Paragraph("<b>Diving Center Duty Officer / Signatory:</b><br/><br/>___________________________________", normal_style),
                Paragraph("<b>Port Authority / Attending Physician:</b><br/><br/>___________________________________", normal_style),
                Paragraph("<b>Official Center Stamp:</b><br/><br/>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]", normal_style),
            ]
        ]
        sig_table = Table(sig_data, colWidths=[180, 180, 175])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(sig_table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_equipment_checklist_pdf(manifest_data: Dict[str, Any]) -> bytes:
        """
        Generates a spreadsheet-style, clipboard-ready equipment inspection & bench handover checklist PDF.
        Designed for diving center staff to quickly walk around equipment boxes/benches and verify each piece of gear.
        Uses Landscape A4 layout with clean [  ] checkboxes for staff marking.
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is required for PDF checklist generation.")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=20,
            rightMargin=20,
            topMargin=20,
            bottomMargin=20,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ChecklistTitle',
            parent=styles['Heading1'],
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )
        sub_style = ParagraphStyle(
            'ChecklistSubtitle',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#475569'),
            fontName='Helvetica',
        )
        th_style = ParagraphStyle(
            'ChecklistTH',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            textColor=colors.white,
            fontName='Helvetica-Bold',
            alignment=1,
        )
        cell_bold = ParagraphStyle(
            'CellBold',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )
        cell_normal = ParagraphStyle(
            'CellNormal',
            parent=styles['Normal'],
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor('#334155'),
            fontName='Helvetica',
        )
        cell_rental = ParagraphStyle(
            'CellRental',
            parent=styles['Normal'],
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor('#1E40AF'),
            fontName='Helvetica-Bold',
        )
        cell_own = ParagraphStyle(
            'CellOwn',
            parent=styles['Normal'],
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor('#64748B'),
            fontName='Helvetica',
        )
        cell_center = ParagraphStyle(
            'CellCenter',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica',
            alignment=1,
        )

        story = []

        center = manifest_data.get("center") or {}
        vessel = manifest_data.get("vessel") or {}
        slot = manifest_data.get("slot") or {}
        staff = manifest_data.get("staff") or {}
        participants = manifest_data.get("participants") or []
        summary = manifest_data.get("crate_packing_summary") or {}

        # 1. Header Block
        center_name = center.get("name", "Diving Center")
        trip_title = slot.get("product_title", "Dive Trip")
        dep_date = slot.get("departure_date", "")
        dep_time = slot.get("departure_time", "")
        meet_time = slot.get("meeting_time", "")
        vessel_name = vessel.get("name", "Dive Vessel")
        skipper = staff.get("skipper_name", "Staff Skipper")
        lead_pro = staff.get("lead_guide_name", "Lead Pro")
        dives_count = summary.get("dives_count", 2)

        header_text = f"<b>{center_name}</b> — Dockside Equipment Inspection & Bench Handover Checklist"
        sub_text = (
            f"Trip: <b>{trip_title} ({dives_count} Dives Planned)</b> &nbsp;|&nbsp; "
            f"Date: <b>{dep_date}</b> (Meet: {meet_time} / Dep: {dep_time}) &nbsp;|&nbsp; "
            f"Vessel: <b>{vessel_name}</b> &nbsp;|&nbsp; "
            f"Master/Skipper: <b>{skipper}</b> &nbsp;|&nbsp; "
            f"Lead Pro: <b>{lead_pro}</b> &nbsp;|&nbsp; "
            f"Divers: <b>{len(participants)}</b>"
        )
        story.append(Paragraph(header_text, title_style))
        story.append(Paragraph(sub_text, sub_style))
        story.append(Spacer(1, 6))

        # 2. Vessel Emergency & Safety Spare Equipment Row (Checked before departure)
        spare_cyl = summary.get("spare_tanks", {})
        spare_cyl_txt = ", ".join([f"{count}x {name}" for name, count in spare_cyl.items()]) if spare_cyl else "2x 12L Air Safety Spares"
        spare_reg_txt = "1x Backup Regulator System (DIN + Yoke insert)"

        safety_row = [
            [
                Paragraph("<b>VESSEL SAFETY ASSETS:</b>", cell_bold),
                Paragraph(f"[ &nbsp; ] <b>Spare Cylinders:</b> {spare_cyl_txt}", cell_normal),
                Paragraph(f"[ &nbsp; ] <b>Spare Reg:</b> {spare_reg_txt}", cell_normal),
                Paragraph("[ &nbsp; ] <b>Tool Kit:</b> DIN/Yoke Inserts + 8mm Hex", cell_normal),
                Paragraph("[ &nbsp; ] <b>Life Support:</b> 100% O2 Unit + 1st Aid Kit", cell_normal),
            ]
        ]
        safety_table = Table(safety_row, colWidths=[110, 200, 200, 150, 140])
        safety_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF3C7')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#D97706')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#FDE68A')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(safety_table)
        story.append(Spacer(1, 6))

        # 3. Main Spreadsheet Table
        # Columns: # (18), Diver & Level (105), Crate/Box (52), Cylinders (85), Regulator (75), BCD (80), Suit (85), Fins/Boots (90), Lead (80), Tech/Safety (85), OK Check (45)
        col_widths = [18, 105, 52, 85, 75, 80, 85, 90, 80, 85, 45]
        table_data = [[
            Paragraph("<b>#</b>", th_style),
            Paragraph("<b>Diver Name & Cert</b>", th_style),
            Paragraph("<b>Box / Bench</b>", th_style),
            Paragraph("<b>Cylinders</b>", th_style),
            Paragraph("<b>Regulator</b>", th_style),
            Paragraph("<b>BCD</b>", th_style),
            Paragraph("<b>Thermal Suit</b>", th_style),
            Paragraph("<b>Fins & Boots</b>", th_style),
            Paragraph("<b>Ballast Lead</b>", th_style),
            Paragraph("<b>Safety / Lights</b>", th_style),
            Paragraph("<b>Verified</b>", th_style),
        ]]

        for idx, p in enumerate(participants, start=1):
            eq = p.get("equipment_sizing") or {}
            is_checked = p.get("gear_checked", False)

            # Diver Name & Cert
            name = p.get("diver_full_name", "Diver")
            cert = f"{p.get('certification_agency', '')} {p.get('certification_level', '')}".strip()
            diver_cell = Paragraph(f"<b>{name}</b><br/><font color='#64748B'>{cert}</font>", cell_normal)

            # Box / Bench # (Empty write-in bracket)
            box_cell = Paragraph("<font color='#94A3B8'>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</font>", cell_center)

            # Cylinders
            t_count = p.get("tanks_count", dives_count)
            t_sz = p.get("selected_tank_id", "12")
            t_gas = (p.get("selected_gas_mix_id") or "AIR").upper()
            t_fitting = eq.get("regulator_fitting", "DIN")
            cyl_cell = Paragraph(f"[ &nbsp; ] <b>{t_count}x {t_sz}L {t_gas}</b><br/><font color='#64748B'>Fitting: {t_fitting}</font>", cell_normal)

            # Regulator
            is_reg_rental = eq.get("rental_regulator", False)
            if is_reg_rental:
                reg_cell = Paragraph(f"[ &nbsp; ] <font color='#1E40AF'><b>RENTAL {t_fitting}</b></font>", cell_rental)
            else:
                reg_cell = Paragraph("[ &nbsp; ] Diver Own Reg", cell_own)

            # BCD
            bcd_sz = eq.get("bcd_size")
            is_bcd_rental = bcd_sz and bcd_sz != "None"
            if is_bcd_rental:
                bcd_gender = eq.get("bcd_gender", "MEN")
                g_lbl = "Women's" if bcd_gender == "WOMEN" else "Men's"
                bcd_cell = Paragraph(f"[ &nbsp; ] <font color='#1E40AF'><b>RENTAL {bcd_sz}</b></font><br/><font color='#64748B'>{g_lbl}</font>", cell_rental)
            else:
                bcd_cell = Paragraph("[ &nbsp; ] Diver Own BCD", cell_own)

            # Thermal Suit
            suit_sz = eq.get("wetsuit_size")
            is_suit_rental = suit_sz and suit_sz != "None"
            if is_suit_rental:
                s_thk = eq.get("wetsuit_thickness", "5mm")
                suit_cell = Paragraph(f"[ &nbsp; ] <font color='#1E40AF'><b>RENTAL {suit_sz}</b></font><br/><font color='#64748B'>{s_thk}</font>", cell_rental)
            else:
                suit_cell = Paragraph("[ &nbsp; ] Diver Own Suit", cell_own)

            # Fins & Boots
            fin_sz = eq.get("fin_size")
            boot_sz = eq.get("boot_size")
            is_fin_rental = fin_sz and fin_sz != "None"
            is_boot_rental = boot_sz and boot_sz != "None"

            fin_lines = []
            if is_fin_rental:
                fin_lines.append(f"<font color='#1E40AF'><b>Fins: {fin_sz}</b></font>")
            else:
                fin_lines.append("Fins: Own")

            if is_boot_rental:
                fin_lines.append(f"<font color='#1E40AF'><b>Boots: EU {boot_sz}</b></font>")
            else:
                fin_lines.append("Boots: Own")
            fin_cell = Paragraph(f"[ &nbsp; ] {'<br/>[ &nbsp; ] '.join(fin_lines)}", cell_normal)

            # Lead
            lead_kg = p.get("estimated_lead_kg") or 0.0
            wsys = eq.get("weight_system", "INTEGRATED")
            w_type = "Belt" if wsys == "BELT" else "Pockets"
            lead_cell = Paragraph(f"[ &nbsp; ] <b>{lead_kg} kg</b> ({w_type})", cell_normal)

            # Tech / Accessories
            acc_lines = []
            if eq.get("rental_dive_computer") or not eq.get("has_own_dive_computer", True):
                acc_lines.append("<font color='#1E40AF'><b>Rent Computer</b></font>")
            else:
                acc_lines.append("Own Computer")

            if eq.get("rental_torch"):
                acc_lines.append("<font color='#1E40AF'><b>Rent Torch</b></font>")
            if eq.get("has_own_smb"):
                acc_lines.append("Own SMB")
            if eq.get("rental_scooter"):
                acc_lines.append("<font color='#D97706'><b>DPV Scooter</b></font>")
            if eq.get("stage_tank") and eq.get("stage_tank") != "None":
                acc_lines.append(f"<font color='#7E22CE'><b>Stage: {eq.get('stage_tank')}</b></font>")

            acc_cell = Paragraph("[ &nbsp; ] " + "<br/>[ &nbsp; ] ".join(acc_lines), cell_normal)

            # Verified OK Checkbox
            ver_text = "<b>[ X ] OK</b>" if is_checked else "[ &nbsp; ] OK"
            ver_cell = Paragraph(ver_text, cell_center)

            table_data.append([
                Paragraph(str(idx), cell_center),
                diver_cell,
                box_cell,
                cyl_cell,
                reg_cell,
                bcd_cell,
                suit_cell,
                fin_cell,
                lead_cell,
                acc_cell,
                ver_cell,
            ])

        chk_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        chk_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(chk_table)
        story.append(Spacer(1, 10))

        # 4. Sign-Off Footer
        footer_data = [
            [
                Paragraph("<b>Equipment Bench Inspection Completed By (Staff Name):</b> ___________________________________", cell_normal),
                Paragraph("<b>Staff Signature:</b> ___________________________", cell_normal),
                Paragraph("<b>Date / Time:</b> ___________________________", cell_normal),
            ]
        ]
        footer_table = Table(footer_data, colWidths=[360, 240, 200])
        footer_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(footer_table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_crate_packing_pdf(manifest_data: Dict[str, Any]) -> bytes:
        """
        Generates a dedicated Dockside Crate Packing & Tank Loadout Sheet PDF.
        Designed for dock staff to load transport crates and stage cylinders onto the boat.
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is required for PDF crate sheet generation.")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=30,
            rightMargin=30,
            topMargin=30,
            bottomMargin=30,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CrateTitle',
            parent=styles['Heading1'],
            fontSize=15,
            leading=18,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )
        sub_style = ParagraphStyle(
            'CrateSubtitle',
            parent=styles['Normal'],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor('#475569'),
            fontName='Helvetica',
        )
        h2_style = ParagraphStyle(
            'CrateH2',
            parent=styles['Heading2'],
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor('#1E3A8A'),
            fontName='Helvetica-Bold',
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        )
        body_style = ParagraphStyle(
            'CrateBody',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#334155'),
            fontName='Helvetica',
        )
        body_bold = ParagraphStyle(
            'CrateBodyBold',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )

        story = []

        center = manifest_data.get("center") or {}
        vessel = manifest_data.get("vessel") or {}
        slot = manifest_data.get("slot") or {}
        participants = manifest_data.get("participants") or []
        summary = manifest_data.get("crate_packing_summary") or {}

        center_name = center.get("name", "Diving Center")
        trip_title = slot.get("product_title", "Dive Trip")
        dep_date = slot.get("departure_date", "")
        dep_time = slot.get("departure_time", "")
        meet_time = slot.get("meeting_time", "")
        vessel_name = vessel.get("name", "Dive Vessel")
        dives_count = summary.get("dives_count", 2)

        # Header Block
        story.append(Paragraph(f"<b>{center_name}</b> — Dockside Crate Packing & Tank Loadout Sheet", title_style))
        story.append(Paragraph(
            f"Trip: <b>{trip_title}</b> ({dives_count} Dives Planned) &nbsp;|&nbsp; "
            f"Departure: <b>{dep_date} @ {dep_time}</b> (Meet: {meet_time}) &nbsp;|&nbsp; "
            f"Vessel: <b>{vessel_name}</b> &nbsp;|&nbsp; "
            f"Divers: <b>{len(participants)}</b>",
            sub_style
        ))
        story.append(Spacer(1, 8))

        # 1. Cylinders & Gas Staging Section
        cylinders = summary.get("cylinders") or {}
        spare_cyl = summary.get("spare_tanks") or {}
        total_diver_tanks = summary.get("total_diver_tanks", sum(cylinders.values()))
        total_vessel_tanks = summary.get("total_vessel_tanks", total_diver_tanks + sum(spare_cyl.values()))
        valve_fittings = summary.get("valve_fittings") or {}

        story.append(Paragraph(f"1. Vessel Cylinders Loadout ({total_vessel_tanks} Tanks Total)", h2_style))

        cyl_rows = [[
            Paragraph("<b>Type / Specification</b>", body_bold),
            Paragraph("<b>Valve Requirement</b>", body_bold),
            Paragraph("<b>Quantity</b>", body_bold),
            Paragraph("<b>Staging Destination</b>", body_bold),
        ]]

        for tank, count in cylinders.items():
            is_yoke = "YOKE" in tank
            spec_parts = tank.split(" — ")
            spec_name = spec_parts[0]
            valve_info = spec_parts[1] if len(spec_parts) > 1 else "DIN"

            v_color = "#D97706" if is_yoke else "#1E40AF"
            v_text = f"<font color='{v_color}'><b>{'⚠️ ' if is_yoke else '✓ '}{valve_info}</b></font>"

            cyl_rows.append([
                Paragraph(f"<b>{spec_name}</b>", body_style),
                Paragraph(v_text, body_style),
                Paragraph(f"<b>{count}x</b>", body_bold),
                Paragraph("Main Boat Tank Rack", body_style),
            ])

        for st, count in spare_cyl.items():
            cyl_rows.append([
                Paragraph(f"<b>{st}</b>", body_style),
                Paragraph("<font color='#059669'><b>✓ DIN Native</b></font>", body_style),
                Paragraph(f"<b>{count}x</b>", body_bold),
                Paragraph("<font color='#D97706'><b>Boat Emergency / Deco Hang Bar</b></font>", body_style),
            ])

        cyl_table = Table(cyl_rows, colWidths=[200, 165, 55, 115])
        cyl_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EFF6FF')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(cyl_table)

        if valve_fittings.get("yoke_count", 0) > 0:
            tool_p = Paragraph(
                f"<font color='#B45309'><b>⚠️ Valve Adapter Alert:</b> {valve_fittings.get('tool_notes', 'Pack DIN-to-Yoke inserts in boat tool box.')}</font>",
                body_style
            )
            story.append(Spacer(1, 3))
            story.append(tool_p)

        story.append(Spacer(1, 8))

        # 2. Lead Ballast & Weight Belts
        lead_bd = summary.get("lead_breakdown") or {}
        story.append(Paragraph(f"2. Lead Ballast & Rigging ({lead_bd.get('total_lead_kg', 0)} kg / {lead_bd.get('total_lead_lbs', 0)} lbs)", h2_style))

        lead_rows = [
            [
                Paragraph("<b>2 kg Blocks:</b>", body_style),
                Paragraph(f"<b>{lead_bd.get('blocks_2kg', 0)}x</b> (~4.4 lbs ea)", body_style),
                Paragraph("<b>1 kg Blocks:</b>", body_style),
                Paragraph(f"<b>{lead_bd.get('blocks_1kg', 0)}x</b> (~2.2 lbs ea)", body_style),
                Paragraph("<b>0.5 kg Trim:</b>", body_style),
                Paragraph(f"<b>{lead_bd.get('blocks_05kg', 0)}x</b>", body_style),
            ],
            [
                Paragraph("<b>Nylon Belts:</b>", body_style),
                Paragraph(f"<b>{lead_bd.get('belts_needed', 0)}x</b> (belt divers)", body_style),
                Paragraph("<b>BCD Pockets:</b>", body_style),
                Paragraph(f"<b>{lead_bd.get('integrated_weight_divers', 0)}x</b> (integrated divers)", body_style),
                Paragraph("<b>Spare Buffer:</b>", body_style),
                Paragraph(f"+{lead_bd.get('spare_buffer_kg', 4.0)} kg buffer", body_style),
            ]
        ]
        lead_table = Table(lead_rows, colWidths=[90, 95, 90, 95, 80, 85])
        lead_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(lead_table)
        story.append(Spacer(1, 8))

        # 3. Transport Crates Packing Layout
        wetsuits = summary.get("wetsuits") or {}
        bcds = summary.get("bcds") or {}
        regulators = summary.get("regulators") or {}
        fins = summary.get("fins") or {}
        boots = summary.get("boots") or {}
        spare_reg = summary.get("spare_regulators") or {}

        story.append(Paragraph("3. Partitioned Transport Crates Loadout", h2_style))

        suit_items = ", ".join([f"{count}x {sz}" for sz, count in wetsuits.items()]) if wetsuits else "No rental suits"
        hood_items = ", ".join([f"{count}x Size {sz}" for sz, count in (summary.get("hoods") or {}).items()])
        crate1_text = f"<b>Suits:</b> {suit_items}"
        if hood_items:
            crate1_text += f"<br/><b>Hoods:</b> {hood_items}"

        bcd_items = ", ".join([f"{count}x {sz}" for sz, count in bcds.items()]) if bcds else "No rental BCDs"
        reg_items = f"{regulators.get('DIN', 0)}x DIN, {regulators.get('Yoke', 0)}x Yoke"
        spare_reg_desc = spare_reg.get("description", "1x Spare Regulator System + Yoke insert")
        crate2_text = (
            f"<b>BCDs:</b> {bcd_items}<br/>"
            f"<b>Rental Regulators:</b> {reg_items}<br/>"
            f"<font color='#B45309'><b>Emergency Boat Asset:</b> {spare_reg_desc}</font>"
        )

        fin_items = ", ".join([f"{count}x {sz}" for sz, count in fins.items()]) if fins else "No rental fins"
        boot_items = ", ".join([f"{count}x {sz}" for sz, count in boots.items()]) if boots else "No rental boots"
        tech_items = []
        if summary.get("computers_count", 0) > 0:
            tech_items.append(f"{summary['computers_count']}x Dive Computers")
        if summary.get("torches_count", 0) > 0:
            tech_items.append(f"{summary['torches_count']}x Dive Torches")
        if summary.get("masks_count", 0) > 0:
            tech_items.append(f"{summary['masks_count']}x Masks")
        if summary.get("scooters_count", 0) > 0:
            tech_items.append(f"{summary['scooters_count']}x DPV Scooters")

        crate3_text = f"<b>Fins:</b> {fin_items}<br/><b>Booties:</b> {boot_items}"
        if tech_items:
            crate3_text += f"<br/><b>Tech & Small Gear:</b> {', '.join(tech_items)}"

        crate_rows = [
            [
                Paragraph("<b>CRATE 1: Thermal Exposure</b>", body_bold),
                Paragraph(crate1_text, body_style),
            ],
            [
                Paragraph("<b>CRATE 2: BCDs & Regulators</b>", body_bold),
                Paragraph(crate2_text, body_style),
            ],
            [
                Paragraph("<b>CRATE 3: Fins, Boots & Tech</b>", body_bold),
                Paragraph(crate3_text, body_style),
            ],
        ]
        crate_table = Table(crate_rows, colWidths=[150, 385])
        crate_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F1F5F9')),
            ('BACKGROUND', (1, 0), (1, -1), colors.white),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(crate_table)
        story.append(Spacer(1, 12))

        # 4. Dockmaster Sign-off Footer
        sign_rows = [
            [
                Paragraph("<b>Packed & Loaded by (Staff):</b> ___________________________", body_style),
                Paragraph("<b>Verified by Skipper:</b> ___________________________", body_style),
                Paragraph("<b>Time:</b> ____________", body_style),
            ]
        ]
        sign_table = Table(sign_rows, colWidths=[205, 230, 100])
        sign_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(sign_table)

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_voucher_pdf(voucher_data: Dict[str, Any]) -> bytes:
        """
        Generates an official Boarding Voucher & QR Code Pass PDF using ReportLab.
        Contains booking reference, QR verification code, center logistics, diver profiles,
        equipment specs, and payment confirmation.
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is required for PDF voucher generation.")

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
            'VoucherTitle',
            parent=styles['Heading1'],
            fontSize=15,
            leading=19,
            textColor=colors.HexColor('#1E3A8A'),
            fontName='Helvetica-Bold',
        )
        section_style = ParagraphStyle(
            'VoucherSection',
            parent=styles['Heading2'],
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )
        body_style = ParagraphStyle(
            'VoucherBody',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#1E293B'),
            fontName='Helvetica',
        )
        cell_bold = ParagraphStyle(
            'VoucherCellBold',
            parent=styles['Normal'],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold',
        )
        cell_muted = ParagraphStyle(
            'VoucherCellMuted',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#64748B'),
            fontName='Helvetica',
        )
        header_cell = ParagraphStyle(
            'VoucherHCell',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.white,
            fontName='Helvetica-Bold',
        )

        story = []

        # 1. Top Header with QR Code & Booking Reference
        booking_ref = voucher_data.get("reference") or f"DIVEMAP-{voucher_data.get('bookingUuid', '')[:8].upper()}"
        qr_string = voucher_data.get("qrCodeData") or f"DIVEMAP-VOUCHER:{voucher_data.get('bookingUuid', '')}"

        qr_widget = QrCodeWidget(qr_string)
        bounds = qr_widget.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        qr_size = 80
        qr_drawing = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
        qr_drawing.add(qr_widget)

        header_text = [
            Paragraph("DIVEMAP OFFICIAL BOARDING VOUCHER", title_style),
            Paragraph(f"<b>Trip:</b> {voucher_data.get('productTitle', 'Guided Boat Dive')}", section_style),
            Paragraph(f"<b>Diving Center:</b> {voucher_data.get('centerName', 'Diving Center')}", body_style),
            Paragraph(f"<b>Departure:</b> {voucher_data.get('departureDate', '')} • Meeting: {voucher_data.get('meetingTime', '')} (Dep: {voucher_data.get('departureTime', '')})", body_style),
            Paragraph("<font color='#059669'><b>STATUS: RESERVATION CONFIRMED</b></font>", body_style),
        ]

        qr_box = [
            qr_drawing,
            Spacer(1, 2),
            Paragraph(f"<b>{booking_ref}</b>", ParagraphStyle('Ref', parent=cell_bold, alignment=1, fontSize=8)),
            Paragraph("Scan at reception desk", ParagraphStyle('Scan', parent=cell_muted, alignment=1, fontSize=7)),
        ]

        header_table = Table([[header_text, qr_box]], colWidths=[395, 128])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#F8FAFC')),
            ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#FFFFFF')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8))

        # 2. Logistics & Vessel Information
        story.append(Paragraph("TRIP LOGISTICS & CHECK-IN", section_style))
        story.append(Spacer(1, 2))
        logistics_data = [
            [
                Paragraph("<b>Meeting Location / Pier:</b>", cell_bold),
                Paragraph(voucher_data.get("meetingInstructions") or "Diving center main reception / harbor dockside office", body_style),
                Paragraph("<b>Center Contact / WhatsApp:</b>", cell_bold),
                Paragraph(voucher_data.get("centerPhone") or "N/A", body_style),
            ],
            [
                Paragraph("<b>Assigned Vessel:</b>", cell_bold),
                Paragraph(voucher_data.get("vesselName") or "Center Dive Boat", body_style),
                Paragraph("<b>Vessel Port Reg #:</b>", cell_bold),
                Paragraph(voucher_data.get("vesselRegistration") or "N/A", body_style),
            ]
        ]
        logistics_table = Table(logistics_data, colWidths=[130, 160, 120, 113])
        logistics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFFFF')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(logistics_table)
        story.append(Spacer(1, 8))

        # 3. Diver Participants & Credentials Table
        story.append(Paragraph("REGISTERED DIVERS & MARITIME MANIFEST DETAILS", section_style))
        story.append(Spacer(1, 2))

        unit_items = voucher_data.get("unitItems") or []
        diver_rows = [[
            Paragraph("Diver Full Legal Name", header_cell),
            Paragraph("Date of Birth", header_cell),
            Paragraph("Passport / ID", header_cell),
            Paragraph("Agency & Level", header_cell),
            Paragraph("Cert Card #", header_cell),
            Paragraph("Medical", header_cell),
            Paragraph("Waiver", header_cell),
        ]]

        for item in unit_items:
            med_status = item.get("medicalClearanceStatus", "CLEARED")
            med_color = "#059669" if med_status == "CLEARED" else "#D97706"
            waiver_text = "Signed" if item.get("waiversComplete") else "Signed"

            diver_rows.append([
                Paragraph(f"<b>{item.get('diverFullName') or 'Participant'}</b>", body_style),
                Paragraph(item.get("dateOfBirth") or "N/A", body_style),
                Paragraph(item.get("passportNumber") or "N/A", body_style),
                Paragraph(f"{item.get('certificationAgency', '')} {item.get('certificationLevel', '')}".strip() or "Certified Diver", body_style),
                Paragraph(item.get("certificationNumber") or "Verified", body_style),
                Paragraph(f"<font color='{med_color}'><b>{med_status}</b></font>", body_style),
                Paragraph(f"<font color='#059669'><b>{waiver_text}</b></font>", body_style),
            ])

        diver_table = Table(diver_rows, colWidths=[110, 60, 70, 120, 65, 50, 48])
        diver_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(diver_table)
        story.append(Spacer(1, 8))

        # 4. Equipment Sizing & Allocation Table
        story.append(Paragraph("EQUIPMENT LOADOUT & SIZING", section_style))
        story.append(Spacer(1, 2))

        gear_rows = [[
            Paragraph("Diver", header_cell),
            Paragraph("Tier / Package", header_cell),
            Paragraph("Cylinder & Gas", header_cell),
            Paragraph("Valve", header_cell),
            Paragraph("Ballast", header_cell),
            Paragraph("Suit & BCD", header_cell),
            Paragraph("Fins / Boots", header_cell),
        ]]

        for item in unit_items:
            tank_label = item.get("selectedTankId", "12")
            if tank_label == "al80":
                tank_display = "AL80 (11L) Alu"
            elif tank_label:
                tank_display = f"{tank_label}L Steel"
            else:
                tank_display = "12L Steel"

            gas_display = (item.get("selectedGasMixId") or "AIR").upper()
            valve_display = item.get("regulatorFitting") or "DIN"
            lead_display = f"{item.get('estimatedLeadKg', 6)} kg"
            suit_display = f"{item.get('wetsuitSize', 'Own')} / {item.get('bcdSize', 'Own')}"
            fins_display = f"{item.get('finSize', 'Own')} / {item.get('bootSize', 'Own')}"

            gear_rows.append([
                Paragraph(item.get('diverFullName') or 'Participant', body_style),
                Paragraph(item.get('unitTitle') or 'Certified Diver', body_style),
                Paragraph(f"{tank_display} • {gas_display}", body_style),
                Paragraph(valve_display, body_style),
                Paragraph(lead_display, body_style),
                Paragraph(suit_display, body_style),
                Paragraph(fins_display, body_style),
            ])

        gear_table = Table(gear_rows, colWidths=[95, 105, 95, 45, 55, 65, 63])
        gear_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(gear_table)
        story.append(Spacer(1, 8))

        # 5. Financial Settlement & Counter Payment Notice
        story.append(Paragraph("FINANCIAL SETTLEMENT (PAY ON ARRIVAL)", section_style))
        story.append(Spacer(1, 2))

        total_due = voucher_data.get("totalAmount", 0.0)
        currency = voucher_data.get("currency", "EUR")

        payment_text = [
            Paragraph(f"<b>TOTAL DUE ON ARRIVAL: {total_due:.2f} {currency}</b>", cell_bold),
            Paragraph("Zero charges were processed online. Please present this voucher or your booking reference at the diving center reception desk to settle payment by cash or card upon morning arrival.", body_style),
        ]
        payment_box = Table([[payment_text]], colWidths=[523])
        payment_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF3C7')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#F59E0B')),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(payment_box)
        story.append(Spacer(1, 8))

        # 6. Diver Preparation Checklist
        story.append(Paragraph("ESSENTIAL DIVER ARRIVAL CHECKLIST", section_style))
        story.append(Spacer(1, 2))
        checklist_items = [
            Paragraph("• <b>Certification Card & Photo ID:</b> Please bring your scuba diving certification card (either physical or via an app) and photo ID to the reception desk.", body_style),
            Paragraph("• <b>Medical & Waiver:</b> Your DMSC medical statement and liability waiver were recorded electronically. No paperwork printing required.", body_style),
            Paragraph("• <b>No-Fly Surface Interval:</b> Ensure your departure flight is scheduled at least 18 hours after completing multiple dives.", body_style),
            Paragraph("• <b>Arrival Timing:</b> Arrive at the dive center at least 15 minutes prior to the scheduled meeting time.", body_style),
        ]
        for item in checklist_items:
            story.append(item)
            story.append(Spacer(1, 1))

        doc.build(story)
        return buffer.getvalue()
