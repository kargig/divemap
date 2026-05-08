"""schema_integrity_cleanup

Revision ID: 0089
Revises: 0088
Create Date: 2026-05-08 10:18:43.545060

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0089'
down_revision = '0088'
branch_labels = None
depends_on = None


from sqlalchemy.engine.reflection import Inspector

def get_fk_name(table_name, column_name):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for fk in inspector.get_foreign_keys(table_name):
        if column_name in fk['constrained_columns']:
            return fk['name']
    return None

def safe_drop_fk(table_name, column_name):
    fk_name = get_fk_name(table_name, column_name)
    if fk_name:
        op.drop_constraint(fk_name, table_name, type_='foreignkey')

def upgrade() -> None:
    # 1. Center Comments
    op.alter_column('center_comments', 'user_id', existing_type=mysql.INTEGER(), nullable=True)
    safe_drop_fk('center_comments', 'user_id')
    safe_drop_fk('center_comments', 'diving_center_id')
    op.create_foreign_key(None, 'center_comments', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'center_comments', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    
    # 2. Center Dive Sites
    safe_drop_fk('center_dive_sites', 'diving_center_id')
    op.create_foreign_key(None, 'center_dive_sites', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    
    # 3. Center Ratings
    safe_drop_fk('center_ratings', 'user_id')
    safe_drop_fk('center_ratings', 'diving_center_id')
    op.create_foreign_key(None, 'center_ratings', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'center_ratings', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    
    # 4. Dive Site Edit Requests
    op.alter_column('dive_site_edit_requests', 'requested_by_id', existing_type=mysql.INTEGER(), nullable=True)
    safe_drop_fk('dive_site_edit_requests', 'requested_by_id')
    op.create_foreign_key(None, 'dive_site_edit_requests', 'users', ['requested_by_id'], ['id'], ondelete='SET NULL')
    
    # 5. Diving Center Organizations
    safe_drop_fk('diving_center_organizations', 'diving_center_id')
    safe_drop_fk('diving_center_organizations', 'diving_organization_id')
    op.create_foreign_key(None, 'diving_center_organizations', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'diving_center_organizations', 'diving_organizations', ['diving_organization_id'], ['id'], ondelete='CASCADE')
    
    # 6. Gear Rental Costs
    safe_drop_fk('gear_rental_costs', 'diving_center_id')
    op.create_foreign_key(None, 'gear_rental_costs', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    
    # 7. Ownership Requests
    # Clean up orphans first to prevent integrity error during constraint creation
    op.execute("DELETE FROM ownership_requests WHERE user_id NOT IN (SELECT id FROM users)")
    op.execute("DELETE FROM ownership_requests WHERE diving_center_id NOT IN (SELECT id FROM diving_centers)")
    safe_drop_fk('ownership_requests', 'diving_center_id')
    safe_drop_fk('ownership_requests', 'user_id')
    op.create_foreign_key(None, 'ownership_requests', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'ownership_requests', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    
    # 8. Parsed Dive Trips
    safe_drop_fk('parsed_dive_trips', 'diving_center_id')
    op.create_foreign_key(None, 'parsed_dive_trips', 'diving_centers', ['diving_center_id'], ['id'], ondelete='CASCADE')
    
    # 9. Parsed Dives
    safe_drop_fk('parsed_dives', 'trip_id')
    op.create_foreign_key(None, 'parsed_dives', 'parsed_dive_trips', ['trip_id'], ['id'], ondelete='CASCADE')

def downgrade() -> None:
    # 1. Parsed Dives
    safe_drop_fk('parsed_dives', 'trip_id')
    op.create_foreign_key(None, 'parsed_dives', 'parsed_dive_trips', ['trip_id'], ['id'])
    
    # 2. Parsed Dive Trips
    safe_drop_fk('parsed_dive_trips', 'diving_center_id')
    op.create_foreign_key(None, 'parsed_dive_trips', 'diving_centers', ['diving_center_id'], ['id'])
    
    # 3. Ownership Requests
    safe_drop_fk('ownership_requests', 'diving_center_id')
    safe_drop_fk('ownership_requests', 'user_id')
    op.create_foreign_key(None, 'ownership_requests', 'diving_centers', ['diving_center_id'], ['id'])
    op.create_foreign_key(None, 'ownership_requests', 'users', ['user_id'], ['id'])
    
    # 4. Gear Rental Costs
    safe_drop_fk('gear_rental_costs', 'diving_center_id')
    op.create_foreign_key(None, 'gear_rental_costs', 'diving_centers', ['diving_center_id'], ['id'])
    
    # 5. Diving Center Organizations
    safe_drop_fk('diving_center_organizations', 'diving_center_id')
    safe_drop_fk('diving_center_organizations', 'diving_organization_id')
    op.create_foreign_key(None, 'diving_center_organizations', 'diving_centers', ['diving_center_id'], ['id'])
    op.create_foreign_key(None, 'diving_center_organizations', 'diving_organizations', ['diving_organization_id'], ['id'])
    
    # 6. Dive Site Edit Requests
    safe_drop_fk('dive_site_edit_requests', 'requested_by_id')
    op.create_foreign_key(None, 'dive_site_edit_requests', 'users', ['requested_by_id'], ['id'])
    op.alter_column('dive_site_edit_requests', 'requested_by_id', existing_type=mysql.INTEGER(), nullable=False)
               
    # 7. Center Ratings
    safe_drop_fk('center_ratings', 'diving_center_id')
    safe_drop_fk('center_ratings', 'user_id')
    op.create_foreign_key(None, 'center_ratings', 'diving_centers', ['diving_center_id'], ['id'])
    op.create_foreign_key(None, 'center_ratings', 'users', ['user_id'], ['id'])
    
    # 8. Center Dive Sites
    safe_drop_fk('center_dive_sites', 'diving_center_id')
    op.create_foreign_key(None, 'center_dive_sites', 'diving_centers', ['diving_center_id'], ['id'])
    
    # 9. Center Comments
    safe_drop_fk('center_comments', 'user_id')
    safe_drop_fk('center_comments', 'diving_center_id')
    op.create_foreign_key(None, 'center_comments', 'users', ['user_id'], ['id'])
    op.create_foreign_key(None, 'center_comments', 'diving_centers', ['diving_center_id'], ['id'])
    op.alter_column('center_comments', 'user_id', existing_type=mysql.INTEGER(), nullable=False)
