import csv
import io
from typing import Dict, Any, List
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class ManifestExportService:
    """Generates official maritime Port Authority manifests in CSV and PDF formats."""

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
            "C-Card Number",
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

        # Metadata Summary Box (2 columns: Center & Vessel / Trip)
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
