"""add POINT location to diving_centers with spatial index and backfill

Revision ID: 0038
Revises: 0037
Create Date: 2025-10-30 19:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0038'
down_revision = '0037'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        # 1) Add POINT column with SRID 4326
        op.execute("ALTER TABLE diving_centers ADD COLUMN location POINT SRID 4326 NULL")

        # 2) Backfill from existing lat/lng where present
        op.execute(
            """
            UPDATE diving_centers
            SET location = ST_GeomFromText(CONCAT('POINT(', longitude, ' ', latitude, ')'), 4326)
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """
        )

        # 3) Create spatial index
        op.execute("CREATE SPATIAL INDEX idx_diving_centers_location ON diving_centers (location)")
    else:
        # SQLite or other dialects: no-op (spatial features not supported here)
        pass


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        # Drop spatial index then column
        op.execute("DROP INDEX idx_diving_centers_location ON diving_centers")
        op.execute("ALTER TABLE diving_centers DROP COLUMN location")
    else:
        # No-op for other dialects
        pass


