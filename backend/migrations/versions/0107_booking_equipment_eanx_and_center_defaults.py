"""booking equipment eanx and center defaults

Revision ID: 0107
Revises: 0106
Create Date: 2026-10-22 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = '0107'
down_revision = '0106'
branch_labels = None
depends_on = None

CERT_GAS_UPDATES = [
    # (org_acronym, cert_name, new_gases)
    ("PADI", "Advanced Open Water Diver (AOWD)", "Air"),
    ("PADI", "Rescue Diver", "Air"),
    ("PADI", "Enriched Air Diver (Nitrox)", "Nitrox up to 40% O2"),
    ("PADI", "Tec Trimix Diver", "Hypoxic Trimix / multiple stages / O2"),
    ("SSI", "Advanced Adventurer", "Air"),
    ("SSI", "Diver Stress & Rescue", "Air"),
    ("SSI", "Enriched Air Nitrox", "Nitrox up to 40% O2"),
    ("TDI", "Intro to Tech", "Air / Nitrox up to 40%"),
    ("TDI", "Decompression Procedures Diver", "Air / Nitrox / O2 for deco"),
    ("TDI", "CCR Air Diluent / Decompression / Mixed Gas / Hypoxic", "Air / Nitrox / Trimix / O2 (CCR)"),
    ("SDI", "Advanced Adventure Diver", "Air"),
    ("SDI", "Deep Diver", "Air"),
    ("SDI", "Computer Nitrox", "Nitrox up to 40% O2"),
    ("NAUI", "Advanced Scuba Diver", "Air"),
    ("CMAS", "Two Star Diver (**)", "Air"),
    ("CMAS", "Three Star Diver (***)", "Air"),
    ("IANTD", "Advanced Open Water", "Air"),
    ("IANTD", "Advanced Nitrox", "Nitrox up to 50% O2"),
    ("ANDI", "Advanced Open Water Diver (L2)", "Air"),
    ("ANDI", "Rescue Diver (L2)", "Air"),
    ("ANDI", "Limited SafeAir User (LSU) / SafeAir Diver", "SafeAir (Nitrox) 22-40%"),
]


def upgrade():
    # 1. Add booking unit item gas mix status & checkin verifications
    op.add_column(
        'octo_booking_unit_items',
        sa.Column('gas_mix_status', sa.String(length=32), server_default='APPROVED', nullable=False),
    )
    op.add_column('octo_booking_unit_items', sa.Column('checkin_verifications', sa.JSON(), nullable=True))

    conn = op.get_bind()
    # Backfill pre-existing non-air bookings to PENDING_APPROVAL so unverified EANx does not fail open
    conn.execute(
        sa.text(
            """
            UPDATE octo_booking_unit_items
            SET gas_mix_status = 'PENDING_APPROVAL'
            WHERE LOWER(COALESCE(selected_gas_mix_id, 'air')) NOT IN ('air', '')
            """
        )
    )

    # 2. Add diving center booking settings default valve & daily insurance price
    op.add_column(
        'diving_center_booking_settings',
        sa.Column('default_valve_fitting', sa.String(length=10), server_default='DIN', nullable=False),
    )
    op.add_column(
        'diving_center_booking_settings',
        sa.Column('daily_insurance_price', sa.Numeric(precision=6, scale=2), server_default='0.00', nullable=False),
    )

    # 3. Synchronize certification level gases with accurate agency specifications
    conn = op.get_bind()
    for org_acronym, cert_name, new_gases in CERT_GAS_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE certification_levels cl
                JOIN diving_organizations do_org ON cl.diving_organization_id = do_org.id
                SET cl.gases = :new_gases
                WHERE do_org.acronym = :org_acronym AND cl.name = :cert_name
                """
            ),
            {"new_gases": new_gases, "org_acronym": org_acronym, "cert_name": cert_name},
        )


def downgrade():
    op.drop_column('diving_center_booking_settings', 'daily_insurance_price')
    op.drop_column('diving_center_booking_settings', 'default_valve_fitting')
    op.drop_column('octo_booking_unit_items', 'checkin_verifications')
    op.drop_column('octo_booking_unit_items', 'gas_mix_status')
