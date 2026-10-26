"""instructor certifications nitrox gases

Revision ID: 0109
Revises: 0108
Create Date: 2026-10-26 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "0109"
down_revision = "0108"
branch_labels = None
depends_on = None

INSTRUCTOR_GAS_UPDATES = [
    # (org_acronym, cert_name, new_gases)
    ("PADI", "Open Water Scuba Instructor (OWSI)", "Air / Nitrox up to 40% O2"),
    ("PADI", "Master Scuba Diver Trainer (MSDT)", "Air / Nitrox up to 40% O2"),
    ("PADI", "IDC Staff Instructor", "Air / Nitrox up to 40% O2"),
    ("PADI", "Master Instructor", "Air / Nitrox up to 40% O2"),
    ("PADI", "Course Director", "Air / Nitrox up to 40% O2"),
    ("SSI", "Assistant Instructor", "Air / Nitrox up to 40% O2"),
    ("SSI", "Open Water Instructor", "Air / Nitrox up to 40% O2"),
]


def upgrade():
    conn = op.get_bind()
    for org_acronym, cert_name, new_gases in INSTRUCTOR_GAS_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE certification_levels cl
                JOIN diving_organizations do_org ON cl.diving_organization_id = do_org.id
                SET cl.gases = :new_gases
                WHERE do_org.acronym = :org_acronym AND cl.name = :cert_name
                """
            ),
            {
                "new_gases": new_gases,
                "org_acronym": org_acronym,
                "cert_name": cert_name,
            },
        )


def downgrade():
    conn = op.get_bind()
    for org_acronym, cert_name, _ in INSTRUCTOR_GAS_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE certification_levels cl
                JOIN diving_organizations do_org ON cl.diving_organization_id = do_org.id
                SET cl.gases = NULL
                WHERE do_org.acronym = :org_acronym AND cl.name = :cert_name
                """
            ),
            {"org_acronym": org_acronym, "cert_name": cert_name},
        )
