"""add unlinked_site_name to dives

Revision ID: 0110
Revises: 0109
Create Date: 2026-10-27 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "0110"
down_revision = "0109"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dives",
        sa.Column("unlinked_site_name", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_dives_unlinked_site_name",
        "dives",
        ["unlinked_site_name"],
    )


def downgrade():
    op.drop_index("ix_dives_unlinked_site_name", table_name="dives")
    op.drop_column("dives", "unlinked_site_name")
