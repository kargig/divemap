"""change ratings to 5 scale

Revision ID: 0106
Revises: 0105
Create Date: 2026-10-18 12:00:00.000000

Scales platform ratings down from 1-10 to 1-5 scale using:
    score = GREATEST(1, ROUND(score / 2.0))
Updates MySQL CHECK constraints to enforce score >= 1 AND score <= 5.

NOTE: Downgrade is lossy for odd original ratings (e.g. 7 or 9 map to 4 or 5,
which scale back to 8 or 10 on rollback).
"""

import sqlalchemy as sa
from alembic import op

revision = "0106"
down_revision = "0105"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Scale existing ratings down from 1-10 to 1-5
    # Formula: GREATEST(1, ROUND(score / 2.0))
    op.execute(
        sa.text("UPDATE site_ratings SET score = GREATEST(1, ROUND(score / 2.0))")
    )
    op.execute(
        sa.text("UPDATE center_ratings SET score = GREATEST(1, ROUND(score / 2.0))")
    )
    op.execute(
        sa.text(
            "UPDATE dives SET user_rating = GREATEST(1, ROUND(user_rating / 2.0)) WHERE user_rating IS NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE dives SET visibility_rating = GREATEST(1, ROUND(visibility_rating / 2.0)) WHERE visibility_rating IS NOT NULL"
        )
    )

    # 2. Update CHECK constraints on MySQL for site_ratings and center_ratings
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        try:
            op.execute(
                sa.text("ALTER TABLE site_ratings DROP CHECK site_ratings_chk_1")
            )
        except Exception as e:
            print(
                f"Info: site_ratings_chk_1 was not present or could not be dropped: {e}"
            )

        op.execute(
            sa.text(
                "ALTER TABLE site_ratings ADD CONSTRAINT site_ratings_chk_1 CHECK (score >= 1 AND score <= 5)"
            )
        )

        try:
            op.execute(
                sa.text("ALTER TABLE center_ratings DROP CHECK center_ratings_chk_1")
            )
        except Exception as e:
            print(
                f"Info: center_ratings_chk_1 was not present or could not be dropped: {e}"
            )

        op.execute(
            sa.text(
                "ALTER TABLE center_ratings ADD CONSTRAINT center_ratings_chk_1 CHECK (score >= 1 AND score <= 5)"
            )
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        try:
            op.execute(
                sa.text("ALTER TABLE site_ratings DROP CHECK site_ratings_chk_1")
            )
        except Exception as e:
            print(
                f"Info: site_ratings_chk_1 was not present or could not be dropped: {e}"
            )

        op.execute(
            sa.text(
                "ALTER TABLE site_ratings ADD CONSTRAINT site_ratings_chk_1 CHECK (score >= 1 AND score <= 10)"
            )
        )

        try:
            op.execute(
                sa.text("ALTER TABLE center_ratings DROP CHECK center_ratings_chk_1")
            )
        except Exception as e:
            print(
                f"Info: center_ratings_chk_1 was not present or could not be dropped: {e}"
            )

        op.execute(
            sa.text(
                "ALTER TABLE center_ratings ADD CONSTRAINT center_ratings_chk_1 CHECK (score >= 1 AND score <= 10)"
            )
        )

    op.execute(sa.text("UPDATE site_ratings SET score = LEAST(10, score * 2)"))
    op.execute(sa.text("UPDATE center_ratings SET score = LEAST(10, score * 2)"))
    op.execute(
        sa.text(
            "UPDATE dives SET user_rating = LEAST(10, user_rating * 2) WHERE user_rating IS NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE dives SET visibility_rating = LEAST(10, visibility_rating * 2) WHERE visibility_rating IS NOT NULL"
        )
    )
