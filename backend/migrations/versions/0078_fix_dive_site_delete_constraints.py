"""fix_dive_site_delete_constraints

Revision ID: 0078
Revises: 0077
Create Date: 2026-03-31 18:07:52.696174

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0078'
down_revision = '0077'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop existing foreign key on route_analytics and recreate with ON DELETE CASCADE
    op.execute('ALTER TABLE route_analytics DROP FOREIGN KEY route_analytics_ibfk_1')
    op.create_foreign_key(
        'route_analytics_ibfk_1',
        'route_analytics', 'dive_routes',
        ['route_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Restore original foreign key without ON DELETE CASCADE
    op.execute('ALTER TABLE route_analytics DROP FOREIGN KEY route_analytics_ibfk_1')
    op.create_foreign_key(
        'route_analytics_ibfk_1',
        'route_analytics', 'dive_routes',
        ['route_id'], ['id']
    )
