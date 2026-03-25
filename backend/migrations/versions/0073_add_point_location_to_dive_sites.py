"""add_point_location_to_dive_sites

Revision ID: 0073
Revises: 0072
Create Date: 2026-03-25 12:17:35.614144

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0073'
down_revision = '0072'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        # Check if column already exists (defensive upgrade)
        exists = bind.execute(
            sa.text(
                """
                SELECT COUNT(*) AS cnt
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'dive_sites'
                  AND COLUMN_NAME = 'location'
                """
            )
        ).scalar()

        if not exists:
            # 1) Add POINT column with SRID 4326 as NULL initially
            op.execute("ALTER TABLE dive_sites ADD COLUMN location POINT SRID 4326 NULL")

        # 2) Backfill from existing lat/lng where present
        op.execute(
            """
            UPDATE dive_sites
            SET location = ST_SRID(POINT(longitude, latitude), 4326)
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """
        )

        # 3) For remaining NULLs (no coords), set to a sentinel POINT(0,0) with SRID 4326
        op.execute(
            """
            UPDATE dive_sites
            SET location = ST_SRID(POINT(0, 0), 4326)
            WHERE location IS NULL
            """
        )

        # 4) Enforce NOT NULL (required for SPATIAL INDEX in MySQL)
        op.execute("ALTER TABLE dive_sites MODIFY COLUMN location POINT SRID 4326 NOT NULL")

        # 5) Create spatial index if it doesn't exist
        idx_exists = bind.execute(
            sa.text(
                """
                SELECT COUNT(*) AS cnt
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'dive_sites'
                  AND INDEX_NAME = 'idx_dive_sites_location'
                """
            )
        ).scalar()
        if not idx_exists:
            op.execute("CREATE SPATIAL INDEX idx_dive_sites_location ON dive_sites (location)")
    else:
        # SQLite or other dialects: add as Text
        op.add_column('dive_sites', sa.Column('location', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        # Drop spatial index then column
        op.execute("DROP INDEX idx_dive_sites_location ON dive_sites")
        op.execute("ALTER TABLE dive_sites DROP COLUMN location")
    else:
        op.drop_column('dive_sites', 'location')
