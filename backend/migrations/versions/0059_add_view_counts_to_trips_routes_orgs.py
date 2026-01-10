"""add_view_counts_to_trips_routes_orgs

Revision ID: 0059
Revises: 0058
Create Date: 2026-01-10 09:03:04.683041

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0059'
down_revision = '0058'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add view_count columns
    op.add_column('dive_routes', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('diving_organizations', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('parsed_dive_trips', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))

    # Add missing foreign key for source_newsletter_id if it doesn't exist
    # Using a try-except block or explicit check is hard in pure alembic without binding
    # But since autogen detected it, we assume it's missing.
    # We use a named constraint
    try:
        op.create_foreign_key('fk_parsed_dive_trips_newsletters', 'parsed_dive_trips', 'newsletters', ['source_newsletter_id'], ['id'])
    except Exception:
        pass


def downgrade() -> None:
    # Remove foreign key
    try:
        op.drop_constraint('fk_parsed_dive_trips_newsletters', 'parsed_dive_trips', type_='foreignkey')
    except Exception:
        pass

    # Remove view_count columns
    op.drop_column('parsed_dive_trips', 'view_count')
    op.drop_column('diving_organizations', 'view_count')
    op.drop_column('dive_routes', 'view_count')